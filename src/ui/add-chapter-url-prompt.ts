import EBUS from "../event-bus";
import { i18n } from "../utils/i18n";
import relocateElement from "../utils/relocate-element";

const PROMPT_CLASS = "ehvp-add-chapter-url-prompt";

export function showAddChapterUrlPrompt(
  root: HTMLElement,
  anchor: HTMLElement,
  onConfirm: (url: string) => Promise<unknown> | unknown,
): HTMLDivElement {
  const existing = root.querySelector<HTMLDivElement>(`.${PROMPT_CLASS}`);
  if (existing) {
    const input = existing.querySelector<HTMLInputElement>("#download-chapters-add-input");
    const cancelButton = existing.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel");
    (input && !input.disabled ? input : cancelButton || existing).focus();
    return existing;
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const dialog = document.createElement("div");
  dialog.className = `ehvp-modal ${PROMPT_CLASS}`;
  dialog.tabIndex = -1;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "download-chapters-add-title");

  const title = document.createElement("div");
  title.id = "download-chapters-add-title";
  title.className = "ehvp-modal-title";
  title.textContent = i18n.addNewChapters.get();

  const body = document.createElement("div");
  body.className = "ehvp-modal-body";
  const input = document.createElement("input");
  input.id = "download-chapters-add-input";
  input.className = "ehvp-add-chapter-url-input";
  input.type = "url";
  input.inputMode = "url";
  input.placeholder = "https://example.com";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", i18n.addNewChapters.get());
  body.appendChild(input);

  const actions = document.createElement("div");
  actions.className = "ehvp-modal-actions";
  const cancelButton = document.createElement("button");
  cancelButton.className = "ehvp-custom-btn ehvp-custom-btn-plain ehvp-modal-btn-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = i18n.modalCancel.get();
  const confirmButton = document.createElement("button");
  confirmButton.className = "ehvp-custom-btn ehvp-custom-btn-green ehvp-modal-btn-confirm";
  confirmButton.type = "button";
  confirmButton.textContent = i18n.modalConfirm.get();
  actions.append(cancelButton, confirmButton);
  dialog.append(title, body, actions);

  let closed = false;
  let pending = false;

  const close = () => {
    if (closed) return;
    closed = true;
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  const syncControls = () => {
    input.disabled = pending;
    confirmButton.disabled = pending || input.value.trim().length === 0;
    dialog.setAttribute("aria-busy", pending ? "true" : "false");
  };

  const submit = () => {
    const url = input.value.trim();
    if (closed || pending || !url) return;

    input.value = url;
    pending = true;
    syncControls();
    void (async () => {
      try {
        await onConfirm(url);
        if (!closed) close();
      } catch (error) {
        if (closed) return;
        pending = false;
        syncControls();
        input.focus();
        EBUS.emit(
          "notify-message",
          "error",
          i18n.addNewChaptersFailed.get().replace("{message}", errorMessage(error)),
          6000,
        );
      }
    })();
  };

  input.addEventListener("input", syncControls);
  cancelButton.addEventListener("click", close);
  confirmButton.addEventListener("click", submit);
  dialog.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      event.preventDefault();
      focusNextInPrompt(dialog, event.shiftKey);
    } else if (event.key === "Enter" && (document.activeElement === input || document.activeElement === confirmButton)) {
      event.preventDefault();
      submit();
    }
  });

  root.appendChild(dialog);
  relocateElement(dialog, anchor, root.offsetWidth, root.offsetHeight);
  syncControls();
  input.focus();
  return dialog;
}

function focusNextInPrompt(dialog: HTMLElement, reverse: boolean): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, [tabindex]"))
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

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || "unknown error"))
    .replace(/\s+/g, " ")
    .trim() || "unknown error";
}
