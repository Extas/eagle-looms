import { cleanSourceTag } from "./source-tags";

export function hitomiPublishedAt(info: Partial<Record<string, unknown>>): string {
  for (const key of ["date", "published_at", "publishedAt", "upload_date", "uploaded_at", "created_at", "created"]) {
    const value = cleanHitomiValue(info[key]);
    if (value) return value;
  }
  return "";
}

function cleanHitomiValue(value: unknown): string {
  return cleanSourceTag(value);
}
