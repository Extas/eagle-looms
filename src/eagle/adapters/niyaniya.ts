import { cleanSourceTag } from "./source-tags";

type BookTagSource = {
  name: string,
  count?: number,
  namespace?: number,
};

export function niyaniyaPublishedAt(value: { created_at?: unknown }): string {
  return cleanNiyaniyaValue(value.created_at);
}

export function niyaniyaTagsFromDetail(value: { tags?: BookTagSource[] }): Record<string, string[]> {
  return (value.tags || []).reduce<Record<string, string[]>>((map, tag) => {
    const category = NAMESPACE_MAP[tag.namespace || 0] || "misc";
    if (!map[category]) map[category] = [];
    map[category].push(cleanNiyaniyaValue(tag.name));
    return map;
  }, {});
}

const NAMESPACE_MAP: Record<number, string> = {
  0: "misc",
  1: "artist",
  2: "circle",
  3: "parody",
  7: "uploader",
  8: "male",
  9: "female",
  10: "mixed",
  11: "language",
};

function cleanNiyaniyaValue(value: unknown): string {
  return cleanSourceTag(value);
}
