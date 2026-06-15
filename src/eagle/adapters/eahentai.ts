import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

export type EahentaiMetadataSource = {
  title?: unknown,
  tags?: unknown,
  author?: unknown,
  albumType?: unknown,
  characters?: unknown,
  addDt?: unknown,
};

export function eahentaiPublishedAt(image: { addDt?: unknown }, gallery?: { addDt?: unknown }): string {
  return cleanEahentaiValue(image.addDt) || cleanEahentaiValue(gallery?.addDt);
}

export function eahentaiGalleryMeta(data: Pick<EahentaiMetadataSource, "title" | "tags" | "author" | "albumType" | "characters">, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, cleanEahentaiValue(data.title) || "eahentai");
  meta.tags.tags = splitEahentaiTags(data.tags);
  const author = cleanEahentaiValue(data.author);
  if (author) meta.tags.author = [author];
  meta.tags.albumType = splitEahentaiTags(data.albumType);
  meta.tags.characters = splitEahentaiTags(data.characters);
  return meta;
}

function splitEahentaiTags(value: unknown): string[] {
  return cleanEahentaiValue(value)
    .split("|")
    .map(cleanEahentaiValue)
    .filter(Boolean);
}

function cleanEahentaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
