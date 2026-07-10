import { cleanSourceTag } from "./source-tags";

export function yabaiPublishedAt(value: { date?: { default?: unknown, human?: unknown, [key: string]: unknown } }): string {
  const raw = value.date?.default || value.date?.human || "";
  return cleanYabaiValue(raw);
}

function cleanYabaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
