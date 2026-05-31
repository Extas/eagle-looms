const POST_RE = /\/(?:posts|pictures\/view_post)\/(\d+)/;
const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i;

export interface AnimePicturesPostEntry {
  id: string;
  postUrl: string;
  thumbnailUrl?: string;
  title: string;
  publishedAt?: string;
  width?: number;
  height?: number;
  score?: string;
}

export interface AnimePicturesPageDiagnostics {
  url: string;
  title: string;
  challengeDetected: boolean;
  challengeSignals: string[];
  postAnchorCount: number;
  postIdsPreview: string[];
  imageCandidateCount: number;
}

export interface AnimePicturesImageCandidate {
  url: string;
  score: number;
}

export interface AnimePicturesSourceMetadata {
  tags: string[];
  authorUrls: string[];
  publishedAt?: string;
}

export interface AnimePicturesApiPost {
  id: string;
  postUrl: string;
  thumbnailUrl?: string;
  title: string;
  publishedAt?: string;
  width?: number;
  height?: number;
  ext?: string;
  fileUrl?: string;
  tags: string[];
}

export function parseAnimePicturesPostEntries(document: Document, pageUrl = window.location.href, limit = Number.POSITIVE_INFINITY): AnimePicturesPostEntry[] {
  const posts: AnimePicturesPostEntry[] = [];
  const seen = new Set<string>();
  const anchors = resultPostAnchors(document, pageUrl);

  for (const anchor of anchors) {
    if (posts.length >= limit) break;
    const id = anchor.getAttribute('href')?.match(POST_RE)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const card = nearestCard(anchor);
    const img = anchor.querySelector<HTMLImageElement>('img') || card?.querySelector<HTMLImageElement>('img');
    const text = card?.textContent || anchor.textContent || '';
    const resolution = parseResolution(text);

    posts.push({
      id,
      postUrl: new URL(anchor.getAttribute('href') || `/posts/${id}`, pageUrl).toString(),
      thumbnailUrl: absoluteMaybe(imageSource(img), pageUrl),
      title: img?.alt || anchor.title || `anime-pictures-${id}`,
      width: resolution?.width,
      height: resolution?.height,
      score: parseScore(text),
    });
  }

  const currentPost = currentPostEntry(document, pageUrl);
  if (currentPost && !seen.has(currentPost.id) && posts.length < limit) {
    posts.push(currentPost);
  }

  return posts;
}

export function extractAnimePicturesSourceMetadata(document: Document, pageUrl = window.location.href): AnimePicturesSourceMetadata {
  const tagPanel = findSmallestPanel(document, ["tags"], ["game copyright", "copyright", "character", "author", "artist"]);
  const authorPanel = findSmallestPanel(document, ["about artists"], []);
  const metadata: AnimePicturesSourceMetadata = {
    tags: tagPanel ? dedupeStrings(extractCategorizedTags(tagPanel, pageUrl)) : [],
    authorUrls: authorPanel ? dedupeStrings(extractAuthorUrls(authorPanel, pageUrl)) : [],
  };
  const publishedAt = extractPublishedAt(document);
  if (publishedAt) metadata.publishedAt = publishedAt;
  return metadata;
}

export function animePicturesApiPostsUrl(pageUrl: string): string {
  const source = new URL(pageUrl, window.location.href);
  const apiUrl = new URL("https://api.anime-pictures.net/api/v3/posts");
  apiUrl.searchParams.set("page", source.searchParams.get("page") || "0");
  apiUrl.searchParams.set("lang", source.searchParams.get("lang") || "en");
  apiUrl.searchParams.set("ldate", source.searchParams.get("ldate") || "0");
  const searchTag = source.searchParams.get("search_tag");
  const orderBy = source.searchParams.get("order_by");
  if (searchTag) apiUrl.searchParams.set("search_tag", searchTag);
  if (orderBy) apiUrl.searchParams.set("order_by", orderBy);
  return apiUrl.toString();
}

export function animePicturesApiDetailUrl(postId: string): string {
  return `https://api.anime-pictures.net/api/v3/posts/${encodeURIComponent(postId)}`;
}

export function parseAnimePicturesApiPosts(data: unknown, pageUrl: string): AnimePicturesApiPost[] {
  const posts: unknown[] = Array.isArray((data as any)?.posts) ? (data as any).posts : [];
  return posts.map(post => apiPostToEntry(post, pageUrl)).filter((post): post is AnimePicturesApiPost => Boolean(post));
}

export function parseAnimePicturesApiDetail(data: unknown, pageUrl: string): AnimePicturesApiPost | undefined {
  return apiPostToEntry(data, pageUrl);
}

function resultPostAnchors(document: Document, pageUrl: string): HTMLAnchorElement[] {
  const rawAnchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/posts/"], a[href*="/pictures/view_post/"]')]
    .filter(anchor => !isSidebarPostAnchor(anchor));
  const imageAnchors = rawAnchors.filter((anchor) => Boolean(anchor.querySelector('img')));
  const anchors = imageAnchors.length ? imageAnchors : rawAnchors;
  const activeByTag = activeByTagId(anchors, pageUrl);
  if (!activeByTag) return anchors;
  const scoped = anchors.filter((anchor) => {
    try {
      return new URL(anchor.getAttribute('href') || '', pageUrl).searchParams.get('by_tag') === activeByTag;
    } catch {
      return false;
    }
  });
  return scoped.length ? scoped : anchors;
}

function isSidebarPostAnchor(anchor: HTMLAnchorElement): boolean {
  const sidebar = anchor.closest('#sidebar, aside, .sidebar, .sidebar_block');
  if (sidebar) return true;
  const lastStars = anchor.closest('.last-stars');
  return Boolean(lastStars?.closest('#sidebar, aside, .sidebar, .sidebar_block'));
}

function currentPostEntry(document: Document, pageUrl: string): AnimePicturesPostEntry | undefined {
  const id = new URL(pageUrl, window.location.href).pathname.match(POST_RE)?.[1];
  if (!id) return undefined;
  const html = document.documentElement.outerHTML || "";
  const candidates = collectAnimePicturesImageCandidates(document, html, pageUrl);
  const img = document.querySelector<HTMLImageElement>('.post_content img, .post img, img[src*="/pictures/"], img[src*="/previews/"], img[src*="/preview/"]');
  const thumbnail = candidates.find(candidate => isPreviewCandidate(candidate.url))?.url
    || absoluteMaybe(imageSource(img), pageUrl)
    || candidates[0]?.url;
  return {
    id,
    postUrl: new URL(`/posts/${id}${new URL(pageUrl, window.location.href).search || ""}`, pageUrl).toString(),
    thumbnailUrl: thumbnail,
    title: titleFromDocument(document, id),
    publishedAt: extractPublishedAt(document),
    ...(parseResolution(document.body?.textContent || "") || {}),
  };
}

function extractCategorizedTags(root: Element, baseUrl: string): string[] {
  const tags: string[] = [];
  let currentCategory = "";
  const updateCategory = (value: string) => {
    const next = classifyAnimePicturesCategory(value);
    if (next !== undefined) currentCategory = next;
  };
  const walk = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      updateCategory(node.textContent || "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    updateCategory(directText(element));
    if (element.tagName.toLowerCase() === "a" && currentCategory) {
      const name = cleanSourceTagName(element.textContent || (element as HTMLAnchorElement).title || tagNameFromUrl((element as HTMLAnchorElement).href, baseUrl));
      if (name) tags.push(currentCategory === "raw" ? name : `${currentCategory}:${name}`);
      return;
    }
    element.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return tags;
}

function extractAuthorUrls(root: Element, baseUrl: string): string[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .map(anchor => absoluteMaybe(anchor.getAttribute("href") || "", baseUrl) || "")
    .filter(url => /^https?:\/\//i.test(url));
}

function findSmallestPanel(document: Document, requiredTerms: string[], optionalTerms: string[]): Element | undefined {
  const elements = [...document.querySelectorAll("aside, section, article, table, tbody, tr, td, div, form, body")];
  const candidates = elements.filter((element) => {
    const text = compactText(element.textContent || "").toLowerCase();
    if (requiredTerms.some(term => !text.includes(term))) return false;
    return optionalTerms.length === 0 || optionalTerms.some(term => text.includes(term));
  });
  return candidates.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
}

function classifyAnimePicturesCategory(value: string): "copyright" | "character" | "author" | "raw" | "" | undefined {
  const normalized = compactText(value).toLowerCase();
  switch (normalized) {
    case "game copyright":
    case "copyright":
      return "copyright";
    case "character":
      return "character";
    case "author":
    case "artist":
      return "author";
    case "reference":
    case "object":
    case "general":
    case "meta":
    case "style":
    case "tag":
      return "raw";
    case "tags":
      return "";
    default:
      return undefined;
  }
}

function directText(element: Element): string {
  return [...element.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || "")
    .join(" ");
}

function compactText(value: string): string {
  return value.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanSourceTagName(value: string): string {
  return compactText(value)
    .replace(/\s+(?:[+-]?\d+(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
    .trim();
}

function tagNameFromUrl(value: string, baseUrl: string): string {
  try {
    const url = new URL(value, baseUrl);
    return url.searchParams.get("search_tag") || url.searchParams.get("tags") || "";
  } catch {
    return "";
  }
}

function apiPostToEntry(post: unknown, pageUrl: string): AnimePicturesApiPost | undefined {
  const raw = post as Record<string, any> | undefined;
  if (!raw) return undefined;
  const id = String(raw.id || "");
  if (!id) return undefined;
  const width = Number(raw.width);
  const height = Number(raw.height);
  const ext = typeof raw.ext === "string" ? raw.ext.replace(/^\./, "").toLowerCase() : "";
  const fileUrl = typeof raw.file_url === "string" && raw.file_url ? `https://api.anime-pictures.net/pictures/get_image/${raw.file_url}` : undefined;
  const md5 = typeof raw.md5 === "string" ? raw.md5 : "";
  const thumbnailUrl = md5 ? `https://opreviews.anime-pictures.net/${md5.slice(0, 3)}/${md5}_cp.avif` : undefined;
  return {
    id,
    postUrl: new URL(`/posts/${id}`, pageUrl).toString(),
    thumbnailUrl,
    title: `anime-pictures-${id}.${ext || "jpg"}`,
    publishedAt: apiPublishedAt(raw),
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined,
    ext,
    fileUrl,
    tags: apiTags(raw.tags),
  };
}

function apiTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((entry) => {
    const raw = (entry as any)?.tag || entry;
    const value = typeof raw === "string" ? raw : raw?.tag || raw?.name || raw?.tag_en || "";
    const category = raw?.type || raw?.category || raw?.tag_type || (entry as any)?.type || (entry as any)?.tag_type || "";
    const normalized = normalizeApiTagCategory(String(category));
    const name = cleanSourceTagName(String(value || ""));
    if (!name) return "";
    return normalized ? `${normalized}:${name}` : name;
  }).filter(Boolean))];
}

function normalizeApiTagCategory(value: string): "copyright" | "character" | "author" | "" {
  const category = value.toLowerCase().replace(/[_-]+/g, " ").trim();
  switch (category) {
    case "copyright":
    case "game copyright":
    case "other copyright":
      return "copyright";
    case "character":
      return "character";
    case "author":
    case "artist":
      return "author";
    default:
      return "";
  }
}

function extractPublishedAt(document: Document): string | undefined {
  const selectors = [
    "time[datetime]",
    "[itemprop='datePublished'][datetime]",
    "[data-created-at]",
    "[data-published-at]",
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const value = element?.getAttribute("datetime")
      || element?.getAttribute("data-created-at")
      || element?.getAttribute("data-published-at")
      || compactText(element?.textContent || "");
    if (value) return value;
  }
  const meta = document.querySelector<HTMLMetaElement>([
    "meta[property='article:published_time']",
    "meta[name='date']",
    "meta[name='pubdate']",
    "meta[itemprop='datePublished']",
  ].join(","));
  const metaValue = meta?.getAttribute("content") || "";
  if (metaValue) return metaValue;
  const text = compactText(document.body?.textContent || "");
  return text.match(/\b(?:posted|published|uploaded|date)\s*:?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i)?.[1];
}

function apiPublishedAt(raw: Record<string, any>): string | undefined {
  for (const key of ["published_at", "posted_at", "post_date", "created_at", "createdAt", "created", "pubtime", "date", "datetime", "time"]) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(value);
  }
  return undefined;
}

function titleFromDocument(document: Document, id: string): string {
  const title = compactText(document.querySelector("h1")?.textContent || document.title || "");
  return title || `anime-pictures-${id}`;
}

function activeByTagId(anchors: HTMLAnchorElement[], pageUrl: string): string {
  try {
    const fromUrl = new URL(pageUrl, window.location.href).searchParams.get('by_tag');
    if (fromUrl) return fromUrl;
  } catch {
    // ignore and infer from card links below
  }

  const counts = new Map<string, number>();
  for (const anchor of anchors) {
    try {
      const byTag = new URL(anchor.getAttribute('href') || '', pageUrl).searchParams.get('by_tag');
      if (byTag) counts.set(byTag, (counts.get(byTag) || 0) + 1);
    } catch {
      // skip malformed links
    }
  }
  const [tag, count] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
  return count >= 2 ? tag : "";
}

export function diagnoseAnimePicturesDocument(document: Document, pageUrl = window.location.href): AnimePicturesPageDiagnostics {
  const posts = parseAnimePicturesPostEntries(document, pageUrl);
  const html = document.documentElement.outerHTML || '';
  const bodyText = document.body?.textContent || '';
  const challengeSignals = detectChallengeSignals(document, html, bodyText);

  return {
    url: pageUrl,
    title: document.title || '',
    challengeDetected: challengeSignals.length > 0,
    challengeSignals,
    postAnchorCount: posts.length,
    postIdsPreview: posts.slice(0, 10).map((post) => post.id),
    imageCandidateCount: collectAnimePicturesImageCandidates(document, html, pageUrl).length,
  };
}

export function collectAnimePicturesImageCandidates(document: Document, html: string, baseUrl: string): AnimePicturesImageCandidate[] {
  const candidates: AnimePicturesImageCandidate[] = [];
  const add = (value: string | null | undefined, hint = '', scoreOffset = 0) => {
    if (!value) return;
    const url = absoluteMaybe(value, baseUrl);
    if (!url || !looksLikeImageUrl(url)) return;
    let score = scoreOffset;
    const parsed = new URL(url);
    const lower = `${url} ${hint}`.toLowerCase();
    if (parsed.hostname === 'images.anime-pictures.net') score += 140;
    if (parsed.hostname === 'api.anime-pictures.net' && parsed.pathname.includes('/download_image/')) score -= 40;
    if (lower.includes('/pictures/')) score += 80;
    if (lower.includes('download')) score += 20;
    if (lower.includes('original') || lower.includes('full')) score += 40;
    if (lower.includes('preview') || lower.includes('thumb') || lower.includes('avatar')) score -= 50;
    candidates.push({ url, score });
  };

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    add(anchor.getAttribute('href'), anchor.textContent || anchor.title || '');
  });
  document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    add(imageSource(img), img.alt || img.title || '');
  });

  const regex = /https?:\\?\/\\?\/[^"'<>\s]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'<>\s]*)?/gi;
  for (const match of html.matchAll(regex)) {
    add(match[0].replaceAll('\\/', '/'));
  }

  const postId = baseUrl.match(POST_RE)?.[1];
  if (postId) {
    add(`https://api.anime-pictures.net/pictures/download_image/${postId}-`, 'download original fallback', 20);
  }

  return dedupeCandidates(candidates).sort((a, b) => b.score - a.score);
}

export function selectAnimePicturesImageCandidate(candidates: AnimePicturesImageCandidate[], triedUrls: Set<string>): AnimePicturesImageCandidate | undefined {
  const originalCandidates = candidates.filter(candidate => !isPreviewCandidate(candidate.url));
  const pool = originalCandidates.length ? originalCandidates : candidates;
  return pool.find(candidate => !triedUrls.has(candidate.url)) || pool[0];
}

export function isAnimePicturesChallengeHtml(html: string, url: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return diagnoseAnimePicturesDocument(doc, url).challengeDetected;
}

function detectChallengeSignals(document: Document, html: string, bodyText: string): string[] {
  const signals: string[] = [];
  const lowerTitle = (document.title || '').toLowerCase();
  const lowerText = bodyText.toLowerCase();
  const lowerHtml = html.toLowerCase();
  const add = (signal: string) => {
    if (!signals.includes(signal)) signals.push(signal);
  };

  if (lowerTitle.includes('just a moment') || lowerTitle.includes('please wait') || document.title.includes('请稍候')) {
    add('challenge-title');
  }
  if (lowerText.includes('cloudflare') || lowerText.includes('checking your browser') || lowerText.includes('verify you are human')) {
    add('challenge-text');
  }
  if (lowerText.includes('security verification') || lowerText.includes('安全验证') || bodyText.includes('请稍候')) {
    add('security-verification-text');
  }
  if (lowerHtml.includes('challenges.cloudflare.com') || lowerHtml.includes('cf-turnstile') || lowerHtml.includes('cf-chl')) {
    add('cloudflare-markup');
  }
  if (document.querySelector('[id^="cf-"], .cf-browser-verification, input[name="cf-turnstile-response"]')) {
    add('cloudflare-elements');
  }

  return signals;
}

function nearestCard(anchor: HTMLAnchorElement): Element | null {
  return anchor.closest('.post_content, .post, .posts, article, li, td, div');
}

function imageSource(img?: HTMLImageElement | null): string | undefined {
  if (!img) return undefined;
  return img.dataset.src
    || img.dataset.original
    || img.getAttribute('data-lazy-src')
    || img.getAttribute('src')
    || img.currentSrc
    || img.src
    || undefined;
}

function parseResolution(text: string): { width: number; height: number } | undefined {
  const match = text.match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/i);
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseScore(text: string): string | undefined {
  const match = text.match(/(?:score|rating)\s*:?\s*([+-]?\d+(?:\.\d+)?)/i);
  return match?.[1];
}

function absoluteMaybe(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function looksLikeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return IMAGE_EXT_RE.test(parsed.pathname) || parsed.pathname.includes('/pictures/');
  } catch {
    return false;
  }
}

function isPreviewCandidate(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('preview') || lower.includes('thumb') || lower.includes('avatar');
}

function dedupeCandidates(candidates: AnimePicturesImageCandidate[]): AnimePicturesImageCandidate[] {
  const seen = new Map<string, number>();
  for (const candidate of candidates) {
    const prev = seen.get(candidate.url);
    if (prev === undefined || candidate.score > prev) seen.set(candidate.url, candidate.score);
  }
  return [...seen].map(([url, score]) => ({ url, score }));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
