import { ADAPTER } from "../platform/adapt";
import { Chapter } from "../page-fetcher";
import { CherryPick, Downloader } from "../download/downloader";
import { GalleryMeta } from "../download/gallery-meta";
import type { DownloaderPanel, DownloaderPanelStage } from "../ui/downloader-panel";
import { FetchState, IMGFetcher } from "../img-fetcher";
import type ImageNode from "../img-node";
import { SubData } from "../platform/platform";
import EBUS from "../event-bus";
import { classifyEagleApiError, EagleWebApi, AddItemInput, extractEagleLibraryName, extractEagleLibraryPath } from "./eagle-web-api";
import { ensureFolderPath } from "./folders";
import { arrayBufferToBase64 } from "./transport";
import { cleanFolderTagValue, collapseCharacterFolderValues, EAGLE_FOLDER_PRESET_TEMPLATES, EagleFolderTokens, hasMalformedEagleFolderTokenSyntax, normalizeEagleBaseUrl, normalizeEagleFolderTemplate, normalizeEagleImportLimit, resolveEagleFolderPaths } from "./options";
import { duplicateQueries, hasPlannedAssetKey, isDuplicateItem, isSessionImported, markPlannedAssetKey, markSessionImported } from "./duplicates";
import { normalizeEagleItemTags, normalizeEagleTags, semanticSourceTags, sourcePublishedAtTags, sourceTagsFromGalleryMeta } from "./tags";
import { isReadyForEagleImport } from "./import-readiness";
import { eaglePlanCompactParts, eaglePlanCompactSummary, eaglePlanHeadline, eaglePlanSummaryParts, eagleSummaryParts, eagleToastSummary, EagleImportSummaryStats, shouldConfirmImportPlan } from "./import-summary";
import { createEagleItemName, localDatePrefix, normalizeEagleItemNameWithDatePrefix } from "./naming";
import { i18n } from "../utils/i18n";
import { eagleAnnotationForAsset } from "./annotation";
import pLimit from "p-limit";

const FILENAME_INVALIDCHAR = /[\\/:*?"<>|\n\t]/g;
const METADATA_FOLDER_TOKENS = ["copyright", "character", "author"] as const;
const EAGLE_DUPLICATE_CHECK_CONCURRENCY = 4;

type EagleImportStats = EagleImportSummaryStats & {
  folders: string[];
  folderLinks: EagleImportResultLink[];
  itemLinks: EagleImportResultLink[];
  skippedItems: string[];
  failures: string[];
  sessionSkipped: number;
  duplicateSkipped: number;
};

type EagleImportResultLink = { label: string; url: string };

type EagleImportAsset = {
  name: string;
  data: Uint8Array;
  contentType: string;
  sourceUrl: string;
  originUrl?: string;
  itemKey?: string;
  tags: string[];
  website: string;
  folderTokens: EagleFolderTokens;
  sourceTags: string[];
  chapter: Chapter;
  chapterDirectory: string;
  meta: GalleryMeta;
  node: ImageNode;
};

type EagleImportJob = {
  asset: EagleImportAsset;
  folderPaths: string[][];
  folderKeys: string[];
  folderKey: string;
  finalName?: string;
  preflightChecked?: boolean;
  skipReason?: EagleImportSkipReason;
  preflightError?: unknown;
};

type EagleImportSkipReason = "session" | "duplicate";

type EagleImportPreflight = {
  writable: number;
  sessionSkipped: number;
  duplicateSkipped: number;
  failed: number;
};

type EagleImportEndStage = Extract<DownloaderPanelStage, "downloadFailed" | "downloaded" | "downloadStart" | "importNoNewItems">;

export class EagleDownloader extends Downloader {
  private importStopRequested = false;

  initEvents(panel: DownloaderPanel) {
    panel.forceBTN.addEventListener("click", () => {
      if (this.downloading) {
        this.abort("downloadStart");
      } else {
        this.importLoaded();
      }
    });
    panel.startBTN.addEventListener("click", () => {
      if (this.downloading) {
        this.abort("downloadStart");
      } else {
        this.start();
      }
    });
  }

  private async importLoaded(): Promise<void> {
    if (this.downloading) return;
    this.downloading = true;
    try {
      await this.download(this.pageFetcher.chapters);
    } catch (error) {
      console.error(error);
    } finally {
      this.downloading = false;
    }
  }

  abort(stage: EagleImportEndStage) {
    if (stage === "downloadStart") this.importStopRequested = true;
    super.abort(stage);
  }

  async download(chapters: Chapter[]) {
    this.done = false;
    this.importStopRequested = false;
    const abortable = this.downloading;
    const stats = emptyImportStats();
    const folderIds = new Map<string, string>();
    const folderNames = new Map<string, Set<string>>();
    let cancelled = false;
    let endStage: EagleImportEndStage = "downloadFailed";
    try {
      this.panel.flushUI("packaging");
      const singleChapter = chapters.length === 1;
      const folderTemplate = eagleFolderTemplateForImport(ADAPTER.conf.eagleFolderPath);
      const importDate = localDatePrefix();
      const selectedJobs: EagleImportJob[] = [];

      for (let i = 0; i < chapters.length; i++) {
        if (abortable && !this.downloading) throw new Error("abort");
        const chapter = chapters[i];
        const chapterIndex = this.pageFetcher.chapters.indexOf(chapter);
        const chapterTitle = safeTitle(titleToString(chapter.title));
        const picked = this.cherryPicks[chapterIndex] || this.cherryPicks[i] || new CherryPick();
        const meta = this.meta(chapter);
        const assets = this.assetsForChapter(chapter, picked, singleChapter ? "" : chapterTitle, meta, importDate);
        selectedJobs.push(...assets.map(asset => this.jobForAsset(folderTemplate, asset)));
      }

      if (selectedJobs.length === 0) {
        throw new Error(i18n.eagleImportNoFetchedImages.get());
      }
      const api = new EagleWebApi(normalizeEagleBaseUrl(ADAPTER.conf.eagleBaseUrl));
      this.panel.setImportProgress(i18n.eagleImportCheckingEagle.get());
      const connection = await api.probe();
      const libraryName = extractEagleLibraryName(connection.library) || i18n.eagleConfigUnknownLibrary.get();
      stats.libraryName = libraryName;
      if (ADAPTER.conf.eagleSkipDuplicates && selectedJobs.length > 1) {
        EBUS.emit("notify-message", "info", i18n.eagleImportCheckingDuplicates.get(), 4000);
      }
      const preflight = await this.preflightJobs(api, selectedJobs);
      this.assertImportActive();
      const importPlan = limitWritableImportJobs(selectedJobs, ADAPTER.conf.eagleImportLimit);
      const jobs = importPlan.jobs;
      stats.selected = importPlan.selected;
      stats.omittedByLimit = importPlan.omittedByLimit;
      stats.planned = jobs.length;
      prepareWritableJobNames(jobs);
      const organization = eaglePlanOrganization(folderTemplate, jobs);
      const plan = {
        folderTemplate,
        libraryName,
        importLimit: importPlan.limit,
        sourceTagLimit: ADAPTER.conf.eagleMaxSourceTags,
        skipDuplicates: ADAPTER.conf.eagleSkipDuplicates,
        confirmMode: ADAPTER.conf.eagleConfirmMode,
        confirmThreshold: ADAPTER.conf.eagleConfirmThreshold,
        selected: importPlan.selected,
        planned: jobs.length,
        omittedByLimit: importPlan.omittedByLimit,
        writable: importPlan.writable,
        sessionSkipped: preflight.sessionSkipped,
        duplicateSkipped: preflight.duplicateSkipped,
        preflightFailed: preflight.failed,
        ...organization,
        itemNamePolicy: itemNamePolicy(),
      };
      EBUS.emit("notify-message", "info", eaglePlanCompactSummary(plan), 8000);
      if (shouldConfirmImportPlan(plan)) {
        const confirmed = await this.panel.confirmEagleImportPlan(eaglePlanCompactParts(plan), eaglePlanHeadline(plan), eaglePlanSummaryParts(plan));
        if (!confirmed) {
          cancelled = true;
          EBUS.emit("notify-message", "info", i18n.eagleImportCanceledBeforeWriting.get(), 4000);
          return;
        }
      }
      if (importPlan.writable > 0) await assertEagleLibraryUnchanged(api, connection.library);

      let writeIndex = 0;
      for (const job of jobs) {
        if (abortable && !this.downloading) throw new Error("abort");
        if (!job.skipReason && !job.preflightError && importPlan.writable > 0) {
          writeIndex += 1;
          this.panel.setImportProgress(i18n.eagleImportWritingToEagle.get(), writeIndex, importPlan.writable);
        }
        await this.writeJob(api, folderIds, job, stats, usedNamesForFolder(folderNames, job.folderKey));
      }

      this.done = stats.failed === 0;
      endStage = eagleImportEndStage(stats);
      this.panel.showEagleImportResult(eagleSummaryParts(stats), stats.failed > 0, eagleImportResultLinks(stats));
      EBUS.emit("notify-message", this.done ? "info" : "error", eagleToastSummary(stats), 10000);
    } catch (error: any) {
      if (error === "abort" || error?.message === "abort") {
        cancelled = true;
        return;
      }
      recordImportFailure(stats, i18n.eagleSummaryTitle.get(), error);
      this.panel.showEagleImportResult(eagleSummaryParts(stats), true, eagleImportResultLinks(stats));
      EBUS.emit("notify-message", "error", format(i18n.eagleImportFailedToast.get(), { message: eagleImportErrorMessage(error) }), 10000);
      throw error;
    } finally {
      const stopped = cancelled || this.importStopRequested;
      if (stopped) this.showPartialCancellation(stats);
      this.abort(stopped ? "downloadStart" : endStage);
    }
  }

  async importOne(chapterIndex: number, index: number): Promise<void> {
    if (this.downloading) {
      EBUS.emit("notify-message", "error", i18n.eagleImportAlreadyRunning.get(), 4000);
      return;
    }
    const chapter = this.pageFetcher.chapters[chapterIndex];
    const imf = chapter?.filteredQueue[index];
    if (!chapter || !imf) {
      const stats = emptyImportStats();
      recordImportFailure(stats, i18n.eagleSummaryTitle.get(), new Error(i18n.eagleImportNoImageFound.get()));
      this.panel.showEagleImportResult(eagleSummaryParts(stats), true, eagleImportResultLinks(stats));
      EBUS.emit("notify-message", "error", i18n.eagleImportNoImageFound.get(), 4000);
      return;
    }

    const stats = emptyImportStats();
    let cancelled = false;
    let endStage: EagleImportEndStage = "downloadFailed";
    this.done = false;
    this.downloading = true;
    this.importStopRequested = false;
    try {
      if (!isReadyForEagleImport(imf)) {
        if (imf.stage === FetchState.FAILED) imf.resetStage();
        this.panel.flushUI("downloading");
        EBUS.emit("notify-message", "info", i18n.eagleImportFetchingCurrent.get(), 3000);
        await imf.start();
      }
      if (!this.downloading || this.importStopRequested) {
        cancelled = true;
        return;
      }
      if (!isReadyForEagleImport(imf)) {
        throw new Error(imf.failedReason || i18n.eagleImportCurrentNotFetched.get());
      }

      this.panel.flushUI("packaging");
      const folderTemplate = eagleFolderTemplateForImport(ADAPTER.conf.eagleFolderPath);
      const api = new EagleWebApi(normalizeEagleBaseUrl(ADAPTER.conf.eagleBaseUrl));
      this.panel.setImportProgress(i18n.eagleImportCheckingEagle.get());
      const connection = await api.probe();
      const libraryName = extractEagleLibraryName(connection.library) || i18n.eagleConfigUnknownLibrary.get();
      stats.libraryName = libraryName;
      const chapterTitle = safeTitle(titleToString(chapter.title));
      const singleChapter = this.pageFetcher.chapters.length === 1;
      const importDate = localDatePrefix();
      const folderIds = new Map<string, string>();
      const folderNames = new Map<string, Set<string>>();
      const assets = this.assetsForChapter(chapter, { picked: current => current === index }, singleChapter ? "" : chapterTitle, this.meta(chapter), importDate);
      stats.planned = assets.length;
      if (assets.length === 0) throw new Error(i18n.eagleImportCurrentNotReady.get());
      const jobs = assets.map(asset => this.jobForAsset(folderTemplate, asset));
      const preflight = await this.preflightJobs(api, jobs);
      this.assertImportActive();
      prepareWritableJobNames(jobs);
      const organization = eaglePlanOrganization(folderTemplate, jobs);
      const plan = {
        folderTemplate,
        libraryName,
        sourceTagLimit: ADAPTER.conf.eagleMaxSourceTags,
        skipDuplicates: ADAPTER.conf.eagleSkipDuplicates,
        confirmMode: ADAPTER.conf.eagleConfirmMode,
        confirmThreshold: ADAPTER.conf.eagleConfirmThreshold,
        planned: jobs.length,
        writable: preflight.writable,
        sessionSkipped: preflight.sessionSkipped,
        duplicateSkipped: preflight.duplicateSkipped,
        preflightFailed: preflight.failed,
        ...organization,
        itemNamePolicy: itemNamePolicy(),
      };
      EBUS.emit("notify-message", "info", eaglePlanCompactSummary(plan), 5000);
      if (shouldConfirmImportPlan(plan)) {
        const confirmed = await this.panel.confirmEagleImportPlan(eaglePlanCompactParts(plan), eaglePlanHeadline(plan), eaglePlanSummaryParts(plan));
        if (!confirmed) {
          cancelled = true;
          EBUS.emit("notify-message", "info", i18n.eagleImportCanceledBeforeWriting.get(), 4000);
          return;
        }
      }
      if (preflight.writable > 0) await assertEagleLibraryUnchanged(api, connection.library);
      let writeIndex = 0;
      for (const job of jobs) {
        if (!this.downloading || this.importStopRequested) {
          cancelled = true;
          return;
        }
        if (!job.skipReason && !job.preflightError && preflight.writable > 0) {
          writeIndex += 1;
          this.panel.setImportProgress(i18n.eagleImportWritingToEagle.get(), writeIndex, preflight.writable);
        }
        await this.writeJob(api, folderIds, job, stats, usedNamesForFolder(folderNames, job.folderKey));
      }
      this.done = stats.failed === 0;
      endStage = eagleImportEndStage(stats);
      this.panel.showEagleImportResult(eagleSummaryParts(stats), stats.failed > 0, eagleImportResultLinks(stats));
      EBUS.emit("notify-message", stats.failed === 0 ? "info" : "error", eagleToastSummary(stats), 10000);
    } catch (error) {
      if (error instanceof Error && error.message === "abort") {
        cancelled = true;
        return;
      }
      recordImportFailure(stats, i18n.eagleSummaryTitle.get(), error);
      this.panel.showEagleImportResult(eagleSummaryParts(stats), true, eagleImportResultLinks(stats));
      EBUS.emit("notify-message", "error", format(i18n.eagleImportFailedToast.get(), { message: eagleImportErrorMessage(error) }), 8000);
    } finally {
      const stopped = cancelled || this.importStopRequested;
      if (stopped) this.showPartialCancellation(stats);
      this.abort(stopped ? "downloadStart" : endStage);
    }
  }

  private assetsForChapter(chapter: Chapter, picked: { picked(index: number): boolean }, directory: string, meta: GalleryMeta, importDate = localDatePrefix()): EagleImportAsset[] {
    if (!chapter || chapter.filteredQueue.length === 0) return [];
    const assets: EagleImportAsset[] = [];

    for (let i = 0; i < chapter.filteredQueue.length; i++) {
      const imf = chapter.filteredQueue[i];
      if (!picked.picked(i) || !isReadyForEagleImport(imf)) continue;
      const baseName = [directory, imf.node.title].filter(Boolean).join(" - ");
      const sourceTags = eagleSourceTags(imf, meta);
      const tags = normalizeEagleItemTags(sourceTags, ADAPTER.conf.eagleMaxSourceTags);
      const folderTags = normalizeEagleTags([], semanticSourceTags(sourceTags), 1000);
      const common = {
        sourceUrl: imf.node.href,
        originUrl: imf.node.originSrc,
        tags,
        website: imf.node.href,
        folderTokens: eagleFolderTokens([...tags, ...folderTags], meta, chapter, directory, importDate),
        sourceTags,
        chapter,
        chapterDirectory: directory,
        meta,
        node: imf.node,
      };
      if (imf.data instanceof SubData) {
        for (const item of imf.data.list) {
          assets.push({
            ...common,
            name: eagleItemName(`${baseName} - ${item.name}`, imf.node.publishedAt),
            data: item.data,
            contentType: item.contentType,
            itemKey: item.name,
          });
        }
      } else {
        assets.push({
          ...common,
          name: eagleItemName(baseName, imf.node.publishedAt),
          data: imf.data,
          contentType: imf.contentType || imf.node.mimeType || "image/jpeg",
        });
      }
    }
    return assets;
  }

  private async isDuplicate(api: EagleWebApi, asset: EagleImportAsset): Promise<boolean> {
    for (const query of duplicateQueries(asset)) {
      this.assertImportActive();
      const items = await api.queryItems(query, 20);
      this.assertImportActive();
      if (items.some(item => isDuplicateItem(item, asset))) return true;
    }
    return false;
  }

  private async preflightJobs(api: EagleWebApi, jobs: EagleImportJob[]): Promise<EagleImportPreflight> {
    this.assertImportActive();
    const preflight: EagleImportPreflight = { writable: 0, sessionSkipped: 0, duplicateSkipped: 0, failed: 0 };
    const plannedKeys = new Set<string>();
    const candidates: EagleImportJob[] = [];
    let checked = 0;
    const reportProgress = () => this.panel.setImportProgress(i18n.eagleImportCheckingEagle.get(), checked, jobs.length);

    for (const job of jobs) {
      this.assertImportActive();
      job.preflightChecked = true;
      if (hasPlannedAssetKey(job.asset, plannedKeys) || isSessionImported(job.asset)) {
        job.skipReason = "session";
        preflight.sessionSkipped += 1;
        checked += 1;
      } else {
        markPlannedAssetKey(job.asset, plannedKeys);
        candidates.push(job);
      }
    }
    reportProgress();

    if (!ADAPTER.conf.eagleSkipDuplicates) {
      this.assertImportActive();
      preflight.writable = candidates.length;
      checked += candidates.length;
      reportProgress();
      return preflight;
    }

    const limit = pLimit(EAGLE_DUPLICATE_CHECK_CONCURRENCY);
    await Promise.all(candidates.map(job => limit(async () => {
      try {
        this.assertImportActive();
        if (await this.isDuplicate(api, job.asset)) {
          job.skipReason = "duplicate";
          preflight.duplicateSkipped += 1;
        } else {
          preflight.writable += 1;
        }
        this.assertImportActive();
      } catch (error) {
        if (this.importStopRequested || (error instanceof Error && error.message === "abort")) throw error;
        job.preflightError = error;
        preflight.failed += 1;
      } finally {
        checked += 1;
        if (!this.importStopRequested) reportProgress();
      }
    })));
    return preflight;
  }

  private assertImportActive(): void {
    if (this.importStopRequested) throw new Error("abort");
  }

  private showPartialCancellation(stats: EagleImportStats): void {
    if (!isPartialImportResult(stats)) return;
    stats.canceled = true;
    this.panel.showEagleImportResult(eagleSummaryParts(stats), stats.failed > 0, eagleImportResultLinks(stats));
    EBUS.emit("notify-message", "info", format(i18n.eagleImportStoppedPartial.get(), {
      imported: stats.imported,
      skipped: stats.skipped,
      failed: stats.failed,
    }), 8000);
  }

  private async writeJob(api: EagleWebApi, folderIds: Map<string, string>, job: EagleImportJob, stats: EagleImportStats, usedNames: Set<string>): Promise<void> {
    const asset = job.asset;
    try {
      this.assertImportActive();
      if (job.preflightError) throw job.preflightError;
      if (job.skipReason) {
        applySkippedJob(stats, job.skipReason, job.finalName || asset.name);
        return;
      }
      if (isSessionImported(asset)) {
        applySkippedJob(stats, "session", job.finalName || asset.name);
        return;
      }
      if (!job.preflightChecked) {
        if (ADAPTER.conf.eagleSkipDuplicates && await this.isDuplicate(api, asset)) {
          applySkippedJob(stats, "duplicate", job.finalName || asset.name);
          return;
        }
      }
      asset.name = job.finalName || createEagleItemName(asset.name, usedNames);
      const jobFolderIds = await this.folderIdsForJob(api, folderIds, job, stats);
      this.assertImportActive();
      const id = await api.addItem(toAddItemInput(asset, jobFolderIds));
      if (!id) throw new Error("Eagle did not return an item ID.");
      recordUniqueLink(stats.itemLinks, asset.name, eagleItemUrl(api, id));
      markSessionImported(asset);
      stats.imported += 1;
    } catch (error) {
      if (this.importStopRequested || (error instanceof Error && error.message === "abort")) throw error;
      recordImportFailure(stats, job.finalName || asset.name, error);
    }
  }

  private jobForAsset(folderTemplate: string, asset: EagleImportAsset): EagleImportJob {
    const folderPaths = resolveEagleFolderPaths(folderTemplate, asset.folderTokens);
    const folderKeys = folderPaths.map(path => path.join("/"));
    return {
      asset,
      folderPaths,
      folderKeys,
      folderKey: folderKeys[0],
    };
  }

  private async folderIdsForJob(api: EagleWebApi, folderIds: Map<string, string>, job: EagleImportJob, stats: EagleImportStats): Promise<string[]> {
    this.assertImportActive();
    stats.folders.push(...job.folderKeys);
    const ids: string[] = [];
    for (let i = 0; i < job.folderPaths.length; i++) {
      this.assertImportActive();
      const folderPath = job.folderPaths[i];
      const folderKey = job.folderKeys[i];
      let folderId = folderIds.get(folderKey);
      if (!folderId) {
        folderId = await ensureFolderPath(api, folderPath);
        this.assertImportActive();
        folderIds.set(folderKey, folderId);
      }
      recordUniqueLink(stats.folderLinks, folderKey, eagleFolderUrl(api, folderId));
      ids.push(folderId);
    }
    return ids;
  }
}

function emptyImportStats(): EagleImportStats {
  return {
    planned: 0,
    imported: 0,
    skipped: 0,
    sessionSkipped: 0,
    duplicateSkipped: 0,
    failed: 0,
    folders: [],
    folderLinks: [],
    itemLinks: [],
    skippedItems: [],
    failures: [],
  };
}

function recordImportFailure(stats: EagleImportStats, label: string, error: unknown): void {
  stats.failed += 1;
  if (stats.failures.length < 20) {
    stats.failures.push(`${label}: ${eagleImportErrorMessage(error)}`);
  }
}

export function eagleImportEndStage(stats: Pick<EagleImportSummaryStats, "failed" | "imported">): EagleImportEndStage {
  if (stats.failed > 0) return "downloadFailed";
  if (stats.imported > 0) return "downloaded";
  return "importNoNewItems";
}

export function isPartialImportResult(stats: Pick<EagleImportSummaryStats, "planned" | "imported" | "skipped" | "failed">): boolean {
  const handled = stats.imported + stats.skipped + stats.failed;
  return handled > 0 && handled < stats.planned;
}

export function eagleImportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  const kind = classifyEagleApiError(error);
  if (kind === "authorization") {
    return format(i18n.eagleImportApiUnauthorized.get(), { message });
  }
  if (kind === "connection") {
    return format(i18n.eagleImportCannotReachApi.get(), { message });
  }
  if (kind === "response") {
    return format(i18n.eagleImportApiInvalidResponse.get(), { message });
  }
  if (kind === "timeout") {
    return format(i18n.eagleImportApiTimedOut.get(), { message });
  }
  return message;
}

export function eagleFolderTemplateForImport(value: unknown): string {
  const template = normalizeEagleFolderTemplate(value);
  if (hasMalformedEagleFolderTokenSyntax(template)) {
    throw new Error(i18n.eagleImportMalformedFolderRule.get());
  }
  return template;
}

export async function assertEagleLibraryUnchanged(api: EagleWebApi, initial: unknown): Promise<void> {
  const initialPath = extractEagleLibraryPath(initial);
  const initialName = extractEagleLibraryName(initial);
  if (!initialPath && !initialName) return;
  const current = await api.libraryInfo();
  const changed = initialPath && current.path
    ? initialPath !== current.path
    : Boolean(initialName && current.name && initialName !== current.name);
  if (!changed) return;
  throw new Error(format(i18n.eagleImportLibraryChanged.get(), {
    before: initialName || i18n.eagleConfigUnknownLibrary.get(),
    after: current.name || i18n.eagleConfigUnknownLibrary.get(),
  }));
}

export function eagleImportResultLinks(stats: Pick<EagleImportStats, "imported" | "folderLinks" | "itemLinks">): EagleImportResultLink[] {
  return stats.imported === 1 ? [...stats.itemLinks, ...stats.folderLinks] : stats.folderLinks;
}

function recordUniqueLink(links: EagleImportResultLink[], label: string, url: string): void {
  if (links.some(link => link.url === url || link.label === label)) return;
  links.push({ label, url });
}

function eagleFolderUrl(api: EagleWebApi, folderId: string): string {
  const url = new URL("/folder", api.baseUrl);
  url.searchParams.set("id", folderId);
  return url.toString();
}

function eagleItemUrl(api: EagleWebApi, itemId: string): string {
  const url = new URL("/item", api.baseUrl);
  url.searchParams.set("id", itemId);
  return url.toString();
}

export function toAddItemInput(asset: EagleImportAsset, folderIds: string[]): AddItemInput {
  const annotation = eagleAnnotationForAsset({
    sourceUrl: asset.sourceUrl,
    originUrl: asset.originUrl,
    itemKey: asset.itemKey,
    authorUrls: [...(asset.node.authorUrls || []), ...(asset.meta.authorUrls || [])],
  });
  return {
    name: asset.name,
    base64: dataUrl(asset.data, asset.contentType),
    url: asset.originUrl,
    website: asset.website,
    folders: folderIds,
    tags: asset.tags,
    ...(annotation ? { annotation } : {}),
  };
}

function dataUrl(data: Uint8Array, contentType: string): string {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return `data:${contentType || "application/octet-stream"};base64,${arrayBufferToBase64(copy.buffer)}`;
}

function eagleItemName(rawTitle: string, publishedAt?: string): string {
  return normalizeEagleItemNameWithDatePrefix(rawTitle, ADAPTER.conf.eagleNameDatePrefix ? publishedAt : undefined);
}

function itemNameSamples(jobs: EagleImportJob[]): string[] {
  return jobs.map(job => job.finalName || job.asset.name);
}

function eaglePlanOrganization(folderTemplate: string, jobs: EagleImportJob[]) {
  const writable = jobs.filter(job => !job.skipReason && !job.preflightError);
  return {
    folders: writable.flatMap(job => job.folderKeys),
    itemNameSamples: itemNameSamples(writable),
    missingFolderTokens: missingFolderTokenCounts(folderTemplate, writable),
    fallbackFolderTokens: fallbackFolderTokenCounts(folderTemplate, writable),
    folderTokenSamples: folderTokenSamples(folderTemplate, writable),
  };
}

function itemNamePolicy(): string {
  return ADAPTER.conf.eagleNameDatePrefix ? i18n.eagleConfigPreviewDateNames.get() : i18n.eagleConfigPreviewSourceNames.get();
}

function format(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function prepareWritableJobNames(jobs: EagleImportJob[]): void {
  const folderNames = new Map<string, Set<string>>();
  for (const job of jobs) {
    if (job.skipReason || job.preflightError) continue;
    job.finalName = createEagleItemName(job.asset.name, usedNamesForFolder(folderNames, job.folderKey));
  }
}

function eagleSourceTags(imf: IMGFetcher, meta: GalleryMeta): string[] {
  return [
    ...[...imf.node.tags].map(tag => tag.toString()),
    ...sourcePublishedAtTags(imf.node.publishedAt),
    ...sourceTagsFromGalleryMeta(meta, imf.node.href),
  ];
}

function eagleFolderTokens(tags: string[], meta: GalleryMeta, chapter: Chapter, chapterDirectory: string, importDate: string): EagleFolderTokens {
  const copyrights = tagValues(tags, "copyright");
  const characters = collapseCharacterFolderValues(tagValues(tags, "character"));
  const authors = tagValues(tags, "author");
  return {
    site: ADAPTER.matcher?.name || location.hostname,
    date: importDate || localDatePrefix(),
    gallery: safeTitle(meta.title || ""),
    chapter: chapterDirectory,
    copyright: shortestTagValue(copyrights),
    character: shortestTagValue(characters),
    author: shortestTagValue(authors),
    copyrights,
    characters,
    authors,
  };
}

function tagValues(tags: string[], prefix: "copyright" | "character" | "author"): string[] {
  const values = tags
    .filter(tag => tag.startsWith(`${prefix}:`))
    .map(tag => cleanFolderTagValue(tag.slice(prefix.length + 1)))
    .filter(Boolean)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  return [...new Set(values)];
}

function shortestTagValue(values: string[]): string {
  return values[0] || "";
}

function usedNamesForFolder(folderNames: Map<string, Set<string>>, folderKey: string): Set<string> {
  let usedNames = folderNames.get(folderKey);
  if (!usedNames) {
    usedNames = new Set<string>();
    folderNames.set(folderKey, usedNames);
  }
  return usedNames;
}

function applySkippedJob(stats: EagleImportStats, reason: EagleImportSkipReason, name: string): void {
  stats.skipped += 1;
  if (reason === "session") stats.sessionSkipped += 1;
  if (reason === "duplicate") stats.duplicateSkipped += 1;
  if (stats.skippedItems.length < 20) stats.skippedItems.push(`${skipReasonLabel(reason)}: ${name}`);
}

function skipReasonLabel(reason: EagleImportSkipReason): string {
  return reason === "duplicate" ? i18n.eagleImportSkipReasonDuplicate.get() : i18n.eagleImportSkipReasonSession.get();
}

function missingFolderTokenCounts(folderTemplate: string, jobs: EagleImportJob[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of METADATA_FOLDER_TOKENS) {
    if (!folderTemplate.includes(`{${token}}`)) continue;
    if (usesCopyrightFolderFallback(folderTemplate) && token === "copyright") continue;
    const missing = jobs.filter(job => folderTokenValues(job.asset.folderTokens, token).length === 0).length;
    if (missing > 0) counts[token] = missing;
  }
  return counts;
}

function fallbackFolderTokenCounts(folderTemplate: string, jobs: EagleImportJob[]): Record<string, number> {
  if (!usesCopyrightFolderFallback(folderTemplate)) return {};
  const count = jobs.filter(job => folderTokenValues(job.asset.folderTokens, "copyright").length === 0).length;
  return count > 0 ? { copyright: count } : {};
}

function folderTokenSamples(folderTemplate: string, jobs: EagleImportJob[]): Record<string, string[]> {
  const samples: Record<string, string[]> = {};
  for (const token of METADATA_FOLDER_TOKENS) {
    if (!folderTemplate.includes(`{${token}}`)) continue;
    samples[token] = jobs.flatMap(job => folderTokenValues(job.asset.folderTokens, token));
  }
  return samples;
}

function folderTokenValues(tokens: EagleFolderTokens, token: typeof METADATA_FOLDER_TOKENS[number]): string[] {
  if (token === "character") return tokens.characters?.length ? tokens.characters : tokens.character ? [tokens.character] : [];
  const value = tokens[token];
  return value ? [value] : [];
}

function usesCopyrightFolderFallback(folderTemplate: string): boolean {
  return normalizeEagleFolderTemplate(folderTemplate) === EAGLE_FOLDER_PRESET_TEMPLATES.copyright;
}

export function limitWritableImportJobs(jobs: EagleImportJob[], value: number): { jobs: EagleImportJob[]; limit: number; selected: number; omittedByLimit: number; writable: number } {
  const limit = normalizeEagleImportLimit(value);
  let writable = 0;
  const limitedJobs = jobs.filter(job => {
    if (job.skipReason || job.preflightError) return true;
    if (writable >= limit) return false;
    writable += 1;
    return true;
  });
  return {
    jobs: limitedJobs,
    limit,
    selected: jobs.length,
    omittedByLimit: Math.max(0, jobs.length - limitedJobs.length),
    writable,
  };
}

function titleToString(title: string | string[]): string {
  return Array.isArray(title) ? title.join("_") : title;
}

function safeTitle(title: string): string {
  return title
    .replaceAll(FILENAME_INVALIDCHAR, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
