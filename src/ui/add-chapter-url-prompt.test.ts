import { afterEach, describe, expect, it, vi } from "vitest";
import EBUS from "../event-bus";
import { i18n } from "../utils/i18n";
import { showAddChapterUrlPrompt } from "./add-chapter-url-prompt";

vi.mock("$", () => ({
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function createRoot() {
  const root = document.createElement("div");
  const anchor = document.createElement("button");
  root.appendChild(anchor);
  document.body.appendChild(root);
  return { root, anchor };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("add chapter URL prompt", () => {
  afterEach(() => {
    EBUS.reset();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("trims the URL, blocks duplicate submissions, and restores focus after success", async () => {
    const { root, anchor } = createRoot();
    const pending = deferred<void>();
    const onConfirm = vi.fn(() => pending.promise);
    anchor.focus();

    const dialog = showAddChapterUrlPrompt(root, anchor, onConfirm);
    const input = dialog.querySelector<HTMLInputElement>("#download-chapters-add-input")!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;

    expect(document.activeElement).toBe(input);
    expect(confirmButton.disabled).toBe(true);

    input.value = "  https://example.com/chapter/2  ";
    input.dispatchEvent(new Event("input"));
    confirmButton.click();
    confirmButton.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("https://example.com/chapter/2");
    expect(input.disabled).toBe(true);
    expect(confirmButton.disabled).toBe(true);

    pending.resolve();
    await pending.promise;
    await Promise.resolve();

    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(anchor);
  });

  it("reuses an open prompt and preserves what the user typed", () => {
    const { root, anchor } = createRoot();
    const first = showAddChapterUrlPrompt(root, anchor, vi.fn());
    const input = first.querySelector<HTMLInputElement>("#download-chapters-add-input")!;
    input.value = "https://example.com/in-progress";
    anchor.focus();

    const second = showAddChapterUrlPrompt(root, anchor, vi.fn());

    expect(second).toBe(first);
    expect(root.querySelectorAll(".ehvp-add-chapter-url-prompt")).toHaveLength(1);
    expect(input.value).toBe("https://example.com/in-progress");
    expect(document.activeElement).toBe(input);
  });

  it("keeps the prompt open and reports a failed append", async () => {
    const { root, anchor } = createRoot();
    const notify = vi.fn();
    EBUS.subscribe("notify-message", notify);
    const dialog = showAddChapterUrlPrompt(root, anchor, async () => {
      throw new Error("network unavailable");
    });
    const input = dialog.querySelector<HTMLInputElement>("#download-chapters-add-input")!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;
    input.value = "https://example.com/chapter/3";
    input.dispatchEvent(new Event("input"));

    confirmButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(dialog.isConnected).toBe(true);
    expect(input.disabled).toBe(false);
    expect(confirmButton.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(notify).toHaveBeenCalledWith(
      "error",
      i18n.addNewChaptersFailed.get().replace("{message}", "network unavailable"),
      6000,
    );
  });

  it("can close while pending without showing a late failure", async () => {
    const { root, anchor } = createRoot();
    const pending = deferred<void>();
    const notify = vi.fn();
    EBUS.subscribe("notify-message", notify);
    anchor.focus();
    const dialog = showAddChapterUrlPrompt(root, anchor, () => pending.promise);
    const input = dialog.querySelector<HTMLInputElement>("#download-chapters-add-input")!;
    input.value = "https://example.com/chapter/4";
    input.dispatchEvent(new Event("input"));
    dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!.click();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    pending.reject(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();

    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(anchor);
    expect(notify).not.toHaveBeenCalled();
  });

  it("keeps Tab focus inside the prompt", () => {
    const { root, anchor } = createRoot();
    const dialog = showAddChapterUrlPrompt(root, anchor, vi.fn());
    const input = dialog.querySelector<HTMLInputElement>("#download-chapters-add-input")!;
    const cancelButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-cancel")!;
    const confirmButton = dialog.querySelector<HTMLButtonElement>(".ehvp-modal-btn-confirm")!;
    input.value = "https://example.com/chapter/5";
    input.dispatchEvent(new Event("input"));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(cancelButton);
    cancelButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(confirmButton);
    confirmButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirmButton);
  });
});
