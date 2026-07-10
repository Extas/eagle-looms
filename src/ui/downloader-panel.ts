import { ChapterStat, CherryPickRange } from "../download/downloader";
import EBUS from "../event-bus";
import { Chapter } from "../page-fetcher";
import { i18n } from "../utils/i18n";
import q from "../utils/query-element";
import relocateElement from "../utils/relocate-element";

type TabID = "status" | "chapters" | "cherry-pick";
type ResultLink = { label: string; url: string };
export type DownloaderPanelStage = "downloadFailed" | "downloaded" | "downloadStart" | "downloading" | "importNoNewItems" | "packaging";

export class DownloaderPanel {

  root: HTMLElement;
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
  tabStatus: HTMLElement;
  tabChapters: HTMLElement;
  tabCherryPick: HTMLElement;
  statusElement: HTMLElement;
  chaptersElement: HTMLElement;
  cherryPickElement: HTMLElement;
  noticeElement: HTMLElement;
  eagleResultElement: HTMLElement;
  forceBTN: HTMLAnchorElement;
  startBTN: HTMLAnchorElement;
  btn: HTMLElement
  private activeEagleImportConfirm?: (value: boolean) => void;

  constructor(root: HTMLElement) {
    this.root = root;
    this.btn = q("#downloader-panel-btn", root);
    this.panel = q("#downloader-panel", root);
    this.canvas = q<HTMLCanvasElement>("#downloader-canvas", root);
    this.tabStatus = q("#download-tab-status", root);
    this.tabChapters = q("#download-tab-chapters", root);
    this.tabCherryPick = q("#download-tab-cherry-pick", root);
    this.statusElement = q("#download-status", root);
    this.chaptersElement = q("#download-chapters", root);
    this.cherryPickElement = q("#download-cherry-pick", root);
    this.noticeElement = q("#download-notice", root);
    this.eagleResultElement = q("#download-eagle-result", root);
    this.forceBTN = q<HTMLAnchorElement>("#download-force", root);
    this.startBTN = q<HTMLAnchorElement>("#download-start", root);
    this.panel.addEventListener("transitionend", () => EBUS.emit("downloader-canvas-resize"));
  }

  initTabs() {
    const elements = [this.statusElement, this.chaptersElement, this.cherryPickElement];
    const tabs = [
      {
        ele: this.tabStatus, cb: () => {
          elements.forEach((e, i) => e.hidden = i != 0)
          EBUS.emit("downloader-canvas-resize")
        }
      },
      {
        ele: this.tabChapters, cb: () => {
          elements.forEach((e, i) => e.hidden = i != 1)
        }
      },
      {
        ele: this.tabCherryPick, cb: () => {
          elements.forEach((e, i) => e.hidden = i != 2)
          q("#download-cherry-pick-input", this.cherryPickElement).focus();
        }
      },
    ];
    tabs.forEach(({ ele, cb }, i) => {
      ele.addEventListener("click", () => {
        ele.classList.add("ehvp-p-tab-selected")
        tabs.filter((_, j) => j != i).forEach(t => t.ele.classList.remove("ehvp-p-tab-selected"));
        cb();
      });
    });
  }

  switchTab(tabID: TabID) {
    switch (tabID) {
      case "status":
        this.tabStatus.click();
        break;
      case "chapters":
        this.tabChapters.click();
        break;
      case "cherry-pick":
        this.tabCherryPick.click();
        break;
    }
  }

  initNotice(btns: { btn: string, tooltip?: string, cb: () => void }[]) {
    this.noticeElement.innerHTML = "";
    btns.forEach(b => {
      // <a class='clickable' style='color:gray;'>Enable RawImage Transient</a>
      const a = document.createElement("a");
      a.textContent = b.btn;
      if (b.tooltip) a.title = b.tooltip;
      a.classList.add("clickable");
      a.style.color = "gray";
      a.style.margin = "0em 0.5em";
      a.addEventListener("click", b.cb);
      this.noticeElement.append(a);
    });
  }

  abort(stage: "downloadFailed" | "downloaded" | "downloadStart" | "importNoNewItems") {
    this.closeEagleImportConfirm(false);
    this.flushUI(stage);
    this.normalizeBTN();
  }

  flushUI(stage: DownloaderPanelStage) {
    const running = stage === "downloading" || stage === "packaging";
    if (stage === "downloading" || stage === "packaging") {
      this.clearEagleImportResult();
    }
    this.forceBTN.hidden = running;
    this.startBTN.style.color = stage === "downloadFailed" ? "red" : "";
    this.startBTN.textContent = i18n[stage].get();
    this.startBTN.title = running ? i18n.downloadStopTooltip.get() : i18n.downloadStartTooltip.get();
    this.btn.style.color = stage === "downloadFailed" ? "red" : "";
  }

  setImportProgress(label: string, current?: number, total?: number) {
    this.forceBTN.hidden = true;
    this.startBTN.style.color = "";
    this.startBTN.textContent = current !== undefined && total !== undefined
      ? `${label} ${current}/${total}`
      : label;
    this.startBTN.title = i18n.downloadStopTooltip.get();
  }

  noticeableBTN() {
    if (!this.btn.classList.contains("lightgreen")) {
      this.btn.classList.add("lightgreen");
      if (!/✓/.test(this.btn.textContent!)) {
        this.btn.textContent += "✓";
      }
    }
  }

  normalizeBTN() {
    this.btn.textContent = this.btn.textContent!.replace("✓", "");
    this.btn.classList.remove("lightgreen");
  }

  confirmEagleImportPlan(compactDetails: string[], headline?: string, details?: string[]): Promise<boolean> {
    return new Promise(resolve => {
      this.closeEagleImportConfirm(false);
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      const planText = eagleImportPlanText(details || compactDetails, headline);
      const detailsMarkup = details?.length
        ? `<details class="ehvp-modal-details">
            <summary>${escapeHTML(i18n.eagleImportConfirmDetails.get())}</summary>
            <ul>${details.map(detail => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>
          </details>`
        : "";
      const div = document.createElement("div");
      div.className = "ehvp-modal ehvp-eagle-import-confirm";
      div.tabIndex = -1;
      div.setAttribute("role", "dialog");
      div.setAttribute("aria-modal", "true");
      div.innerHTML = `
        <div class="ehvp-modal-title">${escapeHTML(i18n.eagleImportConfirmTitle.get())}</div>
        <div class="ehvp-modal-body">
          <p class="ehvp-modal-lede">${escapeHTML(headline || i18n.eagleImportConfirmMessage.get())}</p>
          ${headline ? `<p class="ehvp-modal-help">${escapeHTML(i18n.eagleImportConfirmMessage.get())}</p>` : ""}
          <ul>${compactDetails.map(detail => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>
          ${detailsMarkup}
        </div>
        <div class="ehvp-modal-actions">
          <button class="ehvp-custom-btn ehvp-custom-btn-plain ehvp-modal-btn-copy" type="button">${escapeHTML(i18n.eagleImportConfirmCopy.get())}</button>
          <button class="ehvp-custom-btn ehvp-modal-btn-cancel">${escapeHTML(i18n.modalCancel.get())}</button>
          <button class="ehvp-custom-btn ehvp-custom-btn-green ehvp-modal-btn-confirm">${escapeHTML(i18n.eagleImportConfirmButton.get())}</button>
        </div>
      `;
      let closed = false;
      const cleanup = (value: boolean) => {
        if (closed) return;
        closed = true;
        div.remove();
        if (this.activeEagleImportConfirm === cleanup) {
          this.activeEagleImportConfirm = undefined;
        }
        if (previousFocus?.isConnected) {
          previousFocus.focus();
        }
        resolve(value);
      };
      this.activeEagleImportConfirm = cleanup;
      this.root.appendChild(div);
      const copyButton = div.querySelector<HTMLButtonElement>(".ehvp-modal-btn-copy");
      const cancelButton = div.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel");
      const confirmButton = div.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm");
      div.addEventListener("keydown", event => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(false);
        } else if (event.key === "Tab") {
          event.preventDefault();
          focusNextInDialog(div, event.shiftKey);
        } else if (event.key === "Enter" && document.activeElement === confirmButton) {
          event.preventDefault();
          cleanup(true);
        }
      });
      copyButton?.addEventListener("click", async () => {
        copyButton.textContent = await copyText(planText) ? i18n.eagleImportResultCopied.get() : i18n.eagleImportResultCopyFailed.get();
      });
      cancelButton?.addEventListener("click", () => cleanup(false));
      confirmButton?.addEventListener("click", () => cleanup(true));
      relocateElement(div, this.startBTN, this.root.offsetWidth, this.root.offsetHeight);
      (confirmButton || div).focus();
    });
  }

  closeEagleImportConfirm(value = false) {
    this.activeEagleImportConfirm?.(value);
  }

  showEagleImportResult(details: string[], failed: boolean, links: ResultLink[] = []) {
    const resultText = eagleImportResultText(details, links);
    this.eagleResultElement.hidden = false;
    this.eagleResultElement.classList.toggle("download-eagle-result-error", failed);
    this.eagleResultElement.innerHTML = `
      <div class="download-eagle-result-title">
        <strong>${escapeHTML(i18n.eagleImportResultTitle.get())}</strong>
        <span class="download-eagle-result-actions">
          <button type="button" class="ehvp-custom-btn ehvp-custom-btn-plain" data-action="clear">${escapeHTML(i18n.eagleImportResultClear.get())}</button>
          <button type="button" class="ehvp-custom-btn ehvp-custom-btn-plain" data-action="copy">${escapeHTML(i18n.eagleImportResultCopy.get())}</button>
        </span>
      </div>
      <div class="download-eagle-result-body">
        <ul>${details.map(detail => `<li>${escapeHTML(detail)}</li>`).join("")}</ul>
        ${links.length ? `<div class="download-eagle-result-links">${links.map(link => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}</a>`).join("")}</div>` : ""}
      </div>
    `;
    this.eagleResultElement.querySelector<HTMLButtonElement>('[data-action="clear"]')?.addEventListener("click", () => this.clearEagleImportResult());
    this.eagleResultElement.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener("click", async event => {
      const button = event.currentTarget as HTMLButtonElement;
      button.textContent = await copyText(resultText) ? i18n.eagleImportResultCopied.get() : i18n.eagleImportResultCopyFailed.get();
    });
  }

  clearEagleImportResult() {
    this.eagleResultElement.hidden = true;
    this.eagleResultElement.classList.remove("download-eagle-result-error");
    this.eagleResultElement.innerHTML = "";
  }

  createChapterSelectList(chapters: Chapter[], selectedChapters: ChapterStat[]) {
    const selectAll = chapters.length === 1;
    this.chaptersElement.innerHTML = `
      <div>
        <span id="download-chapters-select-all" class="clickable">${escapeHTML(i18n.selectAllChapters.get())}</span>
        <span id="download-chapters-unselect-all" class="clickable">${escapeHTML(i18n.unselectAllChapters.get())}</span>
        <span id="download-chapters-add-new" class="clickable">${escapeHTML(i18n.addNewChapters.get())}</span>
      </div>
      ${chapters.map((c, i) => `<div><label>
        <input type="checkbox" id="ch-${c.id}" value="${c.id}" ${selectAll || selectedChapters.find(sel => sel.index === i) ? "checked" : ""} />
        <span>${escapeHTML(chapterTitleText(c.title))}</span></label></div>`).join("")}`;

    ([["#download-chapters-select-all", true], ["#download-chapters-unselect-all", false]] as [string, boolean][]).forEach(([id, checked]) =>
      this.chaptersElement.querySelector<HTMLElement>(id)?.addEventListener("click", () =>
        chapters.forEach(c => {
          const checkbox = this.chaptersElement.querySelector<HTMLInputElement>("#ch-" + c.id);
          if (checkbox) checkbox.checked = checked;
        })
      )
    );
    this.chaptersElement.querySelector<HTMLElement>("#download-chapters-add-new")?.addEventListener("click", (event) => {
      function modal(root: HTMLElement, target: HTMLElement, inner: string, onComfirm: (div: HTMLDivElement) => Promise<void>) {
        const div = document.createElement("div");
        div.style.position = "fixed";
        div.style.zIndex = "2100";
        div.style.padding = "3px";
        div.style.backgroundColor = "var(--ehvp-theme-bg-color)";
        div.style.border = "var(--ehvp-panel-border)";
        div.style.borderRadius = "5px";
        div.innerHTML = `
          <div style="display: flex; justify-content: center; margin: 10px 2px;">${inner}</div>
          <div style="display: flex; justify-content: center;">
            <button class="ehvp-custom-btn ehvp-modal-btn-cancel" style="background-color: gray;">${escapeHTML(i18n.modalCancel.get())}</button>
            <button class="ehvp-custom-btn ehvp-modal-btn-confirm" style="background-color: var(--ehvp-clickable-color-hover);">${escapeHTML(i18n.modalConfirm.get())}</button>
          </div>
        `;
        root.appendChild(div);
        div.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel")?.addEventListener("click", () => div.remove());
        div.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")?.addEventListener("click", () => onComfirm(div).finally(() => div.remove()));
        relocateElement(div, target, root.offsetWidth, root.offsetHeight);
      }
      modal(this.root, event.target as HTMLElement,
        `<input id="download-chapters-add-input" style="width: 250px; background-color: #ffffff80;" placeholder="https://example.com" />`,
        async (div) => {
          const value = div.querySelector<HTMLInputElement>("#download-chapters-add-input")?.value;
          if (!value) return;
          const future = EBUS.emit("pf-append-chapters", value);
          if (future) await future;
          // this.createChapterSelectList
        });
    });
  }

  selectedChapters() {
    const idSet = new Set<number>();
    this.chaptersElement.querySelectorAll<HTMLInputElement>("input[type=checkbox][id^=ch-]:checked")
      .forEach(checkbox => idSet.add(Number(checkbox.value)));
    return idSet;
  }

  initCherryPick(onAdd: (chIndex: number, range: CherryPickRange) => CherryPickRange[] | null, onRemove: (chIndex: number, id: string) => void, onClear: (chIndex: number) => void, getRangeList: (chIndex: number) => CherryPickRange[] | null) {
    let chapterIndex = 0; // chapterIndex will be changed on event bus: pf-change-chapter
    function addRangeElements(container: HTMLElement, rangeList: CherryPickRange[], onRemove: (id: string) => void) {
      container.querySelectorAll(".ehvp-custom-panel-item-value").forEach(e => e.remove());
      const tamplate = document.createElement("div");
      rangeList.forEach(range => {
        const str = `<span class="ehvp-custom-panel-item-value" data-id="${range.id}"><span >${range.toString()}</span><span class="ehvp-custom-btn ehvp-custom-btn-plain" style="padding:0;border:none;">&nbspx&nbsp</span></span>`;
        tamplate.innerHTML = str;
        const element = tamplate.firstElementChild as HTMLElement;
        element.style.backgroundColor = range.positive ? "#7fef7b" : "#ffa975";
        container.appendChild(element);
        element.querySelector(".ehvp-custom-btn")!.addEventListener("click", (event) => {
          const parent = (event.target as HTMLElement).parentElement!;
          onRemove(parent.getAttribute("data-id")!);
          parent.remove();
        });
        tamplate.remove();
      });
    }
    const pickBTN = q<HTMLButtonElement>("#download-cherry-pick-btn-add", this.cherryPickElement);
    const excludeBTN = q<HTMLButtonElement>("#download-cherry-pick-btn-exclude", this.cherryPickElement);
    const clearBTN = q<HTMLButtonElement>("#download-cherry-pick-btn-clear", this.cherryPickElement);
    const rangeBeforeSpan = q<HTMLButtonElement>("#download-cherry-pick-btn-range-before", this.cherryPickElement);
    const rangeAfterSpan = q<HTMLButtonElement>("#download-cherry-pick-btn-range-after", this.cherryPickElement);
    const input = q<HTMLInputElement>("#download-cherry-pick-input", this.cherryPickElement);
    const addCherryPick = (exclude: boolean, range?: string) => {
      const rangeList = range ?
        [CherryPickRange.from((exclude ? "!" : "") + range)].filter(r => r !== null) as CherryPickRange[] :
        (input.value || "").split(",").map(s => (exclude ? "!" : "") + s).map(CherryPickRange.from).filter(r => r !== null) as CherryPickRange[];
      if (rangeList.length > 0) {
        rangeList.forEach(range => {
          const newList = onAdd(chapterIndex, range);
          if (newList === null) return;
          addRangeElements(this.cherryPickElement.firstElementChild as HTMLElement, newList, (id) => onRemove(chapterIndex, id))
        });
      }
      input.value = "";
      input.focus();
    }
    const clearPick = () => {
      onClear(chapterIndex);
      addRangeElements(this.cherryPickElement.firstElementChild as HTMLElement, [], (id) => onRemove(chapterIndex, id))
      input.value = "";
      input.focus();
    }
    pickBTN.addEventListener("click", () => addCherryPick(false));
    excludeBTN.addEventListener("click", () => addCherryPick(true));
    clearBTN.addEventListener("click", clearPick);
    this.cherryPickElement.querySelectorAll(".download-cherry-pick-follow-btn").forEach(btn => {
      const followBTNClick = () => {
        const step = parseInt(btn.getAttribute("data-sibling-step") || "1");
        let sibling = btn;
        for (let i = 0; i < step; i++) {
          sibling = sibling.previousElementSibling as HTMLElement;
        }
        if (step <= 1) {
          clearPick();
        }
        addCherryPick(step > 1, sibling.getAttribute("data-range") || undefined);
      }
      btn.addEventListener("click", followBTNClick);
    });

    input.addEventListener("keypress", (event) => event.key === "Enter" && addCherryPick(false));

    let lastIndex: number = 0;
    EBUS.subscribe("add-cherry-pick-range", (chIndex, index, positive, shiftKey) => {
      const range = new CherryPickRange([index + 1, shiftKey ? (lastIndex ?? index) + 1 : index + 1], positive);
      if (!shiftKey) lastIndex = index;
      addRangeElements(this.cherryPickElement.firstElementChild as HTMLElement, onAdd(chIndex, range) || [], (id) => onRemove(chIndex, id));
    });
    EBUS.subscribe("get-cherry-pick-last-index", () => lastIndex);
    EBUS.subscribe("pf-change-chapter", (index) => {
      if (index === -1) return;
      chapterIndex = index;
      addRangeElements(this.cherryPickElement.firstElementChild as HTMLElement, getRangeList(chapterIndex) || [], (id) => onRemove(chapterIndex, id));
    });
    let pad = 0;
    EBUS.subscribe("pf-on-appended", (total) => {
      pad = total.toString().length;
      const rAfter = rangeAfterSpan.getAttribute("data-range")!.split("-").map(v => v.padStart(pad, "0")).join("-");
      rangeAfterSpan.textContent = rAfter;
      rangeAfterSpan.setAttribute("data-range", rAfter);
      const rBefore = rangeBeforeSpan.getAttribute("data-range")!.split("-").map((v, i) => i === 1 ? total.toString() : v.padStart(pad, "0")).join("-")
      rangeBeforeSpan.textContent = rBefore;
      rangeBeforeSpan.setAttribute("data-range", rBefore);
    })
    EBUS.subscribe("ifq-do", (index) => {
      const rAfter = [1, index + 1].map(v => v.toString().padStart(pad, "0")).join("-");
      rangeAfterSpan.textContent = rAfter;
      rangeAfterSpan.setAttribute("data-range", rAfter);
      const rBefore = rangeBeforeSpan.getAttribute("data-range")!.split("-").map((v, i) => i === 0 ? (index + 1).toString().padStart(pad, "0") : v).join("-")
      rangeBeforeSpan.textContent = rBefore;
      rangeBeforeSpan.setAttribute("data-range", rBefore);
    });
  }


  static html() {
    return `
<div id="downloader-panel" class="p-panel p-downloader p-collapse">
    <div id="download-notice" class="download-notice" style="font-size: 0.7em;"></div>
    <div id="download-eagle-result" class="download-eagle-result" role="status" aria-live="polite" hidden></div>
    <div id="download-middle" class="download-middle">
      <div class="ehvp-tabs">
        <a id="download-tab-status" class="clickable ehvp-p-tab">${i18n.status.get()}</a>
        <a id="download-tab-cherry-pick" class="clickable ehvp-p-tab">${i18n.cherryPick.get()}</a>
        <a id="download-tab-chapters" class="clickable ehvp-p-tab">${i18n.selectChapters.get()}</a>
      </div>
      <div>
        <div id="download-status" class="download-status" hidden>
          <canvas id="downloader-canvas" width="0" height="0"></canvas>
        </div>
        <div id="download-cherry-pick" class="download-cherry-pick" hidden>
          <div class="ehvp-custom-panel-item-values" style="text-align: start;">
            <div style="margin-bottom: 1rem;display: flex;">
              <input type="text" class="ehvp-custom-panel-item-input" id="download-cherry-pick-input" placeholder="1, 2-3" style="text-align: start; width: 50%; height: 1.3rem; border-radius: 0px;" />
              <span class="ehvp-custom-btn ehvp-custom-btn-green" id="download-cherry-pick-btn-add">${escapeHTML(i18n.cherryPickPick.get())}</span>
              <span class="ehvp-custom-btn ehvp-custom-btn-plain" id="download-cherry-pick-btn-exclude">${escapeHTML(i18n.cherryPickExclude.get())}</span>
              <span class="ehvp-custom-btn ehvp-custom-btn-plain" id="download-cherry-pick-btn-clear">${escapeHTML(i18n.cherryPickClear.get())}</span>
            </div>
            <div style="margin-bottom: 1rem;">
              <div style="margin-bottom: 0.2rem">
                <span class="ehvp-custom-panel-item-span" id="download-cherry-pick-btn-range-after" data-range="1-1">1-1</span><span
                 class="ehvp-custom-btn ehvp-custom-btn-green download-cherry-pick-follow-btn" data-sibling-step="1">${escapeHTML(i18n.cherryPickPick.get())}</span><span
                 class="ehvp-custom-btn ehvp-custom-btn-plain download-cherry-pick-follow-btn" data-sibling-step="2">${escapeHTML(i18n.cherryPickExclude.get())}</span>
              </div>
              <div>
                <span class="ehvp-custom-panel-item-span" id="download-cherry-pick-btn-range-before" data-range="1-1">1-1</span><span
                class="ehvp-custom-btn ehvp-custom-btn-green download-cherry-pick-follow-btn" data-sibling-step="1">${escapeHTML(i18n.cherryPickPick.get())}</span><span
                class="ehvp-custom-btn ehvp-custom-btn-plain download-cherry-pick-follow-btn" data-sibling-step="2">${escapeHTML(i18n.cherryPickExclude.get())}</span>
              </div>
            </div>
          </div>
        </div>
        <div id="download-chapters" class="download-chapters" hidden></div>
      </div>
    </div>
    <div class="download-btn-group">
       <a id="download-force" class="clickable" title="${escapeAttr(i18n.forceDownloadTooltip.get())}">${i18n.forceDownload.get()}</a>
       <a id="download-start" style="color: rgb(120, 240, 80)" class="clickable" title="${escapeAttr(i18n.downloadStartTooltip.get())}">${i18n.downloadStart.get()}</a>
    </div>
</div>`;
  }
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHTML(value).replaceAll("'", "&#39;");
}

function chapterTitleText(title: string | string[]): string {
  return Array.isArray(title) ? title.join(",") : title;
}

function eagleImportResultText(details: string[], links: ResultLink[]): string {
  return [
    i18n.eagleImportResultTitle.get(),
    ...details,
    ...links.map(link => `${link.label}: ${link.url}`),
  ].join("\n");
}

function eagleImportPlanText(details: string[], headline?: string): string {
  return [
    i18n.eagleImportConfirmTitle.get(),
    headline || i18n.eagleImportConfirmMessage.get(),
    ...details,
  ].join("\n");
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand?.("copy") ?? false;
    textArea.remove();
    return ok;
  } catch {
    return false;
  }
}

function focusNextInDialog(dialog: HTMLElement, reverse: boolean): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"))
    .filter(element => element.tabIndex >= 0 && !element.hasAttribute("disabled"));
  if (focusable.length === 0) {
    dialog.focus();
    return;
  }
  const current = document.activeElement instanceof HTMLElement ? focusable.indexOf(document.activeElement) : -1;
  const next = reverse
    ? current <= 0 ? focusable.length - 1 : current - 1
    : current < 0 || current >= focusable.length - 1 ? 0 : current + 1;
  focusable[next].focus();
}
