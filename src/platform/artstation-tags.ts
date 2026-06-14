type ArtStationAuthor = {
  username?: unknown;
  full_name?: unknown;
  permalink?: unknown;
};

export function normalizeArtStationTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(cleanArtStationValue).filter(Boolean))];
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

function cleanArtStationValue(value: unknown): string {
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
