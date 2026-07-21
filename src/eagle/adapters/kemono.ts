import { parse as parsePostgresArray } from "postgres-array";
import { cleanSourceTag, eagleAuthorSourceTags } from "./source-tags";

export type KemonoMetadataSource = {
  service?: unknown,
  user?: unknown,
  tags?: unknown,
  artist?: KemonoAuthorSource,
  creator?: KemonoAuthorSource,
  published?: unknown,
  added?: unknown,
  edited?: unknown,
};

type KemonoAuthorSource = {
  id?: unknown,
  name?: unknown,
  username?: unknown,
  service?: unknown,
};

export function kemonoSourceTags(
  post: Pick<KemonoMetadataSource, "service" | "user" | "tags" | "artist" | "creator">,
  pageAuthor = "",
): string[] {
  const author = kemonoAuthorName(post, pageAuthor);
  return eagleAuthorSourceTags(author, kemonoTagValues(post.tags));
}

export function kemonoAuthorUrls(post: Pick<KemonoMetadataSource, "service" | "user" | "artist" | "creator">, origin = "https://kemono.cr"): string[] {
  const service = cleanKemonoValue(stringValue(post.service) || stringValue(post.artist?.service) || stringValue(post.creator?.service));
  const user = cleanKemonoValue(stringValue(post.user) || stringValue(post.artist?.id) || stringValue(post.creator?.id));
  if (!service || !user) return [];
  return [`${origin.replace(/\/+$/, "")}/${encodeURIComponent(service)}/user/${encodeURIComponent(user)}`];
}

export function kemonoPublishedAt(post: Pick<KemonoMetadataSource, "published" | "added" | "edited">): string {
  return cleanKemonoValue(post.published || post.added || post.edited || "");
}

function kemonoAuthorName(
  post: Pick<KemonoMetadataSource, "service" | "user" | "artist" | "creator">,
  pageAuthor = "",
): string {
  const name = cleanKemonoValue(stringValue(post.artist?.name) || stringValue(post.creator?.name) || stringValue(post.artist?.username) || stringValue(post.creator?.username));
  if (name) return name;
  const fallbackName = cleanKemonoValue(pageAuthor);
  if (fallbackName) return fallbackName;
  const service = cleanKemonoValue(stringValue(post.service) || stringValue(post.artist?.service) || stringValue(post.creator?.service));
  const user = cleanKemonoValue(stringValue(post.user) || stringValue(post.artist?.id) || stringValue(post.creator?.id));
  return service && user ? `${service}/${user}` : user;
}

function kemonoTagValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(kemonoTagValues);
  }
  if (typeof value === "string" || typeof value === "number") {
    const raw = String(value);
    if (typeof value === "string" && /^\{.*\}$/.test(raw.trim())) {
      try {
        return parsePostgresArray(raw).flatMap(kemonoTagValues);
      } catch {
        // Keep malformed source values visible instead of dropping metadata.
      }
    }
    return cleanKemonoValue(raw) ? [cleanKemonoValue(raw)] : [];
  }
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return ["name", "tag", "value", "label", "title"]
    .map(key => cleanKemonoValue(stringValue(object[key])))
    .filter(Boolean);
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function cleanKemonoValue(value: unknown): string {
  return cleanSourceTag(value);
}
