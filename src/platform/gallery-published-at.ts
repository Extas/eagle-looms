const DATE_CATEGORIES = new Set([
  "date",
  "upload date",
  "uploaded",
  "uploaded date",
  "posted",
  "posted date",
  "published",
  "published date",
  "release date",
  "released",
  "released date",
  "created",
  "created date",
  "added",
  "added date",
  "日期",
  "上传日期",
  "上傳日期",
  "发布日期",
  "發佈日期",
  "发布",
  "發佈",
  "创建日期",
  "建立日期",
]);

export function extractGalleryPublishedAt(
  root: ParentNode,
  rowSelector: string,
  categorySelector: string,
  valueSelector?: string,
): string {
  for (const row of root.querySelectorAll(rowSelector)) {
    const categoryElement = row.querySelector(categorySelector);
    const category = cleanCategory(categoryElement?.textContent);
    if (!DATE_CATEGORIES.has(category)) continue;

    const value = cleanDateValue(valueSelector
      ? row.querySelector(valueSelector)?.textContent
      : rowTextWithoutCategory(row, categorySelector));
    if (value) return value;
  }
  return "";
}

function rowTextWithoutCategory(row: Element, categorySelector: string): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelector(categorySelector)?.remove();
  return clone.textContent || "";
}

function cleanCategory(value: unknown): string {
  return String(value ?? "")
    .replace(/[:：]\s*$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\(\s*s\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanDateValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
