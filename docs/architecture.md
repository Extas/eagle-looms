# Architecture

Eagle Looms is an upstream-first Comic Looms fork with one intentional product change: the final save target writes already-fetched images into the current Eagle library through Eagle Web API.

## Boundaries

```text
Source site     DOM, cookies, original media URLs, visible metadata
Comic Looms     matchers, chapters, page fetching, image queue, full-view UI
Eagle Looms     Eagle save target, import planning, folders, tags, duplicate skips
Eagle           asset storage, preview, library state, search, folders, tags
```

Do not build a separate collector, queue, or panel for Eagle. New site support should first fit the Comic Looms matcher contract:

```text
fetchChapters()
fetchPagesSource(chapter)
parseImgNodes(pageSource, chapterID)
fetchOriginMeta(node, retry, chapterID)
headers(node)
galleryMeta(chapter)
```

## Source Layout

```text
src/main.ts
  userscript bootstrap, route refresh, EagleDownloader wiring

src/platform/
  Comic Looms compatible matchers and source metadata extraction

src/download/
  upstream downloader, chapter selection, cherry-pick, and queue flow

src/eagle/
  Eagle Web API client, import target, folder/tags/options/duplicates helpers

src/ui/
  upstream Comic Looms UI; Eagle settings are normal ConfigPanel entries
```

The main branch point is after `IMGFetcher` has reached the upstream `DONE && data` contract. `EagleDownloader` subclasses the existing downloader and replaces zip packaging with Eagle `item/add`.

## Complexity Policy

Keep the product shaped like a save target, not a new framework.

```text
reuse Comic Looms contracts before adding Eagle-specific flow
keep source-site parsing in matchers and Eagle writes in src/eagle/
prefer data snapshots plus pure derivation helpers over a runtime rule engine
derive folder names from stable semantic labels rather than parsed counts or run-state text
add abstractions only when two or more real call sites share the same behavior
delete planning-era docs/code once the stable policy exists elsewhere
```

For common utilities and repeated patterns, prefer mature dependencies or platform APIs over local reinvention:

```text
binary/data-url handling: use existing project transport helpers and browser APIs
image transforms: use existing pica / ffmpeg dependencies when needed
archive/download behavior inherited from Comic Looms: keep zip.js / file-saver patterns
HTML/URL parsing: use DOMParser, URL, URLSearchParams, and structured DOM APIs
new cross-cutting helpers: first look for a focused maintained package before adding custom code
```

Small local helpers are acceptable only when they are project-specific glue, have narrow behavior, and are covered by tests.

## Import Flow

```text
probe Eagle app/library
collect selected fetched IMGFetcher assets
derive item name, visible source tags, folder paths, website, original url
preflight same-session and Eagle duplicate skips
ensure only folders needed by writable assets
POST /api/v2/item/add with base64 data URL
show planned/imported/skipped/failed summary
```

The import target creates only normal image items and the folders needed for those items. It does not create Eagle Looms bookmark/raw-record assets such as `_eagle-looms/Data`; legacy raw-record annotations are decoded only for backward-compatible duplicate detection.

Default import mode is base64 data URL. The browser page session fetches image bytes first, then Eagle stores those bytes. This avoids source-site 403 failures caused by asking the Eagle process to download protected URLs directly.

## Eagle API

Default local base:

```text
http://localhost:41595/api/v2/
```

Used endpoints:

```text
GET  /api/v2/app/info
GET  /api/v2/library/info
POST /api/v2/folder/get
POST /api/v2/folder/create
POST /api/v2/item/get
POST /api/v2/item/query
POST /api/v2/item/add
```

Userscript requests should prefer `GM_xmlhttpRequest` when page-context `fetch` is blocked by CORS.

## Upstream Workflow

`upstream` is `https://github.com/MapoMagpie/comic-looms.git` and is read-only. Current anchor:

```text
upstream/master  8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f
```

Do not merge upstream wholesale. Port deliberately:

```powershell
git fetch upstream --tags
git log --oneline 8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f..upstream/master
git diff 8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f..upstream/master -- src package.json vite.config.ts tsconfig.json
```

Review copied Comic Looms areas (`src/platform/`, `src/download/`, `src/ui/`, `src/utils/`, queue/fetcher files, config, main), port only compatible changes, keep Eagle-specific logic in `src/eagle/` or small adapter points, then run `npm run verify:local`.

## Site Coverage

Primary verification target:

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
```

anime-pictures also supports:

```text
/posts?page=0
/stars?page=0
/posts/{id}
/pictures/view_posts...
/pictures/view_post/{id}
```

List pages paginate by page parameter until the import limit. Single-image detail pages import only the current image. Sidebar recommendation blocks such as `Last stars` are excluded from posts search imports.

Gallery titles stay semantic: search pages use `anime-pictures-search-{tag}`, stars pages use `anime-pictures-stars`, and detail pages use `anime-pictures-posts`. The post id remains item/source identity only, never a gallery or folder fallback.

Booru-like matchers normalize categorized metadata into the same Eagle source-tag policy. See `docs/eagle-organization.md` for folder/tag/duplicate rules.
