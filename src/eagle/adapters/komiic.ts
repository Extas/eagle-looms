import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

export type KomiicChapterMetadataSource = {
  dateCreated?: unknown,
  dateUpdated?: unknown,
};

export type KomiicComicMetadataSource = {
  title?: unknown,
  authors?: Array<{ name?: unknown, [key: string]: unknown }>,
  categories?: Array<{ name?: unknown, [key: string]: unknown }>,
};

export function komiicPublishedAt(value: Pick<KomiicChapterMetadataSource, "dateCreated" | "dateUpdated">): string {
  return cleanKomiicValue(value.dateCreated || value.dateUpdated || "");
}

export function komiicGalleryMeta(info: Pick<KomiicComicMetadataSource, "title" | "authors" | "categories">, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, cleanKomiicValue(info.title) || "komiic");
  meta.tags.authors = (info.authors || []).map(author => cleanKomiicValue(author.name)).filter(Boolean);
  meta.tags.categories = (info.categories || []).map(category => cleanKomiicValue(category.name)).filter(Boolean);
  return meta;
}

function cleanKomiicValue(value: unknown): string {
  return cleanSourceTag(value);
}
