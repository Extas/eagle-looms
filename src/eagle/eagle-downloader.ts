import { ADAPTER } from "../platform/adapt";
import { Chapter } from "../page-fetcher";
import { CherryPick, Downloader } from "../download/downloader";
import { GalleryMeta } from "../download/gallery-meta";
import type { DownloaderPanel, DownloaderPanelStage } from "../ui/downloader-panel";
import { FetchState, IMGFetcher } from "../img-fetcher";
import type ImageNode from "../img-node";
import { SubData } from "../platform/platform";
import EBUS from "../event-bus";
import { classifyEagleApiError, EagleWebApi, AddItemInput, extractEagleLibraryName, extractEagleLibraryPath, redactEagleApiSecrets } from "./eagle-web-api";
import { ensureFolderPath } from "./folders";
import { arrayBufferToBase64 } from "./transport";
import { cleanFolderTagValue, collapseCharacterFolderValues, EAGLE_FOLDER_PRESET_TEMPLATES, EagleFolderTokens, findUnknownEagleFolderTokens, hasMalformedEagleFolderTokenSyntax, normalizeEagleBaseUrl, normalizeEagleFolderTemplate, normalizeEagleImportLimit, resolveEagleFolderPaths } from "./options";
import { duplicateQueries, duplicateUrls, hasPlannedAssetKey, isDuplicateItem, isSessionImported, markPlannedAssetKey, markSessionImported } from "./duplicates";
import { normalizeEagleItemTags, normalizeEagleTags, semanticSourceTags, sourcePublishedAtTags, sourceTagsFromGalleryMeta } from "./tags";
import { isReadyForEagleImport } from "./import-readiness";
import { eaglePlanCompactParts, eaglePlanCompactSummary, eaglePlanHeadline, eaglePlanSummaryParts, eagleSummaryParts, eagleToastSummary, EagleImportSummaryStats, shouldConfirmImportPlan } from "./import-summary";
import { createEagleItemName, localDatePrefix, normalizeEagleItemNameWithDatePrefix } from "./naming";
import { i18n } from "../utils/i18n";
import { eagleAnnotationForAsset } from "./annotation";
import { twitterEagleItemBaseName } from "./adapters/twitter";
import { booruEagleItemBaseName } from "./adapters/booru";
import pLimit from "p-limit";

const FILENAME_INVALIDCHAR = /[\\/:*?"<>|\n\t]/g;
const METADATA_FOLDER_TOKENS = ["copyright", "character", "author"] as const;
const EAGLE_DUPLICATE_CHECK_CONCURRENCY = 4;
const MAX_IMPORT_ERROR_MESSAGE_LENGTH = 600;

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
  sourceName: string;
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
  private importRunId = 0;
  private importInFlight = false;

  initEvents(panel: DownloaderPanel) {
    panel.forceBTN.addEventListener("click", () => {
      if (this.downloading) {
        this.abort("downloadStart");
      } else if (this.importInFlight) {
        EBUS.emit("notify-message", "error", i18n.eagleImportAlreadyRunning.get(), 4000);
      } else {
        this.importLoaded();
      }
    });
    panel.startBTN.addEventListener("click", () => {
      if (this.downloading) {
        this.abort("downloadStart");
      } else if (this.importInFlight) {
        EBUS.emit("notify-message", "error", i18n.eagleImportAlreadyRunning.get(), 4000);
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
      console.error("[Eagle Looms]", eagleImportErrorMessage(error));
    } finally {
      this.downloading = false;
    }
  }

  abort(stage: EagleImportEndStage) {
    if (stage === "downloadStart") {
      this.importStopRequested = true;
      this.importRunId = (Number.isFinite(this.importRunId) ? this.importRunId : 0) + 1;
    }
    super.abort(stage);
  }

  async download(chapters: Chapter[]) {
    this.importInFlight = true;
    this.done = false;
    const runId = this.beginImportRun();
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
      stats.selected = selectedJobs.length;
      stats.planned = selectedJobs.length;
      const api = new EagleWebApi(normalizeEagleBaseUrl(ADAPTER.conf.eagleBaseUrl));
      this.panel.setImportProgress(i18n.eagleImportCheckingEagle.get());
      const connection = await api.probe();
      const libraryName = extractEagleLibraryName(connection.library) || i18n.eagleConfigUnknownLibrary.get();
      const sessionLibraryKey = eagleLibrarySessionKey(connection.library, api.baseUrl);
      stats.libraryName = libraryName;
      if (ADAPTER.conf.eagleSkipDuplicates && selectedJobs.length > 1) {
        EBUS.emit("notify-message", "info", i18n.eagleImportCheckingDuplicates.get(), 4000);
      }
      const preflight = await this.preflightJobs(api, selectedJobs, runId, sessionLibraryKey);
      this.assertImportActive(runId);
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
        this.panel.setImportProgress(i18n.eagleImportConfirmTitle.get());
        const confirmed = await this.panel.confirmEagleImportPlan(eaglePlanCompactParts(plan), eaglePlanHeadline(plan), eaglePlanSummaryParts(plan));
        if (!confirmed) {
          cancelled = true;
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
        await this.writeJob(api, folderIds, job, stats, usedNamesForFolder(folderNames, job.folderKey), runId, sessionLibraryKey);
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
      if (stopped) this.showCancellationResult(stats);
      this.abort(stopped ? "downloadStart" : endStage);
      this.importInFlight = false;
    }
  }

  async importOne(chapterIndex: number, index: number): Promise<void> {
    if (this.downloading || this.importInFlight) {
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
    stats.selected = 1;
    stats.planned = 1;
    let cancelled = false;
    let endStage: EagleImportEndStage = "downloadFailed";
    this.done = false;
    this.downloading = true;
    this.importInFlight = true;
    const runId = this.beginImportRun();
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
      const sessionLibraryKey = eagleLibrarySessionKey(connection.library, api.baseUrl);
      stats.libraryName = libraryName;
      const chapterTitle = safeTitle(titleToString(chapter.title));
      const singleChapter = this.pageFetcher.chapters.length === 1;
      const importDate = localDatePrefix();
      const folderIds = new Map<string, string>();
      const folderNames = new Map<string, Set<string>>();
      const assets = this.assetsForChapter(chapter, { picked: current => current === index }, singleChapter ? "" : chapterTitle, this.meta(chapter), importDate);
      stats.selected = assets.length;
      stats.planned = assets.length;
      if (assets.length === 0) throw new Error(i18n.eagleImportCurrentNotReady.get());
      const selectedJobs = assets.map(asset => this.jobForAsset(folderTemplate, asset));
      const preflight = await this.preflightJobs(api, selectedJobs, runId, sessionLibraryKey);
      this.assertImportActive(runId);
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
      EBUS.emit("notify-message", "info", eaglePlanCompactSummary(plan), 5000);
      if (shouldConfirmImportPlan(plan)) {
        this.panel.setImportProgress(i18n.eagleImportConfirmTitle.get());
        const confirmed = await this.panel.confirmEagleImportPlan(eaglePlanCompactParts(plan), eaglePlanHeadline(plan), eaglePlanSummaryParts(plan));
        if (!confirmed) {
          cancelled = true;
          return;
        }
      }
      if (importPlan.writable > 0) await assertEagleLibraryUnchanged(api, connection.library);
      let writeIndex = 0;
      for (const job of jobs) {
        if (!this.downloading || this.importStopRequested) {
          cancelled = true;
          return;
        }
        if (!job.skipReason && !job.preflightError && importPlan.writable > 0) {
          writeIndex += 1;
          this.panel.setImportProgress(i18n.eagleImportWritingToEagle.get(), writeIndex, importPlan.writable);
        }
        await this.writeJob(api, folderIds, job, stats, usedNamesForFolder(folderNames, job.folderKey), runId, sessionLibraryKey);
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
      if (stopped) this.showCancellationResult(stats);
      this.abort(stopped ? "downloadStart" : endStage);
      this.importInFlight = false;
    }
  }

  private assetsForChapter(chapter: Chapter, picked: { picked(index: number): boolean }, directory: string, meta: GalleryMeta, importDate = localDatePrefix()): EagleImportAsset[] {
    if (!chapter || chapter.filteredQueue.length === 0) return [];
    const assets: EagleImportAsset[] = [];

    for (let i = 0; i < chapter.filteredQueue.length; i++) {
      const imf = chapter.filteredQueue[i];
      if (!picked.picked(i) || !isReadyForEagleImport(imf)) continue;
      const sourceTags = eagleSourceTags(imf, meta);
      const sourceBaseName = twitterEagleItemBaseName(directory, imf.node.title, imf.node.href, sourceTags);
      const baseName = booruEagleItemBaseName(sourceBaseName, imf.node.href, sourceTags);
      const tags = normalizeEagleItemTags(sourceTags, ADAPTER.conf.eagleMaxSourceTags);
      const folderTags = normalizeEagleTags([], semanticSourceTags(sourceTags), 1000);
      const common = {
        sourceUrl: imf.node.href,
        originUrl: imf.node.originSrc,
        sourceName: imf.node.title,
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
            sourceName: `${imf.node.title} - ${item.name}`,
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

  private async isDuplicate(api: EagleWebApi, asset: EagleImportAsset, runId = this.importRunId): Promise<boolean> {
    for (const query of duplicateQueries(asset)) {
      this.assertImportActive(runId);
      const items = await api.queryItems(query, 20);
      this.assertImportActive(runId);
      if (items.some(item => isDuplicateItem(item, asset))) return true;
    }
    for (const url of duplicateUrls(asset)) {
      this.assertImportActive(runId);
      const items = await api.itemsByUrl(url);
      this.assertImportActive(runId);
      if (items.some(item => isDuplicateItem(item, asset))) return true;
    }
    return false;
  }

  private async preflightJobs(api: EagleWebApi, jobs: EagleImportJob[], runId = this.importRunId, sessionLibraryKey = ""): Promise<EagleImportPreflight> {
    this.assertImportActive(runId);
    const preflight: EagleImportPreflight = { writable: 0, sessionSkipped: 0, duplicateSkipped: 0, failed: 0 };
    const plannedKeys = new Set<string>();
    const candidates: EagleImportJob[] = [];
    let checked = 0;
    const reportProgress = () => this.panel.setImportProgress(i18n.eagleImportCheckingEagle.get(), checked, jobs.length);

    for (const job of jobs) {
      this.assertImportActive(runId);
      job.preflightChecked = true;
      if (hasPlannedAssetKey(job.asset, plannedKeys) || isSessionImported(job.asset, sessionLibraryKey)) {
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
      this.assertImportActive(runId);
      preflight.writable = candidates.length;
      checked += candidates.length;
      reportProgress();
      return preflight;
    }

    const limit = pLimit(EAGLE_DUPLICATE_CHECK_CONCURRENCY);
    await Promise.all(candidates.map(job => limit(async () => {
      try {
        this.assertImportActive(runId);
        if (await this.isDuplicate(api, job.asset, runId)) {
          job.skipReason = "duplicate";
          preflight.duplicateSkipped += 1;
        } else {
          preflight.writable += 1;
        }
        this.assertImportActive(runId);
      } catch (error) {
        if (this.importStopRequested || (error instanceof Error && error.message === "abort")) throw error;
        job.preflightError = error;
        preflight.failed += 1;
      } finally {
        checked += 1;
        if (!this.importStopRequested && runId === this.importRunId) reportProgress();
      }
    })));
    return preflight;
  }

  private assertImportActive(runId = this.importRunId): void {
    if (this.importStopRequested || runId !== this.importRunId) throw new Error("abort");
  }

  private beginImportRun(): number {
    this.importStopRequested = false;
    this.importRunId = (Number.isFinite(this.importRunId) ? this.importRunId : 0) + 1;
    return this.importRunId;
  }

  private showCancellationResult(stats: EagleImportStats): void {
    if (!hasIncompleteImportResult(stats)) return;
    stats.canceled = true;
    this.panel.showEagleImportResult(eagleSummaryParts(stats), stats.failed > 0, eagleImportResultLinks(stats));
    const handled = stats.imported + stats.skipped + stats.failed;
    const message = handled > 0
      ? format(i18n.eagleImportStoppedPartial.get(), {
        imported: stats.imported,
        skipped: stats.skipped,
        failed: stats.failed,
      })
      : i18n.eagleImportCanceledBeforeWriting.get();
    EBUS.emit("notify-message", "info", message, handled > 0 ? 8000 : 4000);
  }

  private async writeJob(api: EagleWebApi, folderIds: Map<string, string>, job: EagleImportJob, stats: EagleImportStats, usedNames: Set<string>, runId = this.importRunId, sessionLibraryKey = ""): Promise<void> {
    const asset = job.asset;
    try {
      this.assertImportActive(runId);
      if (job.preflightError) throw job.preflightError;
      if (job.skipReason) {
        applySkippedJob(stats, job.skipReason, job.finalName || asset.name);
        return;
      }
      if (isSessionImported(asset, sessionLibraryKey)) {
        applySkippedJob(stats, "session", job.finalName || asset.name);
        return;
      }
      if (!job.preflightChecked) {
        if (ADAPTER.conf.eagleSkipDuplicates && await this.isDuplicate(api, asset, runId)) {
          applySkippedJob(stats, "duplicate", job.finalName || asset.name);
          return;
        }
      }
      asset.name = job.finalName || createEagleItemName(asset.name, usedNames);
      const jobFolderIds = await this.folderIdsForJob(api, folderIds, job, stats, runId);
      this.assertImportActive(runId);
      const id = await api.addItem(toAddItemInput(asset, jobFolderIds));
      if (!id) throw new Error("Eagle did not return an item ID.");
      recordUniqueLink(stats.itemLinks, asset.name, eagleItemUrl(api, id));
      markSessionImported(asset, sessionLibraryKey);
      stats.imported += 1;
      this.assertImportActive(runId);
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

  private async folderIdsForJob(api: EagleWebApi, folderIds: Map<string, string>, job: EagleImportJob, stats: EagleImportStats, runId = this.importRunId): Promise<string[]> {
    this.assertImportActive(runId);
    stats.folders.push(...job.folderKeys);
    const ids: string[] = [];
    for (let i = 0; i < job.folderPaths.length; i++) {
      this.assertImportActive(runId);
      const folderPath = job.folderPaths[i];
      const folderKey = job.folderKeys[i];
      const cacheKey = folderIdentityKey(folderKey);
      let folderId = folderIds.get(cacheKey);
      if (!folderId) {
        folderId = await ensureFolderPath(api, folderPath, () => this.assertImportActive(runId));
        folderIds.set(cacheKey, folderId);
      }
      recordUniqueLink(stats.folderLinks, folderKey, eagleFolderUrl(api, folderId));
      ids.push(folderId);
      this.assertImportActive(runId);
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

export function hasIncompleteImportResult(stats: Pick<EagleImportSummaryStats, "planned" | "imported" | "skipped" | "failed">): boolean {
  const handled = stats.imported + stats.skipped + stats.failed;
  return handled < stats.planned;
}

export function eagleImportErrorMessage(error: unknown): string {
  const message = compactImportErrorText(redactEagleApiSecrets(error instanceof Error ? error.message : String(error || "unknown error")));
  const kind = classifyEagleApiError(error);
  let result = message;
  if (kind === "authorization") {
    result = format(i18n.eagleImportApiUnauthorized.get(), { message });
  } else if (kind === "connection") {
    result = format(i18n.eagleImportCannotReachApi.get(), { message });
  } else if (kind === "response") {
    result = format(i18n.eagleImportApiInvalidResponse.get(), { message });
  } else if (kind === "timeout") {
    result = format(i18n.eagleImportApiTimedOut.get(), { message });
  }
  return compactImportErrorText(result);
}

function compactImportErrorText(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim() || "unknown error";
  return compact.length > MAX_IMPORT_ERROR_MESSAGE_LENGTH
    ? `${compact.slice(0, MAX_IMPORT_ERROR_MESSAGE_LENGTH - 3).trimEnd()}...`
    : compact;
}

export function eagleFolderTemplateForImport(value: unknown): string {
  const template = normalizeEagleFolderTemplate(value);
  if (hasMalformedEagleFolderTokenSyntax(template)) {
    throw new Error(i18n.eagleImportMalformedFolderRule.get());
  }
  const unknownTokens = findUnknownEagleFolderTokens(template);
  if (unknownTokens.length) {
    throw new Error(format(i18n.eagleImportUnknownFolderRule.get(), { tokens: unknownTokens.join(", ") }));
  }
  return template;
}

export async function assertEagleLibraryUnchanged(api: EagleWebApi, initial: unknown): Promise<void> {
  const initialPath = extractEagleLibraryPath(initial);
  const initialName = extractEagleLibraryName(initial);
  if (!initialPath && !initialName) return;
  const current = await api.libraryInfo();
  const changed = initialPath && current.path
    ? !sameEagleLibraryPath(initialPath, current.path)
    : Boolean(initialName && current.name && initialName !== current.name);
  if (!changed) return;
  throw new Error(format(i18n.eagleImportLibraryChanged.get(), {
    before: initialName || i18n.eagleConfigUnknownLibrary.get(),
    after: current.name || i18n.eagleConfigUnknownLibrary.get(),
  }));
}

export function eagleLibrarySessionKey(library: unknown, baseUrl = ""): string {
  const path = extractEagleLibraryPath(library);
  if (path) return `path:${normalizeEagleLibraryPath(path)}`;
  const name = extractEagleLibraryName(library).trim();
  if (name) return `name:${name.normalize("NFKC")}`;
  try {
    return `api:${new URL(baseUrl).origin.toLowerCase()}`;
  } catch {
    return `api:${baseUrl.trim().toLowerCase()}`;
  }
}

function sameEagleLibraryPath(left: string, right: string): boolean {
  const normalizedLeft = normalizeEagleLibraryPath(left);
  const normalizedRight = normalizeEagleLibraryPath(right);
  const windowsPath = /^[a-z]:\//i.test(normalizedLeft) || normalizedLeft.startsWith("//");
  return windowsPath
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function normalizeEagleLibraryPath(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  const windowsPath = /^[a-z]:\//i.test(normalized) || normalized.startsWith("//");
  return windowsPath ? normalized.toLowerCase() : normalized;
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
    tagSamples: writable.flatMap(job => job.asset.tags),
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
  const seen = new Set<string>();
  return values.filter(value => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shortestTagValue(values: string[]): string {
  return values[0] || "";
}

function usedNamesForFolder(folderNames: Map<string, Set<string>>, folderKey: string): Set<string> {
  const cacheKey = folderIdentityKey(folderKey);
  let usedNames = folderNames.get(cacheKey);
  if (!usedNames) {
    usedNames = new Set<string>();
    folderNames.set(cacheKey, usedNames);
  }
  return usedNames;
}

function folderIdentityKey(folderKey: string): string {
  return folderKey.toLowerCase();
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
