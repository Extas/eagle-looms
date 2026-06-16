import type { EagleItem } from "../types";
import { EagleWebApi, type AddItemInput } from "./eagle-web-api";
import { normalizeEagleBaseUrl } from "./options";
import { arrayBufferToBase64, requestArrayBuffer } from "./transport";
import { buildStructuredEagleName } from "./naming";

declare const unsafeWindow: (Window & typeof globalThis) | undefined;

const STORAGE_KEY = "eagle-looms:novelai-bridge";
const DEFAULT_MONITOR_LIMIT = 2;
const MAX_MONITOR_LIMIT = 20;
const NAI_IMPORT_CONFIRM_TIMEOUT_MS = 2200;
const PANEL_ID = "eagle-looms-novelai-bridge";
const NAI_DEBUG_PREFIX = "[Eagle Looms][NovelAI]";
const NAI_DEBUG_STORAGE_KEY = "eagle-looms:novelai-debug";
const NAI_PAGE_BRIDGE_KEY = "__EagleLoomsNovelAiBridgeV2";
const BRIDGE_SCHEMA = "eagle-looms/novelai-bridge/v1";
const NOVELAI_TOOL_TAG = "tool:novelai";
const NON_SEMANTIC_INHERITED_TAG_PREFIXES = [
  "site:",
  "gallery:",
  "chapter:",
  "ext:",
  "mime:",
  "source:published:",
];

interface NovelAiBridgeConfig {
  eagleBaseUrl: string;
  monitorEnabled: boolean;
  monitorLimit: number;
}

export interface NovelAiSourceContext {
  id: string;
  title: string;
  url: string;
  site: string;
  tags?: string[];
  folders?: string[];
  metadata?: Record<string, string>;
}

interface BridgeElements {
  root: HTMLElement;
  body: HTMLElement;
  apiInput: HTMLInputElement;
  urlInput: HTMLInputElement;
  importButton: HTMLButtonElement;
  monitorButton: HTMLButtonElement;
  monitorLimitInput: HTMLInputElement;
  settingsButton: HTMLButtonElement;
  settingsPanel: HTMLElement;
  status: HTMLElement;
  source: HTMLElement;
}

interface PasteDispatchSummary {
  confirmed: boolean;
  pageBridge: boolean;
  clipboard: boolean;
  reactInputs: number;
  fileInputs: number;
  pasteTargets: number;
  dropTargets: number;
  traceId?: string;
  pageBridgeError?: string;
  clipboardError?: string;
}

interface NovelAiPageImportSummary {
  confirmed: boolean;
  inputs: number;
  inputHandlers: number;
  inputEvents: number;
  initialDropTargets: number;
  activeDropTargets: number;
  dropHandlers: number;
  domDrops: number;
  error?: string;
}

interface NovelAiPageBridge {
  version: number;
  importImage(payload: {
    traceId: string;
    fileName: string;
    type: string;
    dataUrl: string;
    debug?: boolean;
  }): Promise<NovelAiPageImportSummary>;
  readImage?(payload: {
    traceId: string;
    src: string;
    fallbackType?: string;
    debug?: boolean;
  }): Promise<NovelAiPageImageReadSummary>;
}

interface NovelAiPageImageReadSummary {
  dataUrl?: string;
  type?: string;
  size?: number;
  error?: string;
}

interface NovelAiResultImageData {
  dataUrl: string;
  contentType: string;
  size: number;
  via: "page-bridge" | "fetch";
}

const NOVEL_AI_PAGE_BRIDGE_SOURCE = String.raw`
(() => {
  const KEY = "__EagleLoomsNovelAiBridgeV2";
  const VERSION = 2;
  if (window[KEY]?.version === VERSION) return;
  const PREFIX = "[Eagle Looms][NovelAI/page]";
  let debugEnabled = false;
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const log = (traceId, step, details, level = "info") => {
    if (level === "info" && !debugEnabled) return;
    try {
      (console[level] || console.info).call(console, PREFIX, traceId, step, details || "");
    } catch {
      // Ignore console failures.
    }
  };
  const unique = (values) => Array.from(new Set(values.filter(Boolean)));
  const isTextEntry = (element) => {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement && element.type !== "file") return true;
    if (element.isContentEditable) return true;
    return element.getAttribute("role") === "textbox";
  };
  const acceptsImageFiles = (input) => {
    const accept = String(input.accept || "").trim().toLowerCase();
    return !accept || accept.includes("image") || accept.includes(".png") || accept.includes(".jpg") || accept.includes(".jpeg") || accept.includes(".webp");
  };
  const snapshotImages = () => new Set(Array.from(document.querySelectorAll("img")).map((img) => img.currentSrc || img.src).filter(Boolean));
  const imageSources = () => Array.from(document.querySelectorAll("img")).map((img) => img.currentSrc || img.src).filter(Boolean);
  const waitForNewImage = async (baseline, timeoutMs) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (imageSources().some((src) => !baseline.has(src))) return true;
      await sleep(80);
    }
    return false;
  };
  const dataUrlToBlob = (dataUrl, fallbackType) => {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl);
    if (!match) throw new Error("invalid data url");
    const type = match[1] || fallbackType || "image/png";
    const body = match[2] || "";
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type });
  };
  const blobToDataUrl = (blob, fallbackType) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("cannot read image blob"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) resolve(result);
      else reject(new Error("empty image data url"));
    };
    reader.readAsDataURL(blob.type ? blob : new Blob([blob], { type: fallbackType || "image/png" }));
  });
  const reactPropsList = (element) => {
    const list = [];
    for (const key of Object.getOwnPropertyNames(element)) {
      if (key.startsWith("__reactProps$")) {
        const props = element[key];
        if (props) list.push(props);
      }
      if (key.startsWith("__reactFiber$")) {
        let fiber = element[key];
        for (let depth = 0; fiber && depth < 6; depth += 1, fiber = fiber.return) {
          if (fiber.memoizedProps) list.push(fiber.memoizedProps);
        }
      }
    }
    return list;
  };
  const reactHandler = (element, name) => {
    for (const props of reactPropsList(element)) {
      const candidate = props?.[name];
      if (typeof candidate === "function") return candidate;
    }
    return undefined;
  };
  const eventBase = (type, target, nativeEvent, extras) => ({
    type,
    target,
    currentTarget: target,
    nativeEvent,
    preventDefault: () => nativeEvent.preventDefault?.(),
    stopPropagation: () => nativeEvent.stopPropagation?.(),
    isDefaultPrevented: () => Boolean(nativeEvent.defaultPrevented),
    isPropagationStopped: () => false,
    persist: () => undefined,
    ...extras,
  });
  const setInputFiles = (input, file) => {
    const data = new DataTransfer();
    data.items.add(file);
    Object.defineProperty(input, "files", { configurable: true, value: data.files });
    return data;
  };
  const tryInputs = async (file, baseline, summary, traceId) => {
    const inputs = Array.from(document.querySelectorAll("input[type='file']")).filter(acceptsImageFiles);
    summary.inputs = inputs.length;
    log(traceId, "input candidates", { inputs: inputs.length });
    for (const input of inputs) {
      setInputFiles(input, file);
      const handler = reactHandler(input, "onChange");
      if (handler) {
        const nativeEvent = new Event("change", { bubbles: true, cancelable: true, composed: true });
        summary.inputHandlers += 1;
        log(traceId, "calling input onChange", { input: input.outerHTML.slice(0, 180) });
        await Promise.resolve(handler(eventBase("change", input, nativeEvent, {})));
        if (await waitForNewImage(baseline, 900)) return true;
      }
      input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true, composed: true }));
      input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true, composed: true }));
      summary.inputEvents += 2;
      if (await waitForNewImage(baseline, 900)) return true;
    }
    return false;
  };
  const dragEvent = (type, data) => {
    try {
      return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data });
    } catch {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { configurable: true, value: data });
      return event;
    }
  };
  const queryDropTargets = () => unique([
    ...Array.from(document.querySelectorAll("[class*='drop' i], [class*='upload' i], [data-testid*='upload' i], [aria-label*='image' i], [aria-label*='upload' i]")),
    document.querySelector("main"),
    document.body,
  ]).filter((element) => element && !isTextEntry(element));
  const isVisibleUploadSurface = (element) => {
    if (!element || isTextEntry(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
    const opacity = Number(style.opacity);
    return !Number.isFinite(opacity) || opacity > 0.05;
  };
  const activeDropTargets = (initialTargets) => {
    const elements = Array.from(document.querySelectorAll("body *"));
    return unique([
      ...elements.filter((element) => Boolean(reactHandler(element, "onDrop"))),
      ...elements.filter(isVisibleUploadSurface),
      ...queryDropTargets(),
      ...initialTargets,
    ]);
  };
  const tryDrops = async (file, baseline, summary, traceId) => {
    const initialTargets = queryDropTargets();
    summary.initialDropTargets = initialTargets.length;
    const data = new DataTransfer();
    data.items.add(file);
    log(traceId, "drop initial targets", { targets: initialTargets.length });
    for (const target of initialTargets) {
      target.dispatchEvent(dragEvent("dragenter", data));
      target.dispatchEvent(dragEvent("dragover", data));
    }
    await sleep(180);
    const targets = activeDropTargets(initialTargets);
    summary.activeDropTargets = targets.length;
    log(traceId, "drop active targets", { targets: targets.length });
    for (const target of targets) {
      const handler = reactHandler(target, "onDrop");
      if (!handler) continue;
      const nativeEvent = dragEvent("drop", data);
      summary.dropHandlers += 1;
      log(traceId, "calling drop onDrop", {
        tag: target.tagName,
        className: String(target.className || "").slice(0, 120),
      });
      await Promise.resolve(handler(eventBase("drop", target, nativeEvent, { dataTransfer: data })));
      if (await waitForNewImage(baseline, 900)) return true;
    }
    for (const target of targets.slice(0, 16)) {
      target.dispatchEvent(dragEvent("dragover", data));
      target.dispatchEvent(dragEvent("drop", data));
      summary.domDrops += 1;
    }
    return await waitForNewImage(baseline, 1200);
  };
  window[KEY] = {
    version: VERSION,
    async importImage(payload) {
      const previousDebug = debugEnabled;
      debugEnabled = Boolean(payload.debug);
      const summary = {
        confirmed: false,
        inputs: 0,
        inputHandlers: 0,
        inputEvents: 0,
        initialDropTargets: 0,
        activeDropTargets: 0,
        dropHandlers: 0,
        domDrops: 0,
      };
      try {
        const baseline = snapshotImages();
        const blob = dataUrlToBlob(payload.dataUrl, payload.type);
        const file = new File([blob], payload.fileName, { type: blob.type || payload.type || "image/png" });
        log(payload.traceId, "bridge import start", {
          fileName: file.name,
          type: file.type,
          size: file.size,
          baselineImages: baseline.size,
        });
        summary.confirmed = await tryInputs(file, baseline, summary, payload.traceId);
        if (!summary.confirmed) summary.confirmed = await tryDrops(file, baseline, summary, payload.traceId);
        log(payload.traceId, "bridge import done", summary, summary.confirmed ? "info" : "warn");
      } catch (error) {
        summary.error = error instanceof Error ? error.message : String(error);
        log(payload.traceId, "bridge import error", summary, "warn");
      } finally {
        debugEnabled = previousDebug;
      }
      return summary;
    },
    async readImage(payload) {
      const previousDebug = debugEnabled;
      debugEnabled = Boolean(payload.debug);
      const summary = {};
      try {
        log(payload.traceId, "read image start", { src: String(payload.src || "").slice(0, 140) });
        const response = await fetch(payload.src);
        if (!response.ok) throw new Error(response.status + " " + response.statusText);
        const blob = await response.blob();
        summary.type = blob.type || payload.fallbackType || "image/png";
        summary.size = blob.size;
        summary.dataUrl = await blobToDataUrl(blob, summary.type);
        log(payload.traceId, "read image done", {
          type: summary.type,
          size: summary.size,
          dataUrlChars: summary.dataUrl.length,
        });
      } catch (error) {
        summary.error = error instanceof Error ? error.message : String(error);
        log(payload.traceId, "read image error", summary, "warn");
      } finally {
        debugEnabled = previousDebug;
      }
      return summary;
    },
  };
})();
`;

let currentBridge: NovelAiEagleBridge | undefined;

export function initNovelAiEagleBridge(): boolean {
  if (!isNovelAiImageToolsUrl()) {
    currentBridge?.destroy();
    currentBridge = undefined;
    return false;
  }
  if (window.self !== window.top) return true;
  if (!currentBridge) {
    currentBridge = new NovelAiEagleBridge();
    currentBridge.mount();
  }
  return true;
}

export function isNovelAiImageToolsUrl(href = typeof location === "undefined" ? "" : location.href): boolean {
  try {
    const url = new URL(href);
    return url.hostname === "novelai.net" && /^\/imagetools\/?/.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseEagleItemId(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const id = url.searchParams.get("id") || "";
    if (id) return id.trim();
  } catch {
    // Raw Eagle ids are accepted below.
  }
  const queryId = raw.match(/[?&]id=([^&#\s]+)/i)?.[1];
  if (queryId) return decodeURIComponent(queryId).trim();
  return raw.replace(/^eagle:\/\//i, "").trim();
}

export function eagleItemLink(baseUrl: string, id: string): string {
  const url = new URL("/item", normalizeEagleBaseUrl(baseUrl));
  url.searchParams.set("id", id);
  return url.toString();
}

export function eagleItemIdFromSourceUrl(value: string, baseUrl: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const eagle = new URL(normalizeEagleBaseUrl(baseUrl));
    if (url.origin !== eagle.origin || !/^\/item\/?$/i.test(url.pathname)) return "";
    return url.searchParams.get("id")?.trim() || "";
  } catch {
    return "";
  }
}

export function normalizeMonitorLimit(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MONITOR_LIMIT;
  return Math.min(MAX_MONITOR_LIMIT, Math.max(1, parsed));
}

export function novelAiSourceFromUrl(value: string): NovelAiSourceContext | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (!["http:", "https:"].includes(url.protocol)) return undefined;
  url.hash = "";

  const site = canonicalSourceSite(url.hostname);
  const parts = url.pathname.split("/").filter(Boolean).map((part) => safeDecodeURIComponent(part));
  const twitter = twitterSourceInfo(site, parts);
  if (twitter) {
    return {
      id: twitter.id,
      title: twitter.title,
      url: url.toString(),
      site,
      tags: [`site:${site}`, `author:${twitter.author}`],
      metadata: {
        sourceAuthor: twitter.author,
        sourceWorkId: twitter.workId,
      },
    };
  }

  const pixiv = pixivSourceInfo(site, parts);
  if (pixiv) {
    return {
      id: pixiv.id,
      title: pixiv.title,
      url: url.toString(),
      site,
      tags: [`site:${site}`],
      metadata: {
        sourceWorkId: pixiv.workId,
      },
    };
  }

  const mediaId = mediaIdFromUrl(url, parts);
  return {
    id: `${site}-${mediaId}`,
    title: `${site} ${mediaId}`.trim(),
    url: url.toString(),
    site,
    tags: [`site:${site}`],
    metadata: mediaId !== "url" ? { sourceWorkId: mediaId } : undefined,
  };
}

export function novelAiSourceFromEagleItem(item: EagleItem, itemLink: string): NovelAiSourceContext {
  const sourceUrl = validHttpUrl(item.url) || validHttpUrl(item.website) || itemLink;
  const site = sourceUrl === itemLink ? "eagle" : canonicalSourceSite(new URL(sourceUrl).hostname);
  const title = (item.name || item.id).replace(/\.[a-z0-9]{1,12}$/i, "") || item.id;
  const inheritedTags = (item.tags || []).filter(isUsefulInheritedTag);
  const siteTags = site === "eagle" ? [] : [`site:${site}`];
  return {
    id: item.id,
    title,
    url: sourceUrl,
    site,
    folders: unique(item.folders || []),
    tags: unique([...siteTags, ...inheritedTags]),
    metadata: {
      sourceItemId: item.id,
      sourceItemName: item.name || item.id,
      sourceItemLink: itemLink,
    },
  };
}

export function eagleItemImageCandidates(item: EagleItem, baseUrl: string): string[] {
  const candidates: string[] = [];
  const add = (value: unknown, requireImageLike = false) => {
    if (typeof value !== "string" || !value.trim()) return;
    const url = absoluteMaybe(value.trim(), baseUrl);
    if (!url || !isFetchableUrl(url)) return;
    if (requireImageLike && !looksLikeImageUrl(url)) return;
    candidates.push(url);
  };

  add(item.fileURL);
  add(item.fileUrl);
  for (const url of annotationImageCandidates(item.annotation)) add(url);
  add(item.url, true);
  add(item.website, true);
  add(item.thumbnailURL);
  add(item.thumbnailUrl);
  return unique(candidates);
}

function annotationImageCandidates(annotation: unknown): string[] {
  if (typeof annotation !== "string" || !annotation.trim()) return [];
  const values: string[] = [];
  try {
    const parsed = JSON.parse(annotation) as Record<string, unknown>;
    addAnnotationUrl(values, parsed.originUrl);
    addAnnotationUrl(values, parsed.originalUrl);
    addAnnotationUrl(values, parsed.imageUrl);
    addAnnotationUrl(values, parsed.mediaUrl);
    addAnnotationUrl(values, parsed.downloadUrl);
    addAnnotationUrl(values, parsed.url);
    addAnnotationUrl(values, parsed.sourceUrl, true);
    if (Array.isArray(parsed.imageUrls)) parsed.imageUrls.forEach((url) => addAnnotationUrl(values, url));
    if (Array.isArray(parsed.mediaUrls)) parsed.mediaUrls.forEach((url) => addAnnotationUrl(values, url));
    addAnnotationUrlsFromText(values, JSON.stringify(parsed));
  } catch {
    addAnnotationUrlsFromText(values, annotation);
  }
  return unique(values);
}

function addAnnotationUrlsFromText(values: string[], text: string): void {
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>|\\]+/g)) addAnnotationUrl(values, match[0]);
}

function addAnnotationUrl(values: string[], value: unknown, requireImageLike = false): void {
  if (typeof value !== "string" || !value.trim()) return;
  const url = value.trim();
  if (!isFetchableUrl(url)) return;
  if (requireImageLike && !looksLikeImageUrl(url)) return;
  if (!requireImageLike && !looksLikeImageUrl(url) && !isKnownImageCdnUrl(url)) return;
  values.push(url);
}

function isKnownImageCdnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /(^|\.)pbs\.twimg\.com$/i.test(parsed.hostname) || parsed.searchParams.has("format");
  } catch {
    return false;
  }
}

export function buildNovelAiGeneratedItemInput(options: {
  source: NovelAiSourceContext;
  pageUrl: string;
  generatedAt: Date;
  resultIndex: number;
  contentType: string;
  base64: string;
}): AddItemInput {
  const contentType = normalizeImageMime(options.contentType, "image/png");
  const extension = extensionForMime(contentType);
  const name = novelAiGeneratedItemName(options.source, options.generatedAt, options.resultIndex, extension);
  const folders = unique(options.source.folders || []);
  const annotation = JSON.stringify({
    schema: BRIDGE_SCHEMA,
    sourceId: options.source.id,
    sourceTitle: options.source.title,
    sourceUrl: options.source.url,
    sourceSite: options.source.site,
    ...(options.source.metadata || {}),
    novelAiUrl: options.pageUrl,
    generatedAt: options.generatedAt.toISOString(),
  });
  return {
    name,
    base64: ensureDataUrl(options.base64, contentType),
    website: options.source.url,
    ...(folders.length ? { folders } : {}),
    tags: unique([NOVELAI_TOOL_TAG, ...(options.source.tags || [])]),
    annotation,
  };
}

export function novelAiGeneratedTags(sourceTags?: string[]): string[] {
  return unique([
    NOVELAI_TOOL_TAG,
    ...(sourceTags || []).filter(isUsefulInheritedTag),
  ]);
}

class NovelAiEagleBridge {
  private config: NovelAiBridgeConfig = defaultConfig();
  private elements?: BridgeElements;
  private source?: NovelAiSourceContext;
  private monitorObserver?: MutationObserver;
  private monitorActive = false;
  private monitorChecking = false;
  private monitorBaseline = new Set<string>();
  private importedResultSources = new Set<string>();
  private importingResultSources = new Set<string>();
  private importedResultCount = 0;
  private savedResultIds: string[] = [];
  private destroyed = false;

  async mount(): Promise<void> {
    this.config = await loadConfig();
    await domReady();
    if (this.destroyed || !isNovelAiImageToolsUrl()) return;
    this.elements = createPanel(this.config);
    document.body.appendChild(this.elements.root);
    this.bindEvents();
    this.setStatus("Paste a source URL, then Watch. Eagle item import is deferred.");
    this.updateMonitorUi();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopMonitor();
    this.importingResultSources.clear();
    document.getElementById(PANEL_ID)?.remove();
  }

  private bindEvents(): void {
    const elements = this.elements;
    if (!elements) return;

    elements.apiInput.addEventListener("change", () => {
      this.config.eagleBaseUrl = normalizeEagleBaseUrl(elements.apiInput.value);
      elements.apiInput.value = this.config.eagleBaseUrl;
      void saveConfig(this.config);
    });
    elements.urlInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void this.watchSourceUrl();
    });
    elements.importButton.addEventListener("click", () => void this.watchSourceUrl());
    elements.settingsButton.addEventListener("click", () => {
      const open = elements.settingsPanel.dataset.open === "true";
      elements.settingsPanel.dataset.open = open ? "false" : "true";
      if (!open) {
        elements.apiInput.focus();
        elements.apiInput.select();
      }
    });
    elements.monitorButton.addEventListener("click", () => {
      const nextEnabled = !this.config.monitorEnabled;
      if (nextEnabled && !this.source) {
        this.config.monitorEnabled = false;
        void saveConfig(this.config);
        this.setStatus("Paste a source URL before enabling watch.", true);
        this.updateMonitorUi();
        return;
      }
      this.config.monitorEnabled = nextEnabled;
      void saveConfig(this.config);
      if (nextEnabled) {
        this.monitorBaseline = snapshotNovelAiImageSources();
        this.importedResultCount = 0;
        this.savedResultIds = [];
        this.importedResultSources.clear();
        this.importingResultSources.clear();
        this.startMonitor();
      } else {
        this.stopMonitor();
        this.setStatus("Auto monitor is off.");
      }
      this.updateMonitorUi();
    });
    elements.monitorLimitInput.addEventListener("change", () => {
      this.config.monitorLimit = normalizeMonitorLimit(elements.monitorLimitInput.value);
      elements.monitorLimitInput.value = String(this.config.monitorLimit);
      void saveConfig(this.config);
      this.updateMonitorUi();
    });
  }

  private async watchSourceUrl(): Promise<void> {
    const elements = this.elements;
    if (!elements) return;
    const rawSourceUrl = elements.urlInput.value.trim();

    this.setBusy(true);
    this.stopMonitor();
    try {
      this.config.eagleBaseUrl = normalizeEagleBaseUrl(elements.apiInput.value);
      elements.apiInput.value = this.config.eagleBaseUrl;
      this.config.monitorEnabled = true;
      await saveConfig(this.config);

      const source = await this.sourceContextForUrl(rawSourceUrl);
      if (!source) {
        this.setStatus("Paste a valid http(s) source URL.", true);
        return;
      }

      this.source = source;
      elements.urlInput.value = source.url;
      this.renderSource();
      this.monitorBaseline = snapshotNovelAiImageSources();
      this.importedResultSources.clear();
      this.importingResultSources.clear();
      this.importedResultCount = 0;
      this.savedResultIds = [];
      this.startMonitor();
      this.setStatus(`Watching ${source.site}: 0/${this.config.monitorLimit}. Run NovelAI manually.`);
      this.updateMonitorUi();
    } catch (error) {
      this.setStatus(errorMessage(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private startMonitor(): void {
    if (!this.source) {
      this.updateMonitorUi();
      return;
    }
    this.stopMonitor();
    this.monitorActive = true;
    this.monitorObserver = new MutationObserver(() => this.scheduleMonitorCheck());
    this.monitorObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });
    this.setStatus(`Monitoring NovelAI results: 0/${this.config.monitorLimit}.`);
    this.scheduleMonitorCheck();
    this.updateMonitorUi();
  }

  private stopMonitor(): void {
    this.monitorObserver?.disconnect();
    this.monitorObserver = undefined;
    this.monitorActive = false;
    this.updateMonitorUi();
  }

  private scheduleMonitorCheck(): void {
    window.setTimeout(() => void this.checkNovelAiResults(), 250);
    window.setTimeout(() => void this.checkNovelAiResults(), 1200);
  }

  private async checkNovelAiResults(): Promise<void> {
    if (!this.monitorActive || this.monitorChecking || !this.source) return;
    this.monitorChecking = true;
    try {
      const candidates = resultImageSources()
        .filter((src) => !this.monitorBaseline.has(src))
        .filter((src) => !this.importedResultSources.has(src))
        .filter((src) => !this.importingResultSources.has(src));

      for (const src of candidates) {
        if (this.importedResultCount >= this.config.monitorLimit) break;
        try {
          await this.importNovelAiResult(src);
        } catch (error) {
          logNovelAiResult("result import failed", {
            src: shortUrl(src),
            error: errorMessage(error),
          }, "warn");
          debugNovelAi("result", "import failed", {
            src: shortUrl(src),
            error: errorMessage(error),
          }, "warn");
          this.setStatus(`Result import failed: ${errorMessage(error)}`, true);
        }
      }

      if (this.importedResultCount >= this.config.monitorLimit) {
        this.stopMonitor();
        this.setStatus(savedResultsStatus(this.importedResultCount, this.config.monitorLimit, this.savedResultIds));
      }
    } finally {
      this.monitorChecking = false;
      this.updateMonitorUi();
    }
  }

  private async importNovelAiResult(src: string): Promise<void> {
    const source = this.source;
    if (!source) return;
    this.importingResultSources.add(src);
    const traceId = novelAiTraceId();
    try {
      debugNovelAi(traceId, "result candidate", { src: shortUrl(src) });
      const image = await readNovelAiResultImage(src, traceId);
      debugNovelAi(traceId, "result image accepted", {
        src: shortUrl(src),
        via: image.via,
        type: image.contentType,
        size: image.size,
      });
      const input = buildNovelAiGeneratedItemInput({
        source,
        pageUrl: location.href,
        generatedAt: new Date(),
        resultIndex: this.importedResultCount + 1,
        contentType: image.contentType,
        base64: image.dataUrl,
      });
      debugNovelAi(traceId, "result eagle input", {
        name: input.name,
        folders: input.folders?.length || 0,
        tags: input.tags?.length || 0,
        contentType: image.contentType,
        dataUrlChars: image.dataUrl.length,
      });
      logNovelAiResult("eagle add input", {
        name: input.name,
        website: input.website,
        folders: input.folders || [],
        folderCount: input.folders?.length || 0,
        tags: input.tags || [],
        sourceTitle: source.title,
        contentType: image.contentType,
        dataUrlChars: image.dataUrl.length,
      });
      const api = new EagleWebApi(this.config.eagleBaseUrl);
      const id = await api.addItem(input);
      this.importedResultSources.add(src);
      if (id) this.savedResultIds.push(id);
      this.importedResultCount += 1;
      logNovelAiResult("result saved", {
        id: id || "(no id returned)",
        name: input.name,
        folders: input.folders || [],
        source: source.title,
      });
      this.setStatus(`Saved result ${this.importedResultCount}/${this.config.monitorLimit}${id ? `: ${id}` : ""}.`);
    } finally {
      this.importingResultSources.delete(src);
    }
  }

  private async sourceContextForUrl(value: string): Promise<NovelAiSourceContext | undefined> {
    const itemId = eagleItemIdFromSourceUrl(value, this.config.eagleBaseUrl);
    if (itemId) {
      const api = new EagleWebApi(this.config.eagleBaseUrl);
      const item = await api.itemInfo(itemId);
      const source = novelAiSourceFromEagleItem(item, eagleItemLink(this.config.eagleBaseUrl, item.id));
      logNovelAiResult("source resolved from Eagle item", {
        input: shortUrl(value),
        itemId: item.id,
        itemName: item.name || "",
        sourceTitle: source.title,
        sourceUrl: source.url,
        targetFolders: source.folders || [],
        targetFolderCount: source.folders?.length || 0,
        tags: source.tags || [],
      });
      return source;
    }
    const source = novelAiSourceFromUrl(value);
    if (source) {
      logNovelAiResult("source resolved from URL", {
        input: shortUrl(value),
        sourceTitle: source.title,
        sourceUrl: source.url,
        targetFolders: source.folders || [],
        targetFolderCount: source.folders?.length || 0,
        tags: source.tags || [],
      });
    }
    return source;
  }

  private renderSource(): void {
    const elements = this.elements;
    if (!elements || !this.source) return;
    const folders = this.source.folders || [];
    const target = folders.length ? `${folders.length} folder(s)` : "no target folder";
    elements.source.textContent = `Source: ${this.source.title} | Target: ${target}`;
    elements.source.title = folders.length ? `Target folders: ${folders.join(", ")}` : "No target folders; Eagle will use its default location.";
  }

  private setBusy(busy: boolean): void {
    const elements = this.elements;
    if (!elements) return;
    elements.importButton.disabled = busy;
    elements.importButton.textContent = busy ? "..." : "Watch";
  }

  private setStatus(message: string, isError = false): void {
    const elements = this.elements;
    if (!elements) return;
    elements.status.textContent = message;
    elements.status.dataset.state = isError ? "error" : "ok";
  }

  private updateMonitorUi(): void {
    const elements = this.elements;
    if (!elements) return;
    elements.monitorButton.textContent = this.config.monitorEnabled ? "Watch On" : "Watch Off";
    elements.monitorButton.dataset.enabled = this.config.monitorEnabled ? "true" : "false";
    elements.monitorButton.title = this.monitorActive
      ? `Active, imported ${this.importedResultCount}/${this.config.monitorLimit}`
      : `Armed for ${this.config.monitorLimit} result(s) after each source import`;
  }
}

function createPanel(config: NovelAiBridgeConfig): BridgeElements {
  document.getElementById(PANEL_ID)?.remove();
  const root = document.createElement("section");
  root.id = PANEL_ID;
  root.innerHTML = `
    <style>
      #${PANEL_ID} {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        width: min(680px, calc(100vw - 20px));
        max-width: calc(100vw - 20px);
        box-sizing: border-box;
        padding: 5px 6px;
        border: 1px solid rgba(0, 0, 0, 0.24);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.96);
        color: #111;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
        font: 11px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .el-nai-main {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
      }
      #${PANEL_ID} strong {
        flex: 0 0 auto;
        font-size: 12px;
        white-space: nowrap;
        margin-right: 4px;
      }
      #${PANEL_ID} label {
        display: flex;
        gap: 4px;
        align-items: center;
        margin: 0;
        font-weight: 600;
      }
      #${PANEL_ID} .el-nai-url {
        flex: 1 1 260px;
        min-width: 180px;
      }
      #${PANEL_ID} .el-nai-url span {
        flex: 0 0 auto;
      }
      #${PANEL_ID} input {
        width: 100%;
        min-height: 22px;
        border: 1px solid #bbb;
        border-radius: 4px;
        padding: 2px 4px;
        font: inherit;
        background: #fff;
        color: #111;
      }
      #${PANEL_ID} input[data-el="limit"] {
        width: 40px;
        flex: 0 0 40px;
        text-align: center;
      }
      #${PANEL_ID} button {
        min-height: 22px;
        border: 1px solid #222;
        border-radius: 4px;
        padding: 2px 5px;
        background: #f6f6f6;
        color: #111;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }
      #${PANEL_ID} button:disabled {
        cursor: wait;
        opacity: 0.65;
      }
      #${PANEL_ID} button[data-el="settings"] {
        width: 34px;
        flex: 0 0 34px;
        padding: 2px 3px;
      }
      #${PANEL_ID} button[data-enabled="true"] {
        background: #e7f6ec;
        border-color: #257a3e;
      }
      #${PANEL_ID} .el-nai-subline {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
        min-width: 0;
      }
      #${PANEL_ID} .el-nai-source {
        flex: 1 1 auto;
        min-width: 0;
        color: #333;
        overflow-wrap: anywhere;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${PANEL_ID} .el-nai-status {
        flex: 0 1 auto;
        min-width: 110px;
        max-width: 50%;
        color: #2d5a32;
        overflow-wrap: anywhere;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${PANEL_ID} .el-nai-status[data-state="error"] { color: #a01818; }
      #${PANEL_ID} .el-nai-settings {
        display: none;
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        width: min(320px, calc(100vw - 20px));
        padding: 8px;
        border: 1px solid rgba(0, 0, 0, 0.24);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
      }
      #${PANEL_ID} .el-nai-settings[data-open="true"] {
        display: block;
      }
      #${PANEL_ID} .el-nai-settings label {
        align-items: stretch;
        flex-direction: column;
        gap: 5px;
      }
      @media (max-width: 520px) {
        #${PANEL_ID} {
          left: 10px;
          right: 10px;
          width: auto;
        }
        #${PANEL_ID} .el-nai-main {
          flex-wrap: wrap;
        }
        #${PANEL_ID} .el-nai-url {
          flex-basis: 100%;
        }
      }
    </style>
    <div class="el-nai-main">
      <strong>Eagle -> NAI</strong>
      <label class="el-nai-url">
        <span>URL</span>
        <input data-el="url" type="url" autocomplete="off" spellcheck="false" placeholder="https://x.com/...">
      </label>
      <button data-el="import" type="button">Watch</button>
      <button data-el="monitor" type="button">Watch On</button>
      <input data-el="limit" type="number" min="1" max="${MAX_MONITOR_LIMIT}" step="1" title="Auto-stop after this many NovelAI result imports">
      <button data-el="settings" type="button" title="Eagle API settings">API</button>
    </div>
    <div class="el-nai-subline">
      <div class="el-nai-source" data-el="source">Eagle item import: later</div>
      <div class="el-nai-status" data-el="status"></div>
    </div>
    <div class="el-nai-settings" data-el="settings-panel" data-open="false">
      <label>
        <span>Eagle API URL</span>
        <input data-el="api" type="url" autocomplete="off" spellcheck="false">
      </label>
    </div>
  `;

  const elements: BridgeElements = {
    root,
    body: root,
    apiInput: root.querySelector<HTMLInputElement>("[data-el='api']")!,
    urlInput: root.querySelector<HTMLInputElement>("[data-el='url']")!,
    importButton: root.querySelector<HTMLButtonElement>("[data-el='import']")!,
    monitorButton: root.querySelector<HTMLButtonElement>("[data-el='monitor']")!,
    monitorLimitInput: root.querySelector<HTMLInputElement>("[data-el='limit']")!,
    settingsButton: root.querySelector<HTMLButtonElement>("[data-el='settings']")!,
    settingsPanel: root.querySelector<HTMLElement>("[data-el='settings-panel']")!,
    status: root.querySelector<HTMLElement>("[data-el='status']")!,
    source: root.querySelector<HTMLElement>("[data-el='source']")!,
  };
  elements.apiInput.value = config.eagleBaseUrl;
  elements.monitorLimitInput.value = String(config.monitorLimit);
  return elements;
}

export async function pasteImageIntoNovelAi(blob: Blob, fileName: string): Promise<PasteDispatchSummary> {
  const traceId = novelAiTraceId();
  const file = pageFile(blob, fileName);
  const baseline = snapshotNovelAiImageSources();
  const summary: PasteDispatchSummary = {
    confirmed: false,
    pageBridge: false,
    clipboard: false,
    reactInputs: 0,
    fileInputs: 0,
    pasteTargets: 0,
    dropTargets: 0,
    traceId,
  };
  debugNovelAi(traceId, "import start", {
    fileName,
    blobType: blob.type || "(empty)",
    blobSize: blob.size,
    baselineImages: baseline.size,
  });

  const pageBridge = await importThroughNovelAiPageBridge(blob, fileName, traceId);
  if (pageBridge) {
    summary.pageBridge = true;
    summary.reactInputs += pageBridge.inputHandlers;
    summary.fileInputs += pageBridge.inputEvents;
    summary.dropTargets += pageBridge.dropHandlers + pageBridge.domDrops;
    summary.pageBridgeError = pageBridge.error;
    debugNovelAi(traceId, "page bridge summary", pageBridge, pageBridge.confirmed ? "info" : "warn");
    if (pageBridge.confirmed) {
      summary.confirmed = true;
      debugNovelAi(traceId, "import confirmed", summary);
      return summary;
    }
  }

  const isolatedReactInputs = dispatchToReactFileInputHandlers(file);
  summary.reactInputs += isolatedReactInputs;
  debugNovelAi(traceId, "isolated react input handlers", { count: isolatedReactInputs });
  if (isolatedReactInputs > 0 && await confirmNovelAiImport(baseline, traceId, "isolated react input")) {
    summary.confirmed = true;
    debugNovelAi(traceId, "import confirmed", summary);
    return summary;
  }

  const isolatedFileInputs = dispatchToFileInputs(file);
  summary.fileInputs += isolatedFileInputs;
  debugNovelAi(traceId, "isolated file input events", { count: isolatedFileInputs });
  if (isolatedFileInputs > 0 && await confirmNovelAiImport(baseline, traceId, "isolated file input")) {
    summary.confirmed = true;
    debugNovelAi(traceId, "import confirmed", summary);
    return summary;
  }

  const isolatedDropTargets = await dispatchDropEvents(file);
  summary.dropTargets += isolatedDropTargets;
  debugNovelAi(traceId, "isolated drop events", { count: isolatedDropTargets });
  if (isolatedDropTargets > 0 && await confirmNovelAiImport(baseline, traceId, "isolated drop")) {
    summary.confirmed = true;
    debugNovelAi(traceId, "import confirmed", summary);
    return summary;
  }

  const isolatedPasteTargets = dispatchPasteEvents(file);
  summary.pasteTargets += isolatedPasteTargets;
  debugNovelAi(traceId, "isolated paste events", { count: isolatedPasteTargets });
  if (isolatedPasteTargets > 0 && await confirmNovelAiImport(baseline, traceId, "isolated paste")) {
    summary.confirmed = true;
    debugNovelAi(traceId, "import confirmed", summary);
    return summary;
  }

  try {
    const clipboardBlob = await toClipboardImageBlob(blob);
    debugNovelAi(traceId, "clipboard fallback prepared", {
      type: clipboardBlob.type || "(empty)",
      size: clipboardBlob.size,
    });
    await writeImageToClipboard(clipboardBlob);
    summary.clipboard = true;
  } catch (error) {
    summary.clipboardError = errorMessage(error);
    debugNovelAi(traceId, "clipboard fallback failed", { error: summary.clipboardError }, "warn");
  }

  if (summary.clipboard) {
    throw new Error(`Image copied to clipboard, but NovelAI did not confirm automatic import. Click the NovelAI upload button or press Ctrl+V. Trace: ${traceId}.`);
  }
  if (summary.dropTargets > 0) {
    const detail = summary.clipboardError ? ` Clipboard fallback is also unavailable: ${summary.clipboardError}` : "";
    throw new Error(`NovelAI opened an image drop target, but did not accept the automatic drop.${detail} Trace: ${traceId}.`.trim());
  }
  const bridgeDetail = summary.pageBridgeError ? ` Page bridge: ${summary.pageBridgeError}` : "";
  throw new Error(`Cannot import image into NovelAI. ${summary.clipboardError || "No compatible NovelAI import target was found."}${bridgeDetail} Trace: ${traceId}.`.trim());
}

async function importThroughNovelAiPageBridge(blob: Blob, fileName: string, traceId: string): Promise<NovelAiPageImportSummary | undefined> {
  const bridge = ensureNovelAiPageBridge(traceId);
  if (!bridge) return undefined;
  const type = normalizeImageMime(blob.type, mimeFromExtension(fileName.split(".").pop() || "") || "image/png");
  const dataUrl = await blobToDataUrl(withImageType(blob, type), type);
  debugNovelAi(traceId, "page bridge payload", {
    fileName,
    type,
    bytes: blob.size,
    dataUrlChars: dataUrl.length,
  });
  try {
    return await bridge.importImage({ traceId, fileName, type, dataUrl, debug: isNovelAiDebugEnabled() });
  } catch (error) {
    const message = errorMessage(error);
    debugNovelAi(traceId, "page bridge failed", { error: message }, "warn");
    return {
      confirmed: false,
      inputs: 0,
      inputHandlers: 0,
      inputEvents: 0,
      initialDropTargets: 0,
      activeDropTargets: 0,
      dropHandlers: 0,
      domDrops: 0,
      error: message,
    };
  }
}

function ensureNovelAiPageBridge(traceId: string): NovelAiPageBridge | undefined {
  const page = pageGlobal() as unknown as Record<string, NovelAiPageBridge | undefined> & {
    Function?: FunctionConstructor;
  };
  const existing = page[NAI_PAGE_BRIDGE_KEY];
  if (existing?.version === 2) return existing;
  try {
    const install = page.Function?.(NOVEL_AI_PAGE_BRIDGE_SOURCE);
    if (typeof install !== "function") throw new Error("page Function constructor is not available");
    install();
  } catch (error) {
    debugNovelAi(traceId, "page bridge install failed", { error: errorMessage(error) }, "warn");
    return undefined;
  }
  const installed = page[NAI_PAGE_BRIDGE_KEY];
  if (installed?.version === 2) return installed;
  debugNovelAi(traceId, "page bridge install failed", { error: "bridge not found after install" }, "warn");
  return undefined;
}

async function writeImageToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image write is not available");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type || "image/png"]: blob }),
  ]);
}

function dispatchToReactFileInputHandlers(file: File): number {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']"))
    .filter((input) => acceptsImageFiles(input));
  let count = 0;
  for (const input of inputs) {
    const handler = reactFileInputChangeHandler(input);
    if (!handler) continue;
    try {
      withInputFiles(input, file, () => handler({
        target: input,
        currentTarget: input,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        nativeEvent: new Event("change"),
      }));
      count += 1;
    } catch {
      // Fall back to DOM events below.
    }
  }
  return count;
}

function reactFileInputChangeHandler(input: HTMLInputElement): ((event: unknown) => unknown) | undefined {
  for (const key of Object.getOwnPropertyNames(input)) {
    if (!key.startsWith("__reactProps$")) continue;
    const candidate = (input as unknown as Record<string, { onChange?: unknown }>)[key]?.onChange;
    if (typeof candidate !== "function") continue;
    const source = Function.prototype.toString.call(candidate);
    if (/FileReader|readAsArrayBuffer/.test(source)) {
      return candidate as (event: unknown) => unknown;
    }
  }
  return undefined;
}

function dispatchToFileInputs(file: File): number {
  if (!pageGlobal().DataTransfer && typeof DataTransfer === "undefined") return 0;
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']"))
    .filter((input) => acceptsImageFiles(input))
    .slice(0, 3);
  let count = 0;
  for (const input of inputs) {
    withInputFiles(input, file, () => {
      input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    });
    count += 1;
  }
  return count;
}

function withInputFiles(input: HTMLInputElement, file: File, run: () => unknown): void {
  const data = new (pageGlobal().DataTransfer || DataTransfer)();
  data.items.add(file);
  Object.defineProperty(input, "files", { configurable: true, value: data.files });
  run();
}

function dispatchPasteEvents(file: File): number {
  if (typeof DataTransfer === "undefined") return 0;
  const targets = pasteTargets();
  let count = 0;
  for (const target of targets) {
    const data = new DataTransfer();
    data.items.add(file);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    target.dispatchEvent(event);
    count += 1;
  }
  return count;
}

async function dispatchDropEvents(file: File): Promise<number> {
  const initialTargets = dropTargets();
  const data = dataTransferWithFile(file);
  if (!data || initialTargets.length === 0) return 0;

  for (const target of initialTargets) {
    dispatchDragEvent(target, "dragenter", data);
    dispatchDragEvent(target, "dragover", data);
  }
  await delay(120);

  const activeTargets = novelAiDropTargets(initialTargets);
  const reactDrops = await dispatchToReactDropHandlers(activeTargets, data);
  if (reactDrops > 0) return reactDrops;

  let count = 0;
  for (const target of activeTargets) {
    dispatchDragEvent(target, "dragover", data);
    dispatchDragEvent(target, "drop", data);
    count += 1;
  }
  return count;
}

function dataTransferWithFile(file: File): DataTransfer | undefined {
  const DataTransferConstructor = pageGlobal().DataTransfer || (typeof DataTransfer === "undefined" ? undefined : DataTransfer);
  if (!DataTransferConstructor) return undefined;
  const data = new DataTransferConstructor();
  data.items.add(file);
  return data;
}

function dispatchDragEvent(target: HTMLElement, type: "dragenter" | "dragover" | "drop", data: DataTransfer): void {
  const page = pageGlobal();
  const DragEventConstructor = page.DragEvent || (typeof DragEvent === "undefined" ? undefined : DragEvent);
  let event: Event;
  if (DragEventConstructor) {
    event = new DragEventConstructor(type, { bubbles: true, cancelable: true, dataTransfer: data });
  } else {
    event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { configurable: true, value: data });
  }
  target.dispatchEvent(event);
}

function novelAiDropTargets(initialTargets: HTMLElement[]): HTMLElement[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter((element) => !element.closest(`#${PANEL_ID}`));
  return uniqueElements([
    ...elements.filter((element) => Boolean(reactDropHandler(element))),
    ...elements.filter(isVisibleUploadSurface),
    ...dropTargets(),
    ...initialTargets,
  ]);
}

function isVisibleUploadSurface(element: HTMLElement): boolean {
  if (isTextEntryElement(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
  const opacity = Number(style.opacity);
  return !Number.isFinite(opacity) || opacity > 0.05;
}

async function dispatchToReactDropHandlers(targets: HTMLElement[], data: DataTransfer): Promise<number> {
  let count = 0;
  for (const target of targets) {
    const handler = reactDropHandler(target);
    if (!handler) continue;
    const nativeEvent = dragEventForReact("drop", data);
    try {
      await Promise.resolve(handler({
        dataTransfer: data,
        target,
        currentTarget: target,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
        nativeEvent,
      }));
      count += 1;
    } catch {
      // DOM drop events below remain the final fallback for this target set.
    }
  }
  return count;
}

function reactDropHandler(element: HTMLElement): ((event: unknown) => unknown) | undefined {
  for (const key of Object.getOwnPropertyNames(element)) {
    if (!key.startsWith("__reactProps$")) continue;
    const candidate = (element as unknown as Record<string, { onDrop?: unknown }>)[key]?.onDrop;
    if (typeof candidate !== "function") continue;
    const source = Function.prototype.toString.call(candidate);
    if (/dataTransfer/.test(source) && /files|items/.test(source)) {
      return candidate as (event: unknown) => unknown;
    }
  }
  return undefined;
}

function dragEventForReact(type: "drop", data: DataTransfer): Event {
  const page = pageGlobal();
  const DragEventConstructor = page.DragEvent || (typeof DragEvent === "undefined" ? undefined : DragEvent);
  if (DragEventConstructor) {
    return new DragEventConstructor(type, { bubbles: true, cancelable: true, dataTransfer: data });
  }
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { configurable: true, value: data });
  return event;
}

function pasteTargets(): HTMLElement[] {
  return uniqueElements([
    ...queryAll("[class*='upload' i], [class*='drop' i], [data-testid*='upload' i], [aria-label*='image' i], [aria-label*='upload' i]"),
    ...queryAll("main, body"),
  ]).filter((element) => !element.closest(`#${PANEL_ID}`) && !isTextEntryElement(element));
}

function dropTargets(): HTMLElement[] {
  return uniqueElements([
    ...queryAll("[class*='drop' i], [class*='upload' i], [data-testid*='upload' i], [aria-label*='image' i]"),
    ...queryAll("main, body"),
  ]).filter((element) => !element.closest(`#${PANEL_ID}`));
}

function queryAll(selector: string): HTMLElement[] {
  try {
    return Array.from(document.querySelectorAll<HTMLElement>(selector));
  } catch {
    return [];
  }
}

function acceptsImageFiles(input: HTMLInputElement): boolean {
  const accept = input.accept.trim().toLowerCase();
  return !accept || accept.includes("image") || accept.includes(".png") || accept.includes(".jpg") || accept.includes(".jpeg") || accept.includes(".webp");
}

function snapshotNovelAiImageSources(): Set<string> {
  return new Set(Array.from(document.querySelectorAll<HTMLImageElement>("img")).map((img) => img.currentSrc || img.src).filter(Boolean));
}

async function confirmNovelAiImport(baseline: Set<string>, traceId?: string, phase = "import"): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < NAI_IMPORT_CONFIRM_TIMEOUT_MS) {
    const sources = resultImageSources();
    if (sources.some(src => !baseline.has(src))) {
      if (traceId) debugNovelAi(traceId, `${phase} confirmed`, { baseline: baseline.size, images: sources.length });
      return true;
    }
    await delay(100);
  }
  if (traceId) debugNovelAi(traceId, `${phase} not confirmed`, { baseline: baseline.size, images: resultImageSources().length }, "warn");
  return false;
}

function resultImageSources(): string[] {
  const sources: string[] = [];
  for (const image of Array.from(document.querySelectorAll<HTMLImageElement>("img"))) {
    if (image.closest(`#${PANEL_ID}`)) continue;
    const src = image.currentSrc || image.src;
    if (!src || sources.includes(src)) continue;
    if (src.startsWith("blob:") || src.startsWith("data:image/") || visibleImageArea(image) >= 4096) {
      sources.push(src);
    }
  }
  return sources;
}

function visibleImageArea(image: HTMLImageElement): number {
  const rect = image.getBoundingClientRect();
  const width = image.naturalWidth || rect.width;
  const height = image.naturalHeight || rect.height;
  if (width <= 0 || height <= 0) return 0;
  if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) return 0;
  return width * height;
}

async function downloadImageBlob(url: string, fallbackType: string): Promise<Blob> {
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const blob = await response.blob();
    return withImageType(blob, fallbackType || mimeFromUrl(url));
  }
  const buffer = await requestArrayBuffer(url);
  return new Blob([buffer], { type: mimeFromUrl(url) || fallbackType || "image/png" });
}

async function readNovelAiResultImage(src: string, traceId: string): Promise<NovelAiResultImageData> {
  const fallbackType = "image/png";
  const pageOwnedUrl = src.startsWith("blob:") || src.startsWith("data:");
  const bridge = pageOwnedUrl ? ensureNovelAiPageBridge(traceId) : undefined;
  if (bridge?.readImage) {
    const summary = await bridge.readImage({
      traceId,
      src,
      fallbackType,
      debug: isNovelAiDebugEnabled(),
    });
    if (summary.dataUrl) {
      const blob = decodeDataUrlToBlob(summary.dataUrl, summary.type || fallbackType);
      const normalized = await normalizeNovelAiResultBlob(blob, src);
      return {
        dataUrl: await blobToDataUrl(normalized.blob, normalized.contentType),
        contentType: normalized.contentType,
        size: normalized.blob.size,
        via: "page-bridge",
      };
    }
    if (summary.error) {
      debugNovelAi(traceId, "page result read failed", {
        src: shortUrl(src),
        error: summary.error,
      }, "warn");
    }
  }

  const blob = await downloadImageBlob(src, fallbackType);
  const normalized = await normalizeNovelAiResultBlob(blob, src);
  return {
    dataUrl: await blobToDataUrl(normalized.blob, normalized.contentType),
    contentType: normalized.contentType,
    size: normalized.blob.size,
    via: "fetch",
  };
}

export async function normalizeNovelAiResultBlob(blob: Blob, url: string): Promise<{ blob: Blob; contentType: string }> {
  const signature = await assertLikelyImageBlob(blob, url);
  const contentType = mimeFromImageSignature(signature) || normalizeImageMime(blob.type, "image/png");
  return {
    blob: forceImageType(blob, contentType),
    contentType,
  };
}

async function assertLikelyImageBlob(blob: Blob, url: string): Promise<string> {
  if (blob.size <= 0) throw new Error("empty image response");
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const signature = imageBlobSignature(header);
  if (signature) return signature;
  const preview = new TextDecoder("utf-8", { fatal: false }).decode(header).trim().slice(0, 32);
  const type = blob.type || mimeFromUrl(url) || "(empty)";
  throw new Error(`response is not a supported image (${type}, ${blob.size} bytes, starts with ${JSON.stringify(preview)})`);
}

function mimeFromImageSignature(signature: string): string {
  if (signature === "jpeg") return "image/jpeg";
  if (signature === "png") return "image/png";
  if (signature === "gif") return "image/gif";
  if (signature === "webp") return "image/webp";
  if (signature === "avif") return "image/avif";
  if (signature === "bmp") return "image/bmp";
  if (signature === "svg") return "image/svg+xml";
  return "";
}

function imageBlobSignature(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 6 && (asciiPrefix(bytes, "GIF87a") || asciiPrefix(bytes, "GIF89a"))) return "gif";
  if (bytes.length >= 12 && asciiPrefix(bytes, "RIFF") && asciiAt(bytes, 8, "WEBP")) return "webp";
  if (bytes.length >= 12 && asciiAt(bytes, 4, "ftyp") && /avif|avis/i.test(asciiSlice(bytes, 8, 16))) return "avif";
  if (bytes.length >= 2 && asciiPrefix(bytes, "BM")) return "bmp";
  if (/^<\?xml|^<svg/i.test(new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim())) return "svg";
  return "";
}

function asciiPrefix(bytes: Uint8Array, prefix: string): boolean {
  return asciiAt(bytes, 0, prefix);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

async function toClipboardImageBlob(blob: Blob): Promise<Blob> {
  const input = withImageType(blob, normalizeImageMime(blob.type, "image/png"));
  if (input.type === "image/png") return input;
  let lastError = "";
  try {
    const bitmap = await createImageBitmap(input);
    try {
      return await canvasToPng(bitmap.width, bitmap.height, (context) => context.drawImage(bitmap, 0, 0));
    } finally {
      bitmap.close();
    }
  } catch (error) {
    lastError = errorMessage(error);
  }

  try {
    const url = URL.createObjectURL(input);
    try {
      const image = await loadImageElement(url);
      return await canvasToPng(image.naturalWidth || image.width, image.naturalHeight || image.height, (context) => context.drawImage(image, 0, 0));
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    const detail = lastError ? `${lastError}; ${errorMessage(error)}` : errorMessage(error);
    throw new Error(`Cannot convert image to PNG for clipboard fallback: ${detail}`);
  }
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = url;
  });
}

async function canvasToPng(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): Promise<Blob> {
  if (width <= 0 || height <= 0) throw new Error("image has no drawable size");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d context is unavailable");
  draw(context);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("canvas export failed"));
    }, "image/png");
  });
}

function withImageType(blob: Blob, fallbackType: string): Blob {
  const type = normalizeImageMime(blob.type, fallbackType);
  if (blob.type === type) return blob;
  return new Blob([blob], { type });
}

function forceImageType(blob: Blob, contentType: string): Blob {
  const type = normalizeImageMime(contentType, "image/png");
  if (blob.type === type) return blob;
  return new Blob([blob], { type });
}

async function blobToDataUrl(blob: Blob, contentType: string): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
}

function decodeDataUrlToBlob(dataUrl: string, fallbackType: string): Blob {
  const match = /^data:([^;,]+)?((?:;[^,]*)?),(.*)$/i.exec(dataUrl);
  if (!match) throw new Error("invalid image data url");
  const contentType = normalizeImageMime(match[1], fallbackType);
  const isBase64 = /;base64/i.test(match[2] || "");
  const body = match[3] || "";
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
}

function novelAiGeneratedItemName(source: NovelAiSourceContext, generatedAt: Date, resultIndex: number, extension: string): string {
  const stem = source.title || source.id;
  const index = String(Math.max(1, resultIndex)).padStart(2, "0");
  return buildStructuredEagleName(`${stem} - NovelAI`, extension, {
    tool: "novelai",
    at: utcCompactTimestamp(generatedAt),
    seq: index,
    src: source.id,
  });
}

function utcCompactTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function defaultConfig(): NovelAiBridgeConfig {
  return {
    eagleBaseUrl: "http://localhost:41595",
    monitorEnabled: true,
    monitorLimit: DEFAULT_MONITOR_LIMIT,
  };
}

async function loadConfig(): Promise<NovelAiBridgeConfig> {
  const fallback = defaultConfig();
  const raw = await readStorage(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<NovelAiBridgeConfig>;
    return {
      eagleBaseUrl: normalizeEagleBaseUrl(parsed.eagleBaseUrl),
      monitorEnabled: typeof parsed.monitorEnabled === "boolean" ? parsed.monitorEnabled : fallback.monitorEnabled,
      monitorLimit: normalizeMonitorLimit(parsed.monitorLimit),
    };
  } catch {
    return fallback;
  }
}

async function saveConfig(config: NovelAiBridgeConfig): Promise<void> {
  await writeStorage(STORAGE_KEY, JSON.stringify({
    eagleBaseUrl: normalizeEagleBaseUrl(config.eagleBaseUrl),
    monitorEnabled: Boolean(config.monitorEnabled),
    monitorLimit: normalizeMonitorLimit(config.monitorLimit),
  }));
}

async function readStorage(key: string): Promise<string | null> {
  try {
    if (typeof GM_getValue === "function") {
      const value = await GM_getValue<string | undefined>(key);
      return typeof value === "string" ? value : null;
    }
  } catch {
    // Fall through to localStorage.
  }
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeStorage(key: string, value: string): Promise<void> {
  try {
    if (typeof GM_setValue === "function") {
      await GM_setValue(key, value);
      return;
    }
  } catch {
    // Fall through to localStorage.
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the session still works.
  }
}

function ensureDataUrl(base64: string, contentType: string): string {
  return base64.startsWith("data:") ? base64 : `data:${contentType};base64,${base64}`;
}

function normalizeImageMime(value: string | undefined, fallback: string): string {
  const type = String(value || "").trim().toLowerCase();
  return type.startsWith("image/") ? type : fallback;
}

function mimeFromUrl(url: string): string {
  try {
    return mimeFromExtension(new URL(url).pathname.split(".").pop() || "");
  } catch {
    return "";
  }
}

function mimeFromExtension(extension: string): string {
  const ext = extension.trim().toLowerCase().replace(/^\./, "");
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";
  return "";
}

function validHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalSourceSite(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/^www\./, "");
  if (host === "twitter.com" || host === "mobile.twitter.com") return "x.com";
  return host || "source";
}

function twitterSourceInfo(site: string, parts: string[]): { id: string; title: string; author: string; workId: string } | undefined {
  if (site !== "x.com") return undefined;
  const statusIndex = parts.findIndex((part) => part.toLowerCase() === "status");
  if (statusIndex <= 0 || !parts[statusIndex + 1]) return undefined;
  const author = cleanSourceToken(parts[statusIndex - 1]) || "user";
  const workId = cleanSourceToken(parts[statusIndex + 1]);
  if (!workId) return undefined;
  return {
    id: `${site}-${workId}`,
    title: `${site} ${author} status ${workId}`,
    author,
    workId,
  };
}

function pixivSourceInfo(site: string, parts: string[]): { id: string; title: string; workId: string } | undefined {
  if (site !== "pixiv.net") return undefined;
  const artworkIndex = parts.findIndex((part) => ["artworks", "artwork"].includes(part.toLowerCase()));
  const workId = artworkIndex >= 0 ? cleanSourceToken(parts[artworkIndex + 1]) : "";
  if (!workId) return undefined;
  return {
    id: `${site}-${workId}`,
    title: `${site} artwork ${workId}`,
    workId,
  };
}

function mediaIdFromUrl(url: URL, parts: string[]): string {
  const last = cleanSourceToken(parts[parts.length - 1]);
  if (last) return last.replace(/\.[a-z0-9]{1,12}$/i, "");
  const imageName = cleanSourceToken(url.searchParams.get("name") || url.searchParams.get("id") || "");
  return imageName || "url";
}

function cleanSourceToken(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._~-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extensionForMime(mimeType: string): string {
  const type = normalizeImageMime(mimeType, "image/png");
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("avif")) return "avif";
  if (type.includes("bmp")) return "bmp";
  if (type.includes("svg")) return "svg";
  return "png";
}

function looksLikeImageUrl(url: string): boolean {
  return url.startsWith("data:image/") || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(url);
}

function isFetchableUrl(url: string): boolean {
  return /^(https?:|blob:|data:)/i.test(url);
}

function absoluteMaybe(value: string, baseUrl: string): string {
  try {
    return new URL(value, normalizeEagleBaseUrl(baseUrl)).toString();
  } catch {
    return "";
  }
}

function shortUrl(url: string): string {
  return url.length > 100 ? `${url.slice(0, 97)}...` : url;
}

function savedResultsStatus(count: number, limit: number, ids: string[]): string {
  const saved = `${count}/${limit}`;
  const visibleIds = ids.filter(Boolean);
  if (!visibleIds.length) return `Saved ${saved} to Eagle.`;
  return `Saved ${saved} to Eagle: ${visibleIds.join(", ")}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isUsefulInheritedTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  if (!normalized || normalized === NOVELAI_TOOL_TAG) return false;
  if (normalized === "eagle-looms") return false;
  return !NON_SEMANTIC_INHERITED_TAG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function novelAiTraceId(): string {
  return `nai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function debugNovelAi(traceId: string, step: string, details?: unknown, level: "info" | "warn" | "error" = "info"): void {
  if (level === "info" && !isNovelAiDebugEnabled()) return;
  try {
    const logger = console[level] || console.info;
    logger.call(console, NAI_DEBUG_PREFIX, traceId, step, details ?? "");
  } catch {
    // Debug logging must never affect import behavior.
  }
}

function logNovelAiResult(step: string, details?: unknown, level: "info" | "warn" | "error" = "info"): void {
  try {
    const logger = console[level] || console.info;
    logger.call(console, NAI_DEBUG_PREFIX, step, details ?? "");
  } catch {
    // Logging must never affect import behavior.
  }
}

function isNovelAiDebugEnabled(): boolean {
  try {
    const value = localStorage.getItem(NAI_DEBUG_STORAGE_KEY) || "";
    return /^(1|true|yes|on)$/i.test(value.trim());
  } catch {
    return false;
  }
}

function pageFile(blob: Blob, fileName: string): File {
  const page = pageGlobal();
  return new page.File([blob], fileName, { type: blob.type || "image/png" });
}

function pageGlobal(): Window & typeof globalThis {
  return typeof unsafeWindow === "undefined" ? window : unsafeWindow;
}

function uniqueElements(values: Array<HTMLElement | undefined>): HTMLElement[] {
  return Array.from(new Set(values.filter((value): value is HTMLElement => Boolean(value))));
}

function isTextEntryElement(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement && element.type !== "file") return true;
  if (element.isContentEditable) return true;
  return element.getAttribute("role") === "textbox";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function domReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}
