import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

export type HDoujinMetadataSource = {
  title?: unknown,
  subtitle?: unknown,
  tags?: HDoujinTagSource[],
  created_at?: unknown,
  publishedAt?: unknown,
};

type HDoujinTagSource = {
  namespace: number,
  name: string,
  count?: number,
};

export function hdoujinPublishedAt(value: Pick<HDoujinMetadataSource, "created_at"> | Pick<HDoujinMetadataSource, "publishedAt">): string {
  const timestamp = (value as { publishedAt?: unknown }).publishedAt ?? (value as { created_at?: unknown }).created_at;
  return cleanHDoujinValue(timestamp);
}

export function hdoujinGalleryMeta(gallery: Pick<HDoujinMetadataSource, "title" | "subtitle" | "tags">, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, cleanHDoujinValue(gallery.title) || "hdoujin");
  meta.originTitle = cleanHDoujinValue(gallery.subtitle) || undefined;
  for (const tag of gallery.tags || []) {
    const tagName = hdoujinTagNamespace(tag.namespace);
    if (!meta.tags[tagName]) {
      meta.tags[tagName] = [];
    }
    meta.tags[tagName].push(cleanHDoujinValue(tag.name));
  }
  return meta;
}

function hdoujinTagNamespace(namespace: number): string {
  const map: Record<number, string> = {
    1: "artist",
    2: "circle",
    3: "parody",
    7: "uploader",
    8: "male_tags",
    9: "female_tags",
    11: "languages",
  };
  return map[namespace] ?? namespace.toString();
}

function cleanHDoujinValue(value: unknown): string {
  return cleanSourceTag(value);
}
