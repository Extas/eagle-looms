import { cleanSourceTag } from "./source-tags";

export function kuaiKanPublishedAt(value: { created_at?: unknown }): string {
  const raw = cleanKuaiKanValue(value.created_at);
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (short) return `20${short[1]}-${short[2]}-${short[3]}`;
  return raw;
}

function cleanKuaiKanValue(value: unknown): string {
  return cleanSourceTag(value);
}
