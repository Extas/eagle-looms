import { ADAPTER } from "../platform/adapt";
import { Chapter } from "../page-fetcher";
import { CherryPick, Downloader } from "../download/downloader";
import { GalleryMeta } from "../download/gallery-meta";
import { FetchState, IMGFetcher } from "../img-fetcher";
import { SubData } from "../platform/platform";
import EBUS from "../event-bus";
import { EagleWebApi, AddItemInput } from "./eagle-web-api";
import { ensureFolderPath } from "./folders";
import { arrayBufferToBase64 } from "./transport";
import { EagleFolderTokens, normalizeEagleBaseUrl, normalizeEagleFolderTemplate, resolveEagleFolderPath } from "./options";
import { duplicateQueries, isDuplicateItem, isSessionImported, markSessionImported, stableKeyForAsset } from "./duplicates";
import { eagleExtensionTag, normalizeEagleTags } from "./tags";
import { isReadyForEagleImport } from "./import-readiness";
import { eaglePlanSummary, eagleSummary, EagleImportSummaryStats } from "./import-summary";
import { createEagleItemName } from "./naming";

const FILENAME_INVALIDCHAR = /[\\/:*?"<>|\n\t]/g;

type EagleImportStats = EagleImportSummaryStats & {
  folders: string[];
  failures: string[];
  sessionSkipped: number;
};

type EagleImportAsset = {
  name: string;
  data: Uint8Array;
  contentType: string;
  sourceUrl: string;
  originUrl?: string;
  itemKey?: string;
  tags: string[];
  annotation?: string;
  website: string;
  folderTokens: EagleFolderTokens;
};

export class EagleDownloader extends Downloader {
  async download(chapters: Chapter[]) {
    this.done = false;
    const abortable = this.downloading;
    const stats: EagleImportStats = { planned: 0, imported: 0, skipped: 0, sessionSkipped: 0, failed: 0, folders: [], failures: [] };
    const folderIds = new Map<string, string>();
    try {
      this.panel.flushUI("packaging");
      const api = new EagleWebApi(normalizeEagleBaseUrl(ADAPTER.conf.eagleBaseUrl));
      await api.probe();
      const galleryTitle = safeTitle(this.title(chapters));
      const singleChapter = chapters.length === 1;
      const folderTemplate = normalizeEagleFolderTemplate(ADAPTER.conf.eagleFolderPath);
      EBUS.emit("notify-message", "info", eaglePlanSummary({
        folderTemplate,
        sourceTagLimit: ADAPTER.conf.eagleMaxSourceTags,
        skipDuplicates: ADAPTER.conf.eagleSkipDuplicates,
      }), 6000);

      for (let i = 0; i < chapters.length; i++) {
        if (abortable && !this.downloading) throw new Error("abort");
        const chapter = chapters[i];
        const chapterIndex = this.pageFetcher.chapters.indexOf(chapter);
        const chapterTitle = safeTitle(titleToString(chapter.title));
        const picked = this.cherryPicks[chapterIndex] || this.cherryPicks[i] || new CherryPick();
        const meta = this.meta(chapter);
        const assets = this.assetsForChapter(chapter, picked, singleChapter ? "" : chapterTitle, meta);
        stats.planned += assets.length;
        if (assets.length === 0) continue;

        for (const asset of assets) {
          if (abortable && !this.downloading) throw new Error("abort");
          const folderId = await this.folderIdForAsset(api, folderIds, folderTemplate, asset, stats);
          await this.writeAsset(api, folderId, asset, stats);
        }
      }

      if (stats.planned === 0) {
        throw new Error("No fetched images are selected for Eagle import. Load images first or adjust cherry-pick ranges.");
      }
      this.done = stats.failed === 0;
      EBUS.emit("notify-message", this.done ? "info" : "error", eagleSummary(stats), 10000);
    } catch (error: any) {
      if (error === "abort" || error?.message === "abort") return;
      EBUS.emit("notify-message", "error", `Eagle import failed, ${error}`, 10000);
      throw error;
    } finally {
      this.abort(this.done ? "downloaded" : "downloadFailed");
    }
  }

  async importOne(chapterIndex: number, index: number): Promise<void> {
    if (this.downloading) {
      EBUS.emit("notify-message", "error", "Eagle import is already running.", 4000);
      return;
    }
    const chapter = this.pageFetcher.chapters[chapterIndex];
    const imf = chapter?.filteredQueue[index];
    if (!chapter || !imf) {
      EBUS.emit("notify-message", "error", "No image found for Eagle import.", 4000);
      return;
    }

    const stats: EagleImportStats = { planned: 0, imported: 0, skipped: 0, sessionSkipped: 0, failed: 0, folders: [], failures: [] };
    try {
      if (!isReadyForEagleImport(imf)) {
        if (imf.stage === FetchState.FAILED) imf.resetStage();
        EBUS.emit("notify-message", "info", "Fetching current image before Eagle import...", 3000);
        await imf.start();
      }
      if (!isReadyForEagleImport(imf)) {
        throw new Error(imf.failedReason || "Current image is not fetched.");
      }

      const api = new EagleWebApi(normalizeEagleBaseUrl(ADAPTER.conf.eagleBaseUrl));
      await api.probe();
      const chapterTitle = safeTitle(titleToString(chapter.title));
      const singleChapter = this.pageFetcher.chapters.length === 1;
      const folderTemplate = normalizeEagleFolderTemplate(ADAPTER.conf.eagleFolderPath);
      EBUS.emit("notify-message", "info", eaglePlanSummary({
        folderTemplate,
        sourceTagLimit: ADAPTER.conf.eagleMaxSourceTags,
        skipDuplicates: ADAPTER.conf.eagleSkipDuplicates,
      }), 5000);
      const folderIds = new Map<string, string>();
      const assets = this.assetsForChapter(chapter, { picked: current => current === index }, singleChapter ? "" : chapterTitle, this.meta(chapter));
      stats.planned = assets.length;
      if (assets.length === 0) throw new Error("Current image is not ready for Eagle import.");
      for (const asset of assets) {
        const folderId = await this.folderIdForAsset(api, folderIds, folderTemplate, asset, stats);
        await this.writeAsset(api, folderId, asset, stats);
      }
      EBUS.emit("notify-message", stats.failed === 0 ? "info" : "error", eagleSummary(stats), 10000);
    } catch (error) {
      EBUS.emit("notify-message", "error", `Eagle import failed, ${error}`, 8000);
    }
  }

  private assetsForChapter(chapter: Chapter, picked: { picked(index: number): boolean }, directory: string, meta: GalleryMeta): EagleImportAsset[] {
    if (!chapter || chapter.filteredQueue.length === 0) return [];
    const usedNames = new Set<string>();
    const assets: EagleImportAsset[] = [];

    for (let i = 0; i < chapter.filteredQueue.length; i++) {
      const imf = chapter.filteredQueue[i];
      if (!picked.picked(i) || !isReadyForEagleImport(imf)) continue;
      const baseName = [directory, imf.node.title].filter(Boolean).join(" - ");
      const tags = eagleTags(imf, meta, chapter);
      const common = {
        sourceUrl: imf.node.href,
        originUrl: imf.node.originSrc,
        tags,
        website: imf.node.href,
        folderTokens: eagleFolderTokens(tags, meta, chapter, directory),
      };
      if (imf.data instanceof SubData) {
        for (const item of imf.data.list) {
          const name = createEagleItemName(`${baseName} - ${item.name}`, usedNames);
          assets.push({
            ...common,
            name,
            data: item.data,
            contentType: item.contentType,
            itemKey: item.name,
            annotation: eagleAnnotation(imf, meta, chapter, name, item.name),
          });
        }
      } else {
        assets.push({
          ...common,
          name: createEagleItemName(baseName, usedNames),
          data: imf.data,
          contentType: imf.contentType || imf.node.mimeType || "image/jpeg",
          annotation: eagleAnnotation(imf, meta, chapter, baseName),
        });
      }
    }
    return assets;
  }

  private async isDuplicate(api: EagleWebApi, asset: EagleImportAsset): Promise<boolean> {
    for (const query of duplicateQueries(asset)) {
      const items = await api.queryItems(query, 20);
      if (items.some(item => isDuplicateItem(item, asset))) return true;
    }
    return false;
  }

  private async writeAsset(api: EagleWebApi, folderId: string, asset: EagleImportAsset, stats: EagleImportStats): Promise<void> {
    try {
      if (isSessionImported(asset)) {
        stats.skipped += 1;
        stats.sessionSkipped += 1;
        return;
      }
      const duplicate = ADAPTER.conf.eagleSkipDuplicates && await this.isDuplicate(api, asset);
      if (duplicate) {
        stats.skipped += 1;
        return;
      }
      const id = await api.addItem(toAddItemInput(asset, folderId));
      if (!id) throw new Error("Eagle did not return an item ID.");
      markSessionImported(asset);
      stats.imported += 1;
    } catch (error) {
      stats.failed += 1;
      if (stats.failures.length < 20) {
        stats.failures.push(`${asset.name}: ${error}`);
      }
    }
  }

  private async folderIdForAsset(api: EagleWebApi, folderIds: Map<string, string>, folderTemplate: string, asset: EagleImportAsset, stats: EagleImportStats): Promise<string> {
    const folderPath = resolveEagleFolderPath(folderTemplate, asset.folderTokens);
    const folderKey = folderPath.join("/");
    stats.folders.push(folderKey);
    let folderId = folderIds.get(folderKey);
    if (!folderId) {
      folderId = await ensureFolderPath(api, folderPath);
      folderIds.set(folderKey, folderId);
    }
    return folderId;
  }
}

function toAddItemInput(asset: EagleImportAsset, folderId: string): AddItemInput {
  return {
    name: asset.name,
    base64: dataUrl(asset.data, asset.contentType),
    url: asset.originUrl,
    website: asset.website,
    folders: [folderId],
    tags: asset.tags,
    ...(asset.annotation ? { annotation: asset.annotation } : {}),
  };
}

function dataUrl(data: Uint8Array, contentType: string): string {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return `data:${contentType || "application/octet-stream"};base64,${arrayBufferToBase64(copy.buffer)}`;
}

function eagleTags(imf: IMGFetcher, meta: GalleryMeta, chapter: Chapter): string[] {
  const required = [
    "eagle-looms",
    `site:${ADAPTER.matcher?.name || location.hostname}`,
    `chapter:${titleToString(chapter.title)}`,
    meta.title ? `gallery:${meta.title}` : "",
    eagleExtensionTag(imf.node.title, imf.node.originSrc, imf.node.thumbnailSrc),
    imf.contentType || imf.node.mimeType ? `mime:${imf.contentType || imf.node.mimeType}` : "",
  ];
  return normalizeEagleTags(required, [...imf.node.tags].map(tag => tag.toString()), ADAPTER.conf.eagleMaxSourceTags);
}

function eagleFolderTokens(tags: string[], meta: GalleryMeta, chapter: Chapter, chapterDirectory: string): EagleFolderTokens {
  return {
    site: ADAPTER.matcher?.name || location.hostname,
    gallery: safeTitle(meta.title || ""),
    chapter: chapterDirectory,
    copyright: tagValue(tags, "copyright"),
    character: tagValue(tags, "character"),
    author: tagValue(tags, "author"),
  };
}

function tagValue(tags: string[], prefix: "copyright" | "character" | "author"): string {
  const value = tags.find(tag => tag.startsWith(`${prefix}:`))?.slice(prefix.length + 1) || "";
  return safeTitle(value);
}

function eagleAnnotation(imf: IMGFetcher, _meta: GalleryMeta, _chapter: Chapter, _name: string, subName?: string): string | undefined {
  const payload: Record<string, unknown> = {
    schema: "eagle-looms/item/v1",
  };
  if (subName) {
    payload.sourceUrl = imf.node.href;
    payload.originUrl = imf.node.originSrc;
    payload.stableKey = stableKeyForAsset({ sourceUrl: imf.node.href, originUrl: imf.node.originSrc, itemKey: subName });
    payload.itemKey = subName;
  }
  if (imf.node.authorUrls.length) {
    payload.authorUrls = imf.node.authorUrls;
  }
  return Object.keys(payload).length > 1 ? JSON.stringify(payload) : undefined;
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
