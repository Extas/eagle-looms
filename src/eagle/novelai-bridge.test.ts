import { describe, expect, it } from "vitest";
import {
  buildNovelAiGeneratedItemInput,
  eagleItemImageCandidates,
  eagleItemLink,
  isNovelAiImageToolsUrl,
  novelAiGeneratedTags,
  normalizeMonitorLimit,
  parseEagleItemId,
  pasteImageIntoNovelAi,
} from "./novelai-bridge";

describe("NovelAI Eagle bridge", () => {
  it("detects only NovelAI image tools pages", () => {
    expect(isNovelAiImageToolsUrl("https://novelai.net/imagetools")).toBe(true);
    expect(isNovelAiImageToolsUrl("https://novelai.net/imagetools/")).toBe(true);
    expect(isNovelAiImageToolsUrl("https://novelai.net/image")).toBe(false);
    expect(isNovelAiImageToolsUrl("https://example.test/imagetools")).toBe(false);
  });

  it("parses Eagle item links and raw ids", () => {
    expect(parseEagleItemId("http://localhost:41595/item?id=MQFVMXHVIRSIQ")).toBe("MQFVMXHVIRSIQ");
    expect(parseEagleItemId("https://x.test/path?foo=1&id=ABC%20123#hash")).toBe("ABC 123");
    expect(parseEagleItemId("RAWID")).toBe("RAWID");
    expect(parseEagleItemId("")).toBe("");
  });

  it("builds canonical Eagle item links from the configured API base", () => {
    expect(eagleItemLink("http://localhost:41595/api/v2/", "ITEM1")).toBe("http://localhost:41595/item?id=ITEM1");
  });

  it("keeps only fetchable image candidates from Eagle item fields", () => {
    expect(eagleItemImageCandidates({
      id: "ITEM1",
      fileURL: "eagle://asset/ITEM1",
      thumbnailURL: "/thumbnail/ITEM1.png",
      url: "https://cdn.example.test/media?id=ITEM1",
      annotation: JSON.stringify({
        sourceUrl: "https://x.com/knokzm/status/2066471849245208805/photo/1",
        originUrl: "https://pbs.twimg.com/media/HK2U4XSa0AAd2Vx?format=jpg&name=large",
      }),
      website: "https://example.test/posts/ITEM1",
    }, "http://localhost:41595")).toEqual([
      "https://pbs.twimg.com/media/HK2U4XSa0AAd2Vx?format=jpg&name=large",
      "http://localhost:41595/thumbnail/ITEM1.png",
    ]);
  });

  it("clamps monitor limits to a small explicit range", () => {
    expect(normalizeMonitorLimit(undefined)).toBe(2);
    expect(normalizeMonitorLimit(0)).toBe(1);
    expect(normalizeMonitorLimit(999)).toBe(20);
    expect(normalizeMonitorLimit("3")).toBe(3);
  });

  it("builds generated result payloads for the source item's folders", () => {
    const input = buildNovelAiGeneratedItemInput({
      sourceItem: {
        id: "SRC1",
        name: "2026-06-14 User Media.jpg",
        url: "https://pbs.twimg.com/media/source.jpg",
        folders: ["folder-a", "folder-a", "folder-b"],
        tags: ["site:x.com", "copyright:bang dream", "character:anon tokyo", "source:published:2026-06-14"],
      },
      sourceItemLink: "http://localhost:41595/item?id=SRC1",
      pageUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(Date.UTC(2026, 5, 16, 3, 4, 5)),
      resultIndex: 2,
      contentType: "image/png",
      base64: "abc",
    });

    expect(input.name).toBe("2026-06-14 User Media - NovelAI -- el1[tool=novelai;at=20260616T030405Z;seq=02;src=SRC1].png");
    expect(input.folders).toEqual(["folder-a", "folder-b"]);
    expect(input.tags).toEqual(["tool:novelai", "copyright:bang dream", "character:anon tokyo"]);
    expect(input.website).toBe("https://novelai.net/imagetools");
    expect(input.base64).toBe("data:image/png;base64,abc");
    expect(JSON.parse(input.annotation!)).toEqual({
      schema: "eagle-looms/novelai-bridge/v1",
      sourceItemId: "SRC1",
      sourceItemName: "2026-06-14 User Media.jpg",
      sourceItemLink: "http://localhost:41595/item?id=SRC1",
      sourceUrl: "https://pbs.twimg.com/media/source.jpg",
      novelAiUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(Date.UTC(2026, 5, 16, 3, 4, 5)).toISOString(),
    });
  });

  it("keeps NovelAI result tags semantic and searchable", () => {
    expect(novelAiGeneratedTags([
      "eagle-looms",
      "site:x.com",
      "gallery:twitter-user",
      "ext:jpg",
      "mime:image/jpeg",
      "tool:novelai",
      "copyright:bang dream",
      "character:anon tokyo",
      "author:knokzm",
      "blue eyes",
    ])).toEqual([
      "tool:novelai",
      "copyright:bang dream",
      "character:anon tokyo",
      "author:knokzm",
      "blue eyes",
    ]);
  });

  it("uses the NovelAI page bridge before isolated-world fallbacks", async () => {
    document.body.innerHTML = `<textarea id="prompt"></textarea>`;
    const bridgeCalls: Array<{ fileName: string; type: string; dataUrl: string }> = [];
    Object.defineProperty(window, "__EagleLoomsNovelAiBridgeV1", {
      configurable: true,
      value: {
        version: 1,
        async importImage(payload: { fileName: string; type: string; dataUrl: string }) {
          bridgeCalls.push(payload);
          const image = document.createElement("img");
          image.src = "blob:https://novelai.net/page-bridge-source-image";
          document.body.appendChild(image);
          return {
            confirmed: true,
            inputs: 1,
            inputHandlers: 1,
            inputEvents: 0,
            initialDropTargets: 0,
            activeDropTargets: 0,
            dropHandlers: 0,
            domDrops: 0,
          };
        },
      },
    });

    try {
      const result = await pasteImageIntoNovelAi(new Blob(["image"], { type: "image/png" }), "bridge-source.png");

      expect(result.confirmed).toBe(true);
      expect(result.pageBridge).toBe(true);
      expect(result.reactInputs).toBe(1);
      expect(result.fileInputs).toBe(0);
      expect(result.dropTargets).toBe(0);
      expect(bridgeCalls).toHaveLength(1);
      expect(bridgeCalls[0].fileName).toBe("bridge-source.png");
      expect(bridgeCalls[0].type).toBe("image/png");
      expect(bridgeCalls[0].dataUrl).toMatch(/^data:image\/png;base64,/);
    } finally {
      delete (window as unknown as Record<string, unknown>).__EagleLoomsNovelAiBridgeV1;
    }
  });

  it("imports into NovelAI through its React image input handler before paste fallbacks", async () => {
    document.body.innerHTML = `
      <textarea id="prompt"></textarea>
      <input id="image-upload" type="file" accept="image/*">
    `;
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")!;
    const input = document.querySelector<HTMLInputElement>("#image-upload")!;
    const promptPastes: Event[] = [];
    Object.defineProperty(input, "__reactProps$test", {
      configurable: true,
      value: {
        onChange(event: Event & { target: HTMLInputElement }) {
          "readAsArrayBuffer";
          if (!event.target.files?.length) return;
          const image = document.createElement("img");
          image.src = "blob:https://novelai.net/source-image";
          document.body.appendChild(image);
        },
      },
    });
    prompt.addEventListener("paste", event => promptPastes.push(event));
    prompt.focus();

    const result = await pasteImageIntoNovelAi(new Blob(["image"], { type: "image/png" }), "source-name.png");

    expect(result.confirmed).toBe(true);
    expect(result.reactInputs).toBe(1);
    expect(result.fileInputs).toBe(0);
    expect(result.pasteTargets).toBe(0);
    expect(result.dropTargets).toBe(0);
    expect(input.files?.[0]?.name).toBe("source-name.png");
    expect(prompt.value).toBe("");
    expect(promptPastes).toHaveLength(0);
  });

  it("drops into NovelAI's upload overlay when the file input path is unavailable", async () => {
    document.body.innerHTML = `
      <main id="surface"></main>
      <div id="overlay"></div>
      <textarea id="prompt"></textarea>
    `;
    const overlay = document.querySelector<HTMLElement>("#overlay")!;
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")!;
    const promptPastes: Event[] = [];
    Object.defineProperty(overlay, "__reactProps$test", {
      configurable: true,
      value: {
        async onDrop(event: Event & { dataTransfer: DataTransfer }) {
          "dataTransfer.files";
          if (!event.dataTransfer.files.length) return;
          const image = document.createElement("img");
          image.src = "blob:https://novelai.net/overlay-source-image";
          document.body.appendChild(image);
        },
      },
    });
    prompt.addEventListener("paste", event => promptPastes.push(event));
    prompt.focus();

    const result = await pasteImageIntoNovelAi(new Blob(["image"], { type: "image/png" }), "overlay-source.png");

    expect(result.confirmed).toBe(true);
    expect(result.reactInputs).toBe(0);
    expect(result.fileInputs).toBe(0);
    expect(result.dropTargets).toBe(1);
    expect(result.pasteTargets).toBe(0);
    expect(prompt.value).toBe("");
    expect(promptPastes).toHaveLength(0);
  });

  it("does not send file names as text when paste fallback is needed", async () => {
    document.body.innerHTML = `<main id="surface"></main><textarea id="prompt"></textarea>`;
    const prompt = document.querySelector<HTMLTextAreaElement>("#prompt")!;
    const clipboardWrites = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const pastedText: string[] = [];
    document.querySelector<HTMLElement>("#surface")!.addEventListener("paste", (event) => {
      pastedText.push((event as ClipboardEvent).clipboardData?.getData("text/plain") || "");
    });
    prompt.addEventListener("paste", () => pastedText.push("prompt"));
    prompt.focus();

    let error: unknown;
    try {
      await pasteImageIntoNovelAi(new Blob(["image"], { type: "image/png" }), "should-not-enter-prompt.png");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect(pastedText).not.toContain("should-not-enter-prompt.png");
    expect(pastedText).not.toContain("prompt");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboardWrites,
    });
  }, 10000);
});
