import type { EagleItem } from "../types";
import { EagleWebApi, type AddItemInput } from "./eagle-web-api";
import { normalizeEagleBaseUrl } from "./options";
import { arrayBufferToBase64, requestArrayBuffer } from "./transport";
import { normalizeEagleItemName } from "./naming";

const STORAGE_KEY = "eagle-looms:novelai-bridge";
const DEFAULT_MONITOR_LIMIT = 2;
const MAX_MONITOR_LIMIT = 20;
const PANEL_ID = "eagle-looms-novelai-bridge";
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
  clipboard: boolean;
  fileInputs: number;
  pasteTargets: number;
  dropTargets: number;
  clipboardError?: string;
}

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
  add(item.url);
  add(item.website, true);
  add(item.thumbnailURL);
  add(item.thumbnailUrl);
  return unique(candidates);
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
      const clipboardBlob = await toClipboardImageBlob(blob);
      const fileName = sourceFileName(item, clipboardBlob.type);
      const paste = await pasteImageIntoNovelAi(clipboardBlob, fileName);

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
        return await downloadImageBlob(url, fallbackType);
      } catch (error) {
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
    elements.importButton.textContent = busy ? "Importing..." : "Import Eagle Image";
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
    elements.monitorButton.textContent = this.config.monitorEnabled ? "Monitor: On" : "Monitor: Off";
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
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        width: 330px;
        box-sizing: border-box;
        padding: 10px;
        border: 1px solid rgba(0, 0, 0, 0.24);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        color: #111;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${PANEL_ID} strong { font-size: 13px; }
      #${PANEL_ID} label {
        display: grid;
        gap: 4px;
        margin: 7px 0;
        font-weight: 600;
      }
      #${PANEL_ID} input {
        width: 100%;
        min-height: 28px;
        border: 1px solid #bbb;
        border-radius: 5px;
        padding: 4px 7px;
        font: inherit;
        background: #fff;
        color: #111;
      }
      #${PANEL_ID} .el-nai-row {
        display: grid;
        grid-template-columns: 1fr auto 54px;
        gap: 6px;
        align-items: center;
        margin-top: 8px;
      }
      #${PANEL_ID} button {
        min-height: 28px;
        border: 1px solid #222;
        border-radius: 5px;
        padding: 4px 8px;
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
        margin-top: 8px;
        color: #333;
        overflow-wrap: anywhere;
      }
      #${PANEL_ID} .el-nai-status {
        margin-top: 7px;
        min-height: 32px;
        color: #2d5a32;
        overflow-wrap: anywhere;
      }
      #${PANEL_ID} .el-nai-status[data-state="error"] { color: #a01818; }
    </style>
    <header>
      <strong>Eagle -> NovelAI</strong>
    </header>
    <div class="el-nai-body">
      <label>
        Eagle API URL
        <input data-el="api" type="url" autocomplete="off" spellcheck="false">
      </label>
      <label>
        Eagle item link
        <input data-el="item" type="text" autocomplete="off" spellcheck="false" placeholder="http://localhost:41595/item?id=...">
      </label>
      <div class="el-nai-row">
        <button data-el="import" type="button">Import Eagle Image</button>
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

async function pasteImageIntoNovelAi(blob: Blob, fileName: string): Promise<PasteDispatchSummary> {
  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  const summary: PasteDispatchSummary = {
    clipboard: false,
    fileInputs: 0,
    pasteTargets: 0,
    dropTargets: 0,
  };

  try {
    await writeImageToClipboard(blob);
    summary.clipboard = true;
  } catch (error) {
    summary.clipboardError = errorMessage(error);
  }

  summary.fileInputs = dispatchToFileInputs(file);
  summary.pasteTargets = dispatchPasteEvents(file);
  summary.dropTargets = dispatchDropEvents(file);

  if (!summary.clipboard && summary.fileInputs + summary.pasteTargets + summary.dropTargets === 0) {
    throw new Error(`Cannot paste image into NovelAI. ${summary.clipboardError || ""}`.trim());
  }
  return summary;
}

async function writeImageToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image write is not available");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type || "image/png"]: blob }),
  ]);
}

function dispatchToFileInputs(file: File): number {
  if (typeof DataTransfer === "undefined") return 0;
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']"))
    .filter((input) => acceptsImageFiles(input))
    .slice(0, 3);
  let count = 0;
  for (const input of inputs) {
    const data = new DataTransfer();
    data.items.add(file);
    Object.defineProperty(input, "files", { configurable: true, value: data.files });
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    count += 1;
  }
  return count;
}

function dispatchPasteEvents(file: File): number {
  if (typeof DataTransfer === "undefined") return 0;
  const targets = pasteTargets();
  let count = 0;
  for (const target of targets) {
    const data = new DataTransfer();
    data.items.add(file);
    data.setData("text/plain", file.name);
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

function dispatchDropEvents(file: File): number {
  if (typeof DataTransfer === "undefined") return 0;
  const targets = dropTargets();
  let count = 0;
  for (const target of targets) {
    const data = new DataTransfer();
    data.items.add(file);
    data.setData("text/plain", file.name);
    const event = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: data,
    });
    target.dispatchEvent(event);
    count += 1;
  }
  return count;
}

function pasteTargets(): HTMLElement[] {
  return uniqueElements([
    document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
    ...queryAll(".ProseMirror, [contenteditable='true'], textarea, [role='textbox']"),
    ...queryAll("main, body"),
  ]).filter((element) => !element.closest(`#${PANEL_ID}`));
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
  return new Set(Array.from(document.images).map((img) => img.currentSrc || img.src).filter(Boolean));
}

function resultImageSources(): string[] {
  const sources: string[] = [];
  for (const image of Array.from(document.images)) {
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

async function toClipboardImageBlob(blob: Blob): Promise<Blob> {
  const input = withImageType(blob, "image/png");
  if (input.type === "image/png") return input;
  try {
    const bitmap = await createImageBitmap(input);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("canvas export failed")), "image/png");
    });
    return png;
  } catch {
    return input;
  }
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
  return normalizeEagleItemName(`${stem} - NovelAI - ${localTimestamp(generatedAt)} - ${index}.${extension}`);
}

function sourceFileName(item: EagleItem, mimeType: string): string {
  const extension = item.ext || extensionForMime(mimeType);
  return normalizeEagleItemName(item.name || `${item.id}.${extension}`);
}

function localTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${[
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-")} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function pasteStatus(summary: PasteDispatchSummary): string {
  const parts = [
    summary.clipboard ? "clipboard" : "",
    summary.fileInputs ? `${summary.fileInputs} file input` : "",
    summary.pasteTargets ? `${summary.pasteTargets} paste target` : "",
    summary.dropTargets ? `${summary.dropTargets} drop target` : "",
  ].filter(Boolean);
  return `Eagle image sent to NovelAI (${parts.join(", ") || "event dispatched"}). Run NovelAI manually; monitor will import results.`;
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

function uniqueElements(values: Array<HTMLElement | undefined>): HTMLElement[] {
  return Array.from(new Set(values.filter((value): value is HTMLElement => Boolean(value))));
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
