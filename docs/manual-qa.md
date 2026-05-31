# Manual QA

Status: active QA checklist
Last updated: 2026-05-31

## Automated Gates

Run from `eagle-looms/`:

```powershell
npm run verify:local
```

This verifies:

```text
unit parser, Eagle option normalization, duplicate query, folder path, and transport invariants
Eagle item/add response shape extraction
Eagle import readiness follows upstream DONE-and-data filtering
TypeScript build
userscript bundle generation
current Eagle Web API read probe
```

Full local verification:

```powershell
npm run verify:all
```

Before each smoke run, scripts only pre-clean stale items that match the script-managed smoke tag, local smoke URL prefix, and annotation schema.
This additionally creates one bookmark smoke item in the current Eagle library, verifies write/readback, and moves that managed smoke item to trash.
It also creates one 1x1 PNG image smoke item through a `data:image/png;base64,...` payload, verifies tags/annotation readback, and moves that managed smoke item to trash.

## Install Userscript

Build:

```powershell
npm run build
```

Install:

```text
dist/eagle-looms.user.js
```

Use Tampermonkey or Violentmonkey. Confirm the script header includes:

```text
@name    Eagle Looms
@match   *://*/*
@connect *
@grant   GM.xmlHttpRequest / GM_xmlhttpRequest
```

## Target Page

Open:

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
```

Expected:

```text
Comic Looms style control bar appears.
Enter/Open shows the full-view grid.
The Config panel contains Eagle API URL, Eagle Folder Path, Eagle Import Limit, Eagle Source Tag Limit, and Skip Eagle Duplicates.
Default Eagle API URL is `http://localhost:41595`.
If a user pastes `http://localhost:41595/api/v2/`, the Config panel stores it as `http://localhost:41595`.
Default Eagle folder template is `Eagle Looms/{site}/{gallery}`.
Whitespace around folder path segments is trimmed, illegal Eagle folder characters are cleaned, and an empty path falls back to the default template.
Default Eagle Import Limit is `100`.
Out-of-range import limits are clamped to `1..1000`.
Default Eagle Source Tag Limit is `20`.
Out-of-range source tag limits are clamped to `0..100`; `0` keeps only required Eagle Looms tags.
Global and site-level Eagle settings are normalized before import.
The Download panel button says Import to Eagle / 导入 Eagle.
Clicking Import to Eagle reuses chapter selection, cherry-pick ranges, progress canvas, retry failed, and loaded item states.
The script fetches original image binaries in the browser session before Eagle write, and imports only items whose fetch state is DONE with data.
On anime-pictures detail pages, direct `images.anime-pictures.net` candidates are preferred over `api.anime-pictures.net/pictures/download_image/...` API endpoints.
If one original-image candidate returns a Cloudflare `Just a moment...` HTML page, retry switches to another original-image candidate instead of retrying the same URL three times.
```

If collection fails, inspect the browser console and visible error message:

```text
challenge page: complete anime-pictures browser verification, then retry.
no thumbnails: target markup likely changed or the script is on the wrong page.
original URL failure: detail-page original image extraction needs inspection.
```

## Import Verification

Default import destination template:

```text
Eagle Looms/{site}/{gallery}
```

The Settings folder path field uses slash-separated Eagle folders:

```text
Root/Child/Leaf
```

Supported path tokens:

```text
{site}
{gallery}
{chapter}
```

For the MyGO target page, the default folder resolves under:

```text
Eagle Looms/anime-pictures.net/anime-pictures_bang dream! it's mygo!!!!!_100
```

Inspect in Eagle:

```text
item names use source identity such as `anime-pictures-{post-id}.{ext}` without generated `001_` order prefixes
items have required `eagle-looms`, `site:*`, `gallery:*`, `chapter:*`, `ext:*`, and `mime:*` style tags
source-site tags are copied up to Eagle Source Tag Limit; `copyright`/`character`/`author` are normalized to `copyright:`/`character:`/`author:`, and other tags are imported as raw tags
items have website pointing to anime-pictures post URL and url pointing to the original image URL when Eagle preserves it
normal image items have an empty or minimal annotation; multi-file subitems or items with multiple author URLs may keep one compact JSON line
rerunning import skips known source/origin/annotation duplicates by default, using separate exact Eagle queries
anime-pictures `Last stars` sidebar thumbnails are not imported even when they link to `/posts/...`
rerunning import in the same userscript page session skips assets already written by this session before querying Eagle again
Import summary appears in the message box: planned, imported, skipped, failed, destination folders, and bounded first failures if any
Clicking Import to Eagle with no loaded/selected image should show a clear error instead of an empty successful import
```

## Known External Limitation

Command-line requests to the anime-pictures target page currently return HTTP 403 from this environment. The collector is therefore designed to run as a userscript in the real browser page context and parse the live DOM, then use `GM_xmlhttpRequest` for pagination/detail/image/API requests.

Current CLI check on 2026-05-31:

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
HTTP 403 Forbidden
```
