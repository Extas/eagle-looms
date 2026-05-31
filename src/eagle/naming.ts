const EAGLE_ITEM_NAME_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;

export function createEagleItemName(rawTitle: string, usedNames: Set<string>, fallback = "image"): string {
  return deduplicate(usedNames, normalizeEagleItemName(rawTitle, fallback));
}

export function normalizeEagleItemName(rawTitle: string, fallback = "image"): string {
  const clean = String(rawTitle || "")
    .replace(EAGLE_ITEM_NAME_INVALID_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return clean || fallback;
}

function deduplicate(set: Set<string>, title: string): string {
  let next = title || "image";
  if (!set.has(next)) {
    set.add(next);
    return next;
  }
  const splits = next.split(".");
  const ext = splits.length > 1 ? splits.pop() : "";
  const prefix = splits.join(".") || next;
  let index = 1;
  do {
    next = ext ? `${prefix}_${index}.${ext}` : `${prefix}_${index}`;
    index += 1;
  } while (set.has(next));
  set.add(next);
  return next;
}
