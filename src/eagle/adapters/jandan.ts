import { cleanSourceTag, eagleAuthorSourceTags } from "./source-tags";

export type JandanMetadataSource = {
  author?: unknown,
  date_gmt?: unknown,
  date?: unknown,
};

export function jandanSourceTags(comment: Pick<JandanMetadataSource, "author">): string[] {
  const author = cleanJandanValue(comment.author);
  return eagleAuthorSourceTags(author);
}

export function jandanPublishedAt(comment: Pick<JandanMetadataSource, "date_gmt" | "date">): string {
  return cleanJandanValue(comment.date_gmt || comment.date || "");
}

function cleanJandanValue(value: unknown): string {
  return cleanSourceTag(value);
}
