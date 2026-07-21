const ANIME_PICTURES_POST_RE = /^\/(?:posts|pictures\/view_post)\/(\d+)(?:\/)?$/;
const TWITTER_MEDIA_RE = /^\/([^/]+)\/status\/(\d+)(?:\/(photo|video)\/(\d+))?\/?$/;

export function canonicalEagleSourceUrl(value: string, baseUrl: string): string {
  const fallback = value.trim();
  if (!fallback) return fallback;

  try {
    const base = new URL(baseUrl, window.location.href);
    const url = new URL(fallback, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      base.hash = "";
      return base.protocol === "http:" || base.protocol === "https:" ? base.href : fallback;
    }
    url.hash = "";

    const animePicturesPostId = url.hostname.replace(/^www\./, "") === "anime-pictures.net"
      ? url.pathname.match(ANIME_PICTURES_POST_RE)?.[1]
      : undefined;
    if (animePicturesPostId) {
      url.protocol = "https:";
      url.host = "anime-pictures.net";
      url.pathname = `/posts/${animePicturesPostId}`;
      url.search = "";
    }

    const twitterMedia = ["x.com", "twitter.com", "mobile.twitter.com"].includes(url.hostname.replace(/^www\./, ""))
      ? url.pathname.match(TWITTER_MEDIA_RE)
      : undefined;
    if (twitterMedia) {
      url.protocol = "https:";
      url.host = "x.com";
      url.pathname = `/${twitterMedia[1]}/status/${twitterMedia[2]}${twitterMedia[3] ? `/${twitterMedia[3]}/${twitterMedia[4]}` : ""}`;
      url.search = "";
    }

    return url.href;
  } catch {
    return fallback;
  }
}
