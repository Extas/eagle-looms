import { sourceMetadataTag } from "../tags";

export type TwitterEagleMetadata = {
  screenName?: unknown;
  hashtags?: unknown[];
};

type TwitterLegacy = {
  created_at?: string,
  entities?: {
    media?: { expanded_url?: string }[],
    hashtags?: { text?: string }[],
  },
  retweeted_status_result?: {
    result?: TwitterItemResult,
  },
};

type TwitterItemResult = {
  legacy?: TwitterLegacy,
  tweet?: {
    legacy?: TwitterLegacy,
  },
  core?: {
    user_results?: {
      result?: {
        legacy?: {
          screen_name?: string,
        },
        core?: {
          screen_name?: string,
        },
      },
    },
  },
};

export type TwitterEagleItem = {
  itemContent?: {
    tweet_results?: {
      result?: TwitterItemResult,
    },
  },
};

type TwitterSourceCandidate = {
  result?: TwitterItemResult,
  legacy?: TwitterLegacy,
};

export function twitterEagleSourceTags(metadata: TwitterEagleMetadata): string[] {
  const tags = new Set<string>();
  const author = twitterEagleAuthorTag(metadata.screenName);
  if (author) tags.add(author);
  (metadata.hashtags || [])
    .map(cleanTwitterTag)
    .filter(Boolean)
    .forEach(tag => tags.add(tag));
  return [...tags];
}

export function twitterEagleAuthorUrls(screenName: unknown): string[] {
  const user = cleanTwitterScreenName(screenName);
  return user ? [`https://x.com/${user}`] : [];
}

export function twitterItemSourceTags(item: TwitterEagleItem): string[] {
  const sourceCandidates = twitterMediaSourceCandidates(item);
  const user = twitterScreenNameFromCandidates(sourceCandidates)
    || twitterScreenNameFromMediaCandidates(sourceCandidates)
    || twitterScreenName(item);
  const legacyCandidates = sourceCandidates.length
    ? sourceCandidates.map(candidate => candidate.legacy)
    : twitterLegacyCandidates(item);
  const hashtags: string[] = [];
  for (const legacy of legacyCandidates) {
    legacy?.entities?.hashtags?.forEach(hashtag => {
      const tag = hashtag.text?.trim();
      if (tag) hashtags.push(tag);
    });
  }
  return twitterEagleSourceTags({ screenName: user, hashtags });
}

export function twitterItemAuthorUrls(item: TwitterEagleItem): string[] {
  const sourceCandidates = twitterMediaSourceCandidates(item);
  const user = twitterScreenNameFromCandidates(sourceCandidates)
    || twitterScreenNameFromMediaCandidates(sourceCandidates)
    || twitterScreenName(item);
  return twitterEagleAuthorUrls(user);
}

export function twitterItemPublishedAt(item: TwitterEagleItem): string {
  const sourceCandidates = twitterMediaSourceCandidates(item);
  const legacyCandidates = sourceCandidates.length
    ? sourceCandidates.map(candidate => candidate.legacy)
    : twitterLegacyCandidates(item);
  return legacyCandidates
    .map(legacy => legacy?.created_at || "")
    .find(Boolean) || "";
}

export function twitterEagleItemBaseName(directory: string, title: string, sourceUrl: string, sourceTags: string[]): string {
  const fallback = [directory, title].filter(Boolean).join(" - ");
  if (!isTwitterSourceUrl(sourceUrl)) return fallback;
  const author = sourceTags
    .find(tag => tag.trim().toLowerCase().startsWith("author:"))
    ?.slice("author:".length)
    .trim() || twitterScreenNameFromUrl(sourceUrl);
  return [author || directory, title].filter(Boolean).join(" - ");
}

export function twitterSafePageHelperBottom(sourceUrl: string, rightAnchored: boolean, bottom: string): string | undefined {
  if (!isTwitterSourceUrl(sourceUrl) || !rightAnchored) return undefined;
  const bottomPixels = cssPixels(bottom);
  if (bottomPixels === undefined || bottomPixels >= 84) return undefined;
  return "84px";
}

function twitterEagleAuthorTag(screenName: unknown): string {
  return sourceMetadataTag("author", cleanTwitterScreenName(screenName));
}

function twitterScreenName(item: TwitterEagleItem): string {
  const user = item.itemContent?.tweet_results?.result?.core?.user_results?.result;
  return user?.legacy?.screen_name || user?.core?.screen_name || "";
}

function twitterMediaSourceCandidates(item: TwitterEagleItem): TwitterSourceCandidate[] {
  const result = item.itemContent?.tweet_results?.result;
  const retweeted1 = result?.legacy?.retweeted_status_result?.result;
  const retweeted2 = result?.tweet?.legacy?.retweeted_status_result?.result;
  return [
    { result, legacy: result?.legacy },
    { result: retweeted1, legacy: retweeted1?.tweet?.legacy },
    { result: retweeted1, legacy: retweeted1?.legacy },
    { result, legacy: result?.tweet?.legacy },
    { result: retweeted2, legacy: retweeted2?.tweet?.legacy },
    { result: retweeted2, legacy: retweeted2?.legacy },
  ].filter(candidate => Boolean(candidate.legacy?.entities?.media?.length));
}

function twitterScreenNameFromCandidates(candidates: TwitterSourceCandidate[]): string {
  return candidates
    .map(candidate => {
      const user = candidate.result?.core?.user_results?.result;
      return user?.legacy?.screen_name || user?.core?.screen_name || "";
    })
    .find(Boolean) || "";
}

function twitterScreenNameFromMediaCandidates(candidates: TwitterSourceCandidate[]): string {
  for (const candidate of candidates) {
    for (const media of candidate.legacy?.entities?.media || []) {
      const user = twitterScreenNameFromUrl(media.expanded_url);
      if (user) return user;
    }
  }
  return "";
}

function twitterLegacyCandidates(item: TwitterEagleItem): Array<TwitterLegacy | undefined> {
  const result = item.itemContent?.tweet_results?.result;
  return [
    result?.legacy,
    result?.tweet?.legacy,
    result?.legacy?.retweeted_status_result?.result?.legacy,
    result?.legacy?.retweeted_status_result?.result?.tweet?.legacy,
    result?.tweet?.legacy?.retweeted_status_result?.result?.legacy,
    result?.tweet?.legacy?.retweeted_status_result?.result?.tweet?.legacy,
  ];
}

function cleanTwitterScreenName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\w]/g, "")
    .slice(0, 120);
}

function cleanTwitterTag(value: unknown): string {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function isTwitterSourceUrl(value: string): boolean {
  try {
    return isTwitterHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

function twitterScreenNameFromUrl(value: unknown): string {
  try {
    const url = new URL(String(value ?? ""));
    if (!isTwitterHost(url.hostname)) return "";
    return cleanTwitterScreenName(url.pathname.match(/^\/([^/]+)\/status\/\d+(?:\/|$)/i)?.[1]);
  } catch {
    return "";
  }
}

function isTwitterHost(value: string): boolean {
  const host = value.toLowerCase();
  return host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
}

function cssPixels(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : undefined;
}
