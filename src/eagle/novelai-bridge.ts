import type { EagleItem } from "../types";
import { EagleWebApi, type AddItemInput } from "./eagle-web-api";
import { normalizeEagleBaseUrl } from "./options";
import { arrayBufferToBase64, requestArrayBuffer } from "./transport";
import { buildStructuredEagleName, normalizeEagleItemName } from "./naming";

declare const unsafeWindow: (Window & typeof globalThis) | undefined;

const STORAGE_KEY = "eagle-looms:novelai-bridge";
const DEFAULT_MONITOR_LIMIT = 2;
const MAX_MONITOR_LIMIT = 20;
const NAI_IMPORT_CONFIRM_TIMEOUT_MS = 2200;
const PANEL_ID = "eagle-looms-novelai-bridge";
const NAI_DEBUG_PREFIX = "[Eagle Looms][NovelAI]";
const NAI_PAGE_BRIDGE_KEY = "__EagleLoomsNovelAiBridgeV1";
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

interface BridgeElements {
  root: HTMLElement;
  body: HTMLElement;
  apiInput: HTMLInputElement;
  itemInput: HTMLInputElement;
  importButton: HTMLButtonElement;
  monitorButton: HTMLButtonElement;
  monitorLimitInput: HTMLInputElement;
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
  }): Promise<NovelAiPageImportSummary>;
}

const NOVEL_AI_PAGE_BRIDGE_SOURCE = String.raw`
(() => {
  const KEY = "__EagleLoomsNovelAiBridgeV1";
  if (window[KEY]?.version === 1) return;
  const PREFIX = "[Eagle Looms][NovelAI/page]";
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const log = (traceId, step, details, level = "info") => {
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
    version: 1,
    async importImage(payload) {
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

export function normalizeMonitorLimit(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MONITOR_LIMIT;
  return Math.min(MAX_MONITOR_LIMIT, Math.max(1, parsed));
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
  } catch {
    for (const match of annotation.matchAll(/https?:\/\/[^\s"'<>]+/g)) addAnnotationUrl(values, match[0]);
  }
  return unique(values);
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
  sourceItem: EagleItem;
  sourceItemLink: string;
  pageUrl: string;
  generatedAt: Date;
  resultIndex: number;
  contentType: string;
  base64: string;
}): AddItemInput {
  const contentType = normalizeImageMime(options.contentType, "image/png");
  const extension = extensionForMime(contentType);
  const name = novelAiGeneratedItemName(options.sourceItem, options.generatedAt, options.resultIndex, extension);
  const sourceUrl = options.sourceItem.url || options.sourceItem.website || "";
  const annotation = JSON.stringify({
    schema: BRIDGE_SCHEMA,
    sourceItemId: options.sourceItem.id,
    sourceItemName: options.sourceItem.name || options.sourceItem.id,
    sourceItemLink: options.sourceItemLink,
    ...(sourceUrl ? { sourceUrl } : {}),
    novelAiUrl: options.pageUrl,
    generatedAt: options.generatedAt.toISOString(),
  });
  return {
    name,
    base64: ensureDataUrl(options.base64, contentType),
    website: options.pageUrl,
    folders: unique(options.sourceItem.folders || []),
    tags: novelAiGeneratedTags(options.sourceItem.tags),
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
  private sourceItem?: EagleItem;
  private sourceItemLink = "";
  private monitorObserver?: MutationObserver;
  private monitorActive = false;
  private monitorChecking = false;
  private monitorBaseline = new Set<string>();
  private importedResultSources = new Set<string>();
  private importedResultCount = 0;
  private destroyed = false;

  async mount(): Promise<void> {
    this.config = await loadConfig();
    await domReady();
    if (this.destroyed || !isNovelAiImageToolsUrl()) return;
    this.elements = createPanel(this.config);
    document.body.appendChild(this.elements.root);
    this.bindEvents();
    this.setStatus("Paste an Eagle item link, then import.");
    this.updateMonitorUi();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopMonitor();
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
    elements.itemInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void this.importEagleImage();
    });
    elements.importButton.addEventListener("click", () => void this.importEagleImage());
    elements.monitorButton.addEventListener("click", () => {
      this.config.monitorEnabled = !this.config.monitorEnabled;
      void saveConfig(this.config);
      if (this.config.monitorEnabled) {
        this.monitorBaseline = snapshotNovelAiImageSources();
        this.importedResultCount = 0;
        this.importedResultSources.clear();
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

  private async importEagleImage(): Promise<void> {
    const elements = this.elements;
    if (!elements) return;
    const itemId = parseEagleItemId(elements.itemInput.value);
    if (!itemId) {
      this.setStatus("Missing Eagle item link or id.", true);
      return;
    }

    this.setBusy(true);
    this.stopMonitor();
    try {
      this.config.eagleBaseUrl = normalizeEagleBaseUrl(elements.apiInput.value);
      elements.apiInput.value = this.config.eagleBaseUrl;
      await saveConfig(this.config);

      const api = new EagleWebApi(this.config.eagleBaseUrl);
      const item = await api.itemInfo(itemId);
      const blob = await this.fetchEagleImageBlob(item);
      const fileName = sourceFileName(item, blob.type);
      this.setStatus("Importing image into NovelAI...");
      const paste = await pasteImageIntoNovelAi(blob, fileName);

      this.sourceItem = item;
      this.sourceItemLink = eagleItemLink(this.config.eagleBaseUrl, item.id);
      this.renderSource();
      this.setStatus(pasteStatus(paste));

      await delay(900);
      this.monitorBaseline = snapshotNovelAiImageSources();
      this.importedResultSources.clear();
      this.importedResultCount = 0;
      if (this.config.monitorEnabled) this.startMonitor();
      this.updateMonitorUi();
    } catch (error) {
      this.setStatus(errorMessage(error), true);
    } finally {
      this.setBusy(false);
    }
  }

  private async fetchEagleImageBlob(item: EagleItem): Promise<Blob> {
    const candidates = eagleItemImageCandidates(item, this.config.eagleBaseUrl);
    if (candidates.length === 0) {
      throw new Error("Eagle item has no fetchable image URL. Re-import items with a direct image url, or use an item collected by Eagle Looms.");
    }

    const fallbackType = mimeForItem(item);
    const errors: string[] = [];
    for (const url of candidates) {
      try {
        const blob = await downloadImageBlob(url, fallbackType);
        await assertLikelyImageBlob(blob, url);
        debugNovelAi("source", "image candidate accepted", {
          url: shortUrl(url),
          type: blob.type || "(empty)",
          size: blob.size,
        });
        return blob;
      } catch (error) {
        debugNovelAi("source", "image candidate rejected", {
          url: shortUrl(url),
          error: errorMessage(error),
        }, "warn");
        errors.push(`${shortUrl(url)}: ${errorMessage(error)}`);
      }
    }
    throw new Error(`Cannot read Eagle image. ${errors.slice(0, 3).join(" | ")}`);
  }

  private startMonitor(): void {
    if (!this.sourceItem) {
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
    if (!this.monitorActive || this.monitorChecking || !this.sourceItem) return;
    this.monitorChecking = true;
    try {
      const candidates = resultImageSources()
        .filter((src) => !this.monitorBaseline.has(src))
        .filter((src) => !this.importedResultSources.has(src));

      for (const src of candidates) {
        if (this.importedResultCount >= this.config.monitorLimit) break;
        await this.importNovelAiResult(src);
      }

      if (this.importedResultCount >= this.config.monitorLimit) {
        this.stopMonitor();
        this.setStatus(`Monitor stopped after ${this.importedResultCount}/${this.config.monitorLimit} result imports.`);
      }
    } finally {
      this.monitorChecking = false;
      this.updateMonitorUi();
    }
  }

  private async importNovelAiResult(src: string): Promise<void> {
    const item = this.sourceItem;
    if (!item) return;
    this.importedResultSources.add(src);
    const blob = await downloadImageBlob(src, "image/png");
    const contentType = normalizeImageMime(blob.type, "image/png");
    const base64 = await blobToDataUrl(blob, contentType);
    const input = buildNovelAiGeneratedItemInput({
      sourceItem: item,
      sourceItemLink: this.sourceItemLink || eagleItemLink(this.config.eagleBaseUrl, item.id),
      pageUrl: location.href,
      generatedAt: new Date(),
      resultIndex: this.importedResultCount + 1,
      contentType,
      base64,
    });
    const api = new EagleWebApi(this.config.eagleBaseUrl);
    const id = await api.addItem(input);
    this.importedResultCount += 1;
    this.setStatus(`Imported NovelAI result ${this.importedResultCount}/${this.config.monitorLimit}${id ? `: ${id}` : ""}.`);
  }

  private renderSource(): void {
    const elements = this.elements;
    if (!elements || !this.sourceItem) return;
    const folders = this.sourceItem.folders?.length ? `${this.sourceItem.folders.length} folder(s)` : "no folders";
    elements.source.textContent = `${this.sourceItem.name || this.sourceItem.id} -> ${folders}`;
  }

  private setBusy(busy: boolean): void {
    const elements = this.elements;
    if (!elements) return;
    elements.importButton.disabled = busy;
    elements.importButton.textContent = busy ? "..." : "Import";
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
        width: 228px;
        max-width: calc(100vw - 20px);
        box-sizing: border-box;
        padding: 7px;
        border: 1px solid rgba(0, 0, 0, 0.24);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.96);
        color: #111;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
        font: 11px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 5px;
      }
      #${PANEL_ID} strong { font-size: 12px; white-space: nowrap; }
      #${PANEL_ID} label {
        display: grid;
        grid-template-columns: 38px minmax(0, 1fr);
        gap: 5px;
        align-items: center;
        margin: 4px 0;
        font-weight: 600;
      }
      #${PANEL_ID} input {
        width: 100%;
        min-height: 24px;
        border: 1px solid #bbb;
        border-radius: 4px;
        padding: 2px 5px;
        font: inherit;
        background: #fff;
        color: #111;
      }
      #${PANEL_ID} .el-nai-row {
        display: grid;
        grid-template-columns: 1fr auto 36px;
        gap: 5px;
        align-items: center;
        margin-top: 6px;
      }
      #${PANEL_ID} button {
        min-height: 24px;
        border: 1px solid #222;
        border-radius: 4px;
        padding: 2px 6px;
        background: #f6f6f6;
        color: #111;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      #${PANEL_ID} button:disabled {
        cursor: wait;
        opacity: 0.65;
      }
      #${PANEL_ID} button[data-enabled="true"] {
        background: #e7f6ec;
        border-color: #257a3e;
      }
      #${PANEL_ID} .el-nai-source {
        margin-top: 6px;
        color: #333;
        overflow-wrap: anywhere;
        max-height: 26px;
        overflow: hidden;
      }
      #${PANEL_ID} .el-nai-status {
        margin-top: 6px;
        min-height: 16px;
        max-height: 44px;
        color: #2d5a32;
        overflow-wrap: anywhere;
        overflow: auto;
      }
      #${PANEL_ID} .el-nai-status[data-state="error"] { color: #a01818; }
    </style>
    <header>
      <strong>Eagle -> NAI</strong>
    </header>
    <div class="el-nai-body">
      <label>
        <span>API</span>
        <input data-el="api" type="url" autocomplete="off" spellcheck="false">
      </label>
      <label>
        <span>Item</span>
        <input data-el="item" type="text" autocomplete="off" spellcheck="false" placeholder="http://localhost:41595/item?id=...">
      </label>
      <div class="el-nai-row">
        <button data-el="import" type="button">Import</button>
        <button data-el="monitor" type="button">Monitor: On</button>
        <input data-el="limit" type="number" min="1" max="${MAX_MONITOR_LIMIT}" step="1" title="Auto-stop after this many NovelAI result imports">
      </div>
      <div class="el-nai-source" data-el="source">same Eagle folder on result import</div>
      <div class="el-nai-status" data-el="status"></div>
    </div>
  `;

  const elements: BridgeElements = {
    root,
    body: root.querySelector<HTMLElement>(".el-nai-body")!,
    apiInput: root.querySelector<HTMLInputElement>("[data-el='api']")!,
    itemInput: root.querySelector<HTMLInputElement>("[data-el='item']")!,
    importButton: root.querySelector<HTMLButtonElement>("[data-el='import']")!,
    monitorButton: root.querySelector<HTMLButtonElement>("[data-el='monitor']")!,
    monitorLimitInput: root.querySelector<HTMLInputElement>("[data-el='limit']")!,
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
    return await bridge.importImage({ traceId, fileName, type, dataUrl });
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
  if (existing?.version === 1) return existing;
  try {
    const install = page.Function?.(NOVEL_AI_PAGE_BRIDGE_SOURCE);
    if (typeof install !== "function") throw new Error("page Function constructor is not available");
    install();
  } catch (error) {
    debugNovelAi(traceId, "page bridge install failed", { error: errorMessage(error) }, "warn");
    return undefined;
  }
  const installed = page[NAI_PAGE_BRIDGE_KEY];
  if (installed?.version === 1) return installed;
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
  return new Blob([buffer], { type: fallbackType || mimeFromUrl(url) || "image/png" });
}

async function assertLikelyImageBlob(blob: Blob, url: string): Promise<void> {
  if (blob.size <= 0) throw new Error("empty image response");
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const signature = imageBlobSignature(header);
  if (signature) return;
  const preview = new TextDecoder("utf-8", { fatal: false }).decode(header).trim().slice(0, 32);
  const type = blob.type || mimeFromUrl(url) || "(empty)";
  throw new Error(`response is not a supported image (${type}, ${blob.size} bytes, starts with ${JSON.stringify(preview)})`);
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

async function blobToDataUrl(blob: Blob, contentType: string): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
}

function novelAiGeneratedItemName(sourceItem: EagleItem, generatedAt: Date, resultIndex: number, extension: string): string {
  const stem = sourceItem.name?.replace(/\.[a-z0-9]{1,12}$/i, "") || sourceItem.id;
  const index = String(Math.max(1, resultIndex)).padStart(2, "0");
  return buildStructuredEagleName(`${stem} - NovelAI`, extension, {
    tool: "novelai",
    at: utcCompactTimestamp(generatedAt),
    seq: index,
    src: sourceItem.id,
  });
}

function sourceFileName(item: EagleItem, mimeType: string): string {
  const extension = item.ext || extensionForMime(mimeType);
  return normalizeEagleItemName(item.name || `${item.id}.${extension}`);
}

function utcCompactTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function pasteStatus(summary: PasteDispatchSummary): string {
  const parts = [
    summary.pageBridge ? "page bridge" : "",
    summary.reactInputs ? `${summary.reactInputs} NovelAI handler` : "",
    summary.clipboard ? "clipboard" : "",
    summary.fileInputs ? `${summary.fileInputs} file input` : "",
    summary.pasteTargets ? `${summary.pasteTargets} paste target` : "",
    summary.dropTargets ? `${summary.dropTargets} drop target` : "",
  ].filter(Boolean);
  return `NovelAI source image imported (${parts.join(", ") || "event dispatched"}). Run NovelAI manually; monitor will import results.`;
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

function mimeForItem(item: EagleItem): string {
  return mimeFromExtension(item.ext || item.name?.split(".").pop() || "") || mimeFromUrl(item.url || "") || "image/png";
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
  try {
    const logger = console[level] || console.info;
    logger.call(console, NAI_DEBUG_PREFIX, traceId, step, details ?? "");
  } catch {
    // Debug logging must never affect import behavior.
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
