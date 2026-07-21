const ANIME_PICTURES_POST_RE = /^\/(?:posts|pictures\/view_post)\/(\d+)(?:\/)?$/;
const TWITTER_MEDIA_RE = /^\/([^/]+)\/status\/(\d+)(?:\/(photo|video)\/(\d+))?\/?$/;
const PATH_POST_RE = /^\/posts\/(\d+)\/?$/;
const MOEBOORU_POST_RE = /^\/post\/show\/(\d+)\/?$/;
const PIXIV_ARTWORK_RE = /^\/(?:[a-z]{2}\/)?artworks\/(\d+)\/?$/i;
const EHENTAI_IMAGE_RE = /^\/s\/[^/]+\/\d+-\d+\/?$/;

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
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    const animePicturesPostId = host === "anime-pictures.net"
      ? url.pathname.match(ANIME_PICTURES_POST_RE)?.[1]
      : undefined;
    if (animePicturesPostId) {
      url.protocol = "https:";
      url.host = "anime-pictures.net";
      url.pathname = `/posts/${animePicturesPostId}`;
      url.search = "";
    }

    const twitterMedia = ["x.com", "twitter.com", "mobile.twitter.com"].includes(host)
      ? url.pathname.match(TWITTER_MEDIA_RE)
      : undefined;
    if (twitterMedia) {
      url.protocol = "https:";
      url.host = "x.com";
      url.pathname = `/${twitterMedia[1]}/status/${twitterMedia[2]}${twitterMedia[3] ? `/${twitterMedia[3]}/${twitterMedia[4]}` : ""}`;
      url.search = "";
    }

    const pathPostId = ["danbooru.donmai.us", "e621.net"].includes(host)
      ? url.pathname.match(PATH_POST_RE)?.[1]
      : undefined;
    if (pathPostId) {
      url.protocol = "https:";
      url.host = host;
      url.pathname = `/posts/${pathPostId}`;
      url.search = "";
    }

    const moebooruPostId = ["yande.re", "konachan.com"].includes(host)
      ? url.pathname.match(MOEBOORU_POST_RE)?.[1]
      : undefined;
    if (moebooruPostId) {
      url.protocol = "https:";
      url.host = host;
      url.pathname = `/post/show/${moebooruPostId}`;
      url.search = "";
    }

    const queryPostId = url.searchParams.get("id");
    if (["gelbooru.com", "rule34.xxx"].includes(host)
      && url.searchParams.get("page") === "post"
      && url.searchParams.get("s") === "view"
      && queryPostId && /^\d+$/.test(queryPostId)) {
      url.protocol = "https:";
      url.host = host;
      url.pathname = "/index.php";
      url.search = new URLSearchParams({ page: "post", s: "view", id: queryPostId }).toString();
    }

    if (host === "rule34.us"
      && url.searchParams.get("r") === "posts/view"
      && queryPostId && /^\d+$/.test(queryPostId)) {
      url.protocol = "https:";
      url.host = host;
      url.pathname = "/index.php";
      url.search = `?r=posts/view&id=${queryPostId}`;
    }

    const pixivArtworkId = host === "pixiv.net" ? url.pathname.match(PIXIV_ARTWORK_RE)?.[1] : undefined;
    if (pixivArtworkId) {
      url.protocol = "https:";
      url.host = "www.pixiv.net";
      url.pathname = `/artworks/${pixivArtworkId}`;
      url.search = "";
    }

    if (["exhentai.org", "e-hentai.org"].includes(host) && EHENTAI_IMAGE_RE.test(url.pathname)) {
      url.protocol = "https:";
      url.host = host;
      url.search = "";
    }

    return url.href;
  } catch {
    return fallback;
  }
}
