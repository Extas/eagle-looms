import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../utils/i18n";
import { DownloaderPanel } from "./downloader-panel";

vi.mock("../download/downloader", () => ({
  CherryPickRange: class CherryPickRange {
    static from() {
      return null;
    }
  },
}));

vi.mock("$", () => ({
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function createPanel(): DownloaderPanel {
  const root = document.createElement("div");
  root.innerHTML = `<button id="downloader-panel-btn"></button>${DownloaderPanel.html()}`;
  document.body.appendChild(root);
  return new DownloaderPanel(root);
}

describe("DownloaderPanel Eagle import confirmation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("closes and resolves as canceled when the downloader aborts", async () => {
    const panel = createPanel();
    const confirm = panel.confirmEagleImportPlan(["planned 1", "will write 1"]);

    expect(document.querySelector(".ehvp-eagle-import-confirm")).not.toBeNull();

    panel.abort("downloadStart");

    await expect(confirm).resolves.toBe(false);
    expect(document.querySelector(".ehvp-eagle-import-confirm")).toBeNull();
    expect(panel.startBTN.textContent).toBe(i18n.downloadStart.get());
  });

  it("makes the two import actions explicit and hides the loaded-only action while running", () => {
    const panel = createPanel();

    expect(panel.forceBTN.textContent).toBe(i18n.forceDownload.get());
    expect(panel.forceBTN.title).toBe(i18n.forceDownloadTooltip.get());
    expect(panel.startBTN.textContent).toBe(i18n.downloadStart.get());
    expect(panel.startBTN.title).toBe(i18n.downloadStartTooltip.get());

    panel.flushUI("downloading");

    expect(panel.forceBTN.hidden).toBe(true);
    expect(panel.startBTN.textContent).toBe(i18n.downloading.get());
    expect(panel.startBTN.title).toBe(i18n.downloadStopTooltip.get());

    panel.flushUI("downloadStart");

    expect(panel.forceBTN.hidden).toBe(false);
    expect(panel.startBTN.textContent).toBe(i18n.downloadStart.get());
    expect(panel.startBTN.title).toBe(i18n.downloadStartTooltip.get());
  });

  it("distinguishes an all-skipped import from a completed write", () => {
    const panel = createPanel();

    panel.flushUI("importNoNewItems");

    expect(panel.startBTN.textContent).toBe(i18n.importNoNewItems.get());
    expect(panel.startBTN.style.color).not.toBe("red");
    expect(panel.forceBTN.hidden).toBe(false);
  });

  it("uses localized labels for import range actions", () => {
    const panel = createPanel();

    expect(panel.cherryPickElement.querySelector("#download-cherry-pick-btn-add")?.textContent).toBe(i18n.cherryPickPick.get());
    expect(panel.cherryPickElement.querySelector("#download-cherry-pick-btn-exclude")?.textContent).toBe(i18n.cherryPickExclude.get());
    expect(panel.cherryPickElement.querySelector("#download-cherry-pick-btn-clear")?.textContent).toBe(i18n.cherryPickClear.get());

    const followButtons = [...panel.cherryPickElement.querySelectorAll<HTMLElement>(".download-cherry-pick-follow-btn")].map(button => button.textContent);
    expect(followButtons).toEqual([
      i18n.cherryPickPick.get(),
      i18n.cherryPickExclude.get(),
      i18n.cherryPickPick.get(),
      i18n.cherryPickExclude.get(),
    ]);
  });

  it("uses localized labels for chapter range actions and preserves selection behavior", () => {
    const panel = createPanel();
    panel.createChapterSelectList([
      { id: 1, title: "Chapter 1" },
      { id: 2, title: "Chapter 2" },
    ] as any, []);

    const selectAll = panel.chaptersElement.querySelector<HTMLElement>("#download-chapters-select-all")!;
    const unselectAll = panel.chaptersElement.querySelector<HTMLElement>("#download-chapters-unselect-all")!;
    const addNew = panel.chaptersElement.querySelector<HTMLElement>("#download-chapters-add-new")!;

    expect(selectAll.textContent).toBe(i18n.selectAllChapters.get());
    expect(unselectAll.textContent).toBe(i18n.unselectAllChapters.get());
    expect(addNew.textContent).toBe(i18n.addNewChapters.get());
    expect(panel.selectedChapters()).toEqual(new Set());

    selectAll.click();
    expect(panel.selectedChapters()).toEqual(new Set([1, 2]));

    unselectAll.click();
    expect(panel.selectedChapters()).toEqual(new Set());
  });

  it("renders source chapter titles as text in the chapter selector", () => {
    const panel = createPanel();
    panel.createChapterSelectList([
      { id: 1, title: "<b>Chapter</b> & <img src=x onerror=alert(1)>" },
      { id: 2, title: ["Part <1>", "Part & 2"] },
    ] as any, []);

    const titles = [...panel.chaptersElement.querySelectorAll("label span")].map(span => span.textContent);

    expect(titles).toEqual([
      "<b>Chapter</b> & <img src=x onerror=alert(1)>",
      "Part <1>,Part & 2",
    ]);
    expect(panel.chaptersElement.querySelector("label b")).toBeNull();
    expect(panel.chaptersElement.querySelector("label img")).toBeNull();
  });

  it("shows notice tooltips for ambiguous state actions", () => {
    const panel = createPanel();

    panel.initNotice([
      { btn: "Retry failed images", tooltip: "Red failed images will be loaded again.", cb: vi.fn() },
    ]);

    const noticeAction = panel.noticeElement.querySelector<HTMLAnchorElement>("a")!;
    expect(noticeAction.textContent).toBe("Retry failed images");
    expect(noticeAction.title).toBe("Red failed images will be loaded again.");
  });

  it("supports keyboard confirm/cancel without leaking shortcuts to the page", async () => {
    const panel = createPanel();
    const leaked = vi.fn();
    document.addEventListener("keydown", leaked);

    const confirm = panel.confirmEagleImportPlan(["planned 1"], "Write 1 new item to Eagle?");
    const dialog = document.querySelector<HTMLElement>(".ehvp-eagle-import-confirm")!;
    const button = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;

    expect(document.activeElement).toBe(button);
    expect(dialog.querySelector(".ehvp-modal-lede")?.textContent).toBe("Write 1 new item to Eagle?");
    expect(dialog.textContent).toContain(i18n.eagleImportConfirmMessage.get());

    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await expect(confirm).resolves.toBe(true);
    expect(leaked).not.toHaveBeenCalled();
    document.removeEventListener("keydown", leaked);
  });

  it("cancels the confirmation with Escape", async () => {
    const panel = createPanel();
    const confirm = panel.confirmEagleImportPlan(["planned 1"]);
    const dialog = document.querySelector<HTMLElement>(".ehvp-eagle-import-confirm")!;

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await expect(confirm).resolves.toBe(false);
    expect(document.querySelector(".ehvp-eagle-import-confirm")).toBeNull();
  });

  it("keeps Tab focus inside the confirmation and restores focus after close", async () => {
    const panel = createPanel();
    panel.startBTN.focus();

    const confirm = panel.confirmEagleImportPlan(["planned 1"]);
    const dialog = document.querySelector<HTMLElement>(".ehvp-eagle-import-confirm")!;
    const copyButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-copy")!;
    const cancelButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel")!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;

    expect(document.activeElement).toBe(confirmButton);

    confirmButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(copyButton);

    copyButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(cancelButton);

    cancelButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(copyButton);

    copyButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirmButton);

    cancelButton.click();

    await expect(confirm).resolves.toBe(false);
    expect(document.activeElement).toBe(panel.startBTN);
  });

  it("copies the import plan without confirming the import", async () => {
    const panel = createPanel();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    let settled = false;

    const confirm = panel.confirmEagleImportPlan(["planned 2", "will write 1"], "Write 1 new item to Eagle?");
    confirm.then(() => {
      settled = true;
    });
    const dialog = document.querySelector<HTMLElement>(".ehvp-eagle-import-confirm")!;
    const copyButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-copy")!;

    copyButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith([
      i18n.eagleImportConfirmTitle.get(),
      "Write 1 new item to Eagle?",
      "planned 2",
      "will write 1",
    ].join("\n"));
    expect(copyButton.textContent).toBe(i18n.eagleImportResultCopied.get());
    expect(document.querySelector(".ehvp-eagle-import-confirm")).not.toBeNull();
    expect(settled).toBe(false);

    dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel")?.click();
    await expect(confirm).resolves.toBe(false);
  });

  it("keeps confirmation actions outside the scrollable plan details", () => {
    const panel = createPanel();
    panel.confirmEagleImportPlan(Array.from({ length: 30 }, (_, index) => `detail ${index + 1}`));
    const dialog = document.querySelector<HTMLElement>(".ehvp-eagle-import-confirm")!;
    const body = dialog.querySelector<HTMLElement>(".ehvp-modal-body")!;
    const copyButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-copy")!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;

    expect(body.contains(copyButton)).toBe(false);
    expect(body.contains(confirmButton)).toBe(false);
    expect(body.textContent).toContain("detail 1");
    expect(body.textContent).toContain("detail 30");
  });

  it("shows a persistent Eagle import result until cleared or a new import starts", () => {
    const panel = createPanel();

    panel.showEagleImportResult(["planned 2", "imported 2"], false, [
      { label: "Eagle Looms/site/a", url: "http://localhost:41595/folder?id=folder-1" },
    ]);

    expect(panel.eagleResultElement.hidden).toBe(false);
    expect(panel.eagleResultElement.textContent).toContain(i18n.eagleImportResultTitle.get());
    expect(panel.eagleResultElement.textContent).toContain("imported 2");
    const folderLink = panel.eagleResultElement.querySelector<HTMLAnchorElement>(".download-eagle-result-links a");
    expect(folderLink?.href).toBe("http://localhost:41595/folder?id=folder-1");
    expect(folderLink?.textContent).toBe("Eagle Looms/site/a");

    panel.flushUI("downloading");

    expect(panel.eagleResultElement.hidden).toBe(true);

    panel.showEagleImportResult(["failed 1"], true);
    expect(panel.eagleResultElement.classList.contains("download-eagle-result-error")).toBe(true);

    panel.eagleResultElement.querySelector<HTMLButtonElement>("button")?.click();

    expect(panel.eagleResultElement.hidden).toBe(true);
  });

  it("copies Eagle import result details for troubleshooting", async () => {
    const panel = createPanel();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    panel.showEagleImportResult(["failed 1", "first failures a.png: timeout"], true, [
      { label: "Eagle Looms/site/a", url: "http://localhost:41595/folder?id=folder-1" },
    ]);

    panel.eagleResultElement.querySelector<HTMLButtonElement>('[data-action="copy"]')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith([
      i18n.eagleImportResultTitle.get(),
      "failed 1",
      "first failures a.png: timeout",
      "Eagle Looms/site/a: http://localhost:41595/folder?id=folder-1",
    ].join("\n"));
    expect(panel.eagleResultElement.querySelector<HTMLButtonElement>('[data-action="copy"]')?.textContent).toBe(i18n.eagleImportResultCopied.get());
  });

  it("keeps result actions outside the scrollable detail body", () => {
    const panel = createPanel();
    const details = Array.from({ length: 30 }, (_, index) => `failure ${index + 1}`);

    panel.showEagleImportResult(details, true);

    const body = panel.eagleResultElement.querySelector<HTMLElement>(".download-eagle-result-body")!;
    const copyButton = panel.eagleResultElement.querySelector<HTMLButtonElement>('[data-action="copy"]')!;

    expect(body).not.toBeNull();
    expect(body.contains(copyButton)).toBe(false);
    expect(body.textContent).toContain("failure 1");
    expect(body.textContent).toContain("failure 30");
  });
});
