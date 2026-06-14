type ArtStationAuthor = {
  username?: unknown;
  full_name?: unknown;
  permalink?: unknown;
};

export function normalizeArtStationTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.flatMap(artStationTagValues).map(cleanArtStationValue).filter(Boolean))];
}

export function artStationAuthorTag(value: ArtStationAuthor): string {
  const author = cleanArtStationValue(value.username) || cleanArtStationValue(value.full_name);
  return author ? `author:${author}` : "";
}

export function artStationAuthorUrl(value: ArtStationAuthor): string {
  const permalink = cleanArtStationValue(value.permalink);
  if (permalink && /^https?:\/\//i.test(permalink)) return permalink;
  const username = cleanArtStationValue(value.username);
  return username ? `https://www.artstation.com/${username}` : "";
}

function artStationTagValues(value: unknown): unknown[] {
  if (typeof value === "string" || typeof value === "number") return [value];
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["name", "tag", "title", "label", "slug", "value"]) {
    if (typeof object[key] === "string" || typeof object[key] === "number") return [object[key]];
  }
  return [];
}

function cleanArtStationValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
