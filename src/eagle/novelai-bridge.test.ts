import { describe, expect, it } from "vitest";
import {
  buildNovelAiGeneratedItemInput,
  eagleItemIdFromSourceUrl,
  eagleItemImageCandidates,
  eagleItemLink,
  isNovelAiImageToolsUrl,
  novelAiGeneratedTags,
  novelAiSourceFromEagleItem,
  novelAiSourceFromUrl,
  normalizeNovelAiResultBlob,
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

  it("detects Eagle item links only from the configured Eagle API origin", () => {
    expect(eagleItemIdFromSourceUrl("http://localhost:41595/item?id=ITEM1", "http://localhost:41595/?token=abc")).toBe("ITEM1");
    expect(eagleItemIdFromSourceUrl("http://localhost:41596/item?id=ITEM1", "http://localhost:41595")).toBe("");
    expect(eagleItemIdFromSourceUrl("https://x.com/user/status/1", "http://localhost:41595")).toBe("");
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

  it("finds direct image URLs embedded in Eagle Looms V2 annotation text", () => {
    expect(eagleItemImageCandidates({
      id: "ITEM1",
      annotation: JSON.stringify({
        schema: "eagle-looms/item/v1",
        stableKey: "eagle-looms:v2:https://x.com/a/status/1/photo/1|https://pbs.twimg.com/media/abc?format=jpg&name=large|",
      }),
    }, "http://localhost:41595")).toEqual([
      "https://pbs.twimg.com/media/abc?format=jpg&name=large",
    ]);
  });

  it("clamps monitor limits to a small explicit range", () => {
    expect(normalizeMonitorLimit(undefined)).toBe(2);
    expect(normalizeMonitorLimit(0)).toBe(1);
    expect(normalizeMonitorLimit(999)).toBe(20);
    expect(normalizeMonitorLimit("3")).toBe(3);
  });

  it("extracts stable source context from source URLs", () => {
    expect(novelAiSourceFromUrl("https://twitter.com/knokzm/status/2066471849245208805/photo/1#hash")).toEqual({
      id: "x.com-2066471849245208805",
      title: "x.com knokzm status 2066471849245208805",
      url: "https://twitter.com/knokzm/status/2066471849245208805/photo/1",
      site: "x.com",
      tags: ["site:x.com", "author:knokzm"],
      metadata: {
        sourceAuthor: "knokzm",
        sourceWorkId: "2066471849245208805",
      },
    });
    expect(novelAiSourceFromUrl("eagle://item/ABC")).toBeUndefined();
  });

  it("builds generated result payloads from the source URL context", () => {
    const source = novelAiSourceFromUrl("https://x.com/knokzm/status/2066471849245208805/photo/1")!;
    const input = buildNovelAiGeneratedItemInput({
      source,
      pageUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(Date.UTC(2026, 5, 16, 3, 4, 5)),
      resultIndex: 2,
      contentType: "image/png",
      base64: "abc",
    });

    expect(input.name).toBe("x.com knokzm status 2066471849245208805 - NovelAI -- el1[tool=novelai;at=20260616T030405Z;seq=02;src=x.com-2066471849245208805].png");
    expect(input.folders).toBeUndefined();
    expect(input.tags).toEqual(["tool:novelai", "site:x.com", "author:knokzm"]);
    expect(input.website).toBe("https://x.com/knokzm/status/2066471849245208805/photo/1");
    expect(input.base64).toBe("data:image/png;base64,abc");
    expect(JSON.parse(input.annotation!)).toEqual({
      schema: "eagle-looms/novelai-bridge/v1",
      sourceId: "x.com-2066471849245208805",
      sourceTitle: "x.com knokzm status 2066471849245208805",
      sourceUrl: "https://x.com/knokzm/status/2066471849245208805/photo/1",
      sourceSite: "x.com",
      sourceAuthor: "knokzm",
      sourceWorkId: "2066471849245208805",
      novelAiUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(Date.UTC(2026, 5, 16, 3, 4, 5)).toISOString(),
    });
  });

  it("builds generated result payloads for an Eagle item source folder", () => {
    const source = novelAiSourceFromEagleItem({
      id: "SRC1",
      name: "Clipboard - 2026-06-16 13.42.29.png",
      folders: ["folder-a", "folder-b"],
      tags: ["copyright:bang dream", "site:x.com", "source:published:2026-06-16"],
      url: "",
    }, "http://localhost:41595/item?id=SRC1");
    const input = buildNovelAiGeneratedItemInput({
      source,
      pageUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(Date.UTC(2026, 5, 16, 3, 4, 5)),
      resultIndex: 1,
      contentType: "image/png",
      base64: "abc",
    });

    expect(source.title).toBe("Clipboard - 2026-06-16 13.42.29");
    expect(source.site).toBe("eagle");
    expect(input.folders).toEqual(["folder-a", "folder-b"]);
    expect(input.website).toBe("http://localhost:41595/item?id=SRC1");
    expect(input.tags).toEqual(["tool:novelai", "copyright:bang dream"]);
    expect(JSON.parse(input.annotation!)).toMatchObject({
      sourceId: "SRC1",
      sourceItemId: "SRC1",
      sourceItemLink: "http://localhost:41595/item?id=SRC1",
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

  it("normalizes NovelAI result blobs from binary signatures", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = await normalizeNovelAiResultBlob(new Blob([jpegHeader], { type: "image/png" }), "blob:https://novelai.net/result");

    expect(result.contentType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("uses the NovelAI page bridge before isolated-world fallbacks", async () => {
    document.body.innerHTML = `<textarea id="prompt"></textarea>`;
    const bridgeCalls: Array<{ fileName: string; type: string; dataUrl: string }> = [];
    Object.defineProperty(window, "__EagleLoomsNovelAiBridgeV2", {
      configurable: true,
      value: {
        version: 2,
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
      delete (window as unknown as Record<string, unknown>).__EagleLoomsNovelAiBridgeV2;
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
