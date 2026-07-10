import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

export function wnacgGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanWnacgText(doc.querySelector<HTMLTitleElement>("#bodywrap > h2")?.textContent) || "unknown";
  const meta = new GalleryMeta(href, title);
  const tags = uniqueWnacgValues(Array.from(doc.querySelectorAll(".asTB .tagshow")).map(ele => ele.textContent));
  const description = uniqueWnacgValues(Array.from(doc.querySelector(".asTB > .asTBcell.uwconn > p")?.childNodes || []).map(e => e.textContent));
  meta.tags = { tags, description };
  return meta;
}

function uniqueWnacgValues(values: unknown[]): string[] {
  return [...new Set(values.map(cleanWnacgText).filter(Boolean))];
}

function cleanWnacgText(value: unknown): string {
  return cleanSourceTag(value);
}
