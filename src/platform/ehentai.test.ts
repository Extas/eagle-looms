import { describe, expect, it, vi } from "vitest";
import { defaultConf } from "../config";
import { ADAPTER } from "./adapt";
import { EHMatcher } from "./matchers/ehentai";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("E-Hentai matcher metadata", () => {
  it("propagates the gallery Posted date to every page image", async () => {
    const html = `
      <section id="gdd">
        <table>
          <tr><td class="gdt1">Posted:</td><td class="gdt2">2026-07-18 03:51</td></tr>
          <tr><td class="gdt1">Length:</td><td class="gdt2">158 pages</td></tr>
        </table>
      </section>
      <div id="gdt">
        <div class="gdtl">
          <a href="https://e-hentai.org/s/7b3f568c3d/4060522-1">
            <img src="https://ehgt.org/4060522-0.webp" title="Page 1: 1.jpg">
          </a>
        </div>
        <div class="gdtl">
          <a href="https://e-hentai.org/s/5f8b930e45/4060522-2">
            <img src="https://ehgt.org/4060522-1.webp" title="Page 2: a_1.jpg">
          </a>
        </div>
      </div>
    `;
    ADAPTER.conf = defaultConf();
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue({
      text: async () => html,
    } as Response);

    try {
      const nodes = await new EHMatcher().parseImgNodes("https://e-hentai.org/g/4060522/16d0540801/");

      expect(nodes.map(node => node.title)).toEqual(["1.jpg", "a_1.jpg"]);
      expect(nodes.map(node => node.href)).toEqual([
        "https://e-hentai.org/s/7b3f568c3d/4060522-1",
        "https://e-hentai.org/s/5f8b930e45/4060522-2",
      ]);
      expect(nodes.map(node => node.publishedAt)).toEqual([
        "2026-07-18 03:51",
        "2026-07-18 03:51",
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
