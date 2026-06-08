# Manual QA

Use this checklist when code changes touch collection, Eagle import, organization rules, or userscript packaging.

## Automated Gates

From the repo root:

```powershell
npm run test:unit
npm run build
npm run verify:eagle
```

Full local gate:

```powershell
npm run verify:all
```

`verify:all` creates small managed smoke items in the current Eagle library, verifies readback, then moves only those smoke items to trash.

## Install Check

Build output:

```text
dist/eagle-looms.user.js
```

Install in Tampermonkey or Violentmonkey and confirm the userscript header includes broad source-page matching and GM request permissions:

```text
@match   *://*/*
@connect *
@grant   GM.xmlHttpRequest / GM_xmlhttpRequest
```

## Primary Target

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
```

Also smoke:

```text
https://anime-pictures.net/posts?page=0
https://anime-pictures.net/stars?page=0
https://anime-pictures.net/posts/919002
https://danbooru.donmai.us/posts
https://danbooru.donmai.us/posts/{id}
https://gelbooru.com/index.php?page=post&s=list
https://gelbooru.com/index.php?page=post&s=view&id={id}
```

## UI Checks

Expected:

```text
Comic Looms control bar appears
Enter/Open shows the full-view grid
existing chapter selection, cherry-pick ranges, loading status, progress canvas, retry failed still work
Import panel primary action says Load missing & import / 加载缺失并导入
loaded-only action says Import loaded only / 只导入已加载
while import is running, the loaded-only action is hidden and the primary action becomes a stop action
import panel status text uses load/import/write wording, not zip/download wording
status reset actions say Mark loaded as missing / 已加载改为未加载 and Retry failed images / 重试失败图片, with tooltips explaining they only reset local load state
Config panel contains Eagle API URL, folder preset, folder path, import limit, source tag limit, skip duplicates
Config panel contains Eagle confirmation mode and auto confirmation threshold
Folder preset dropdown uses the current UI language instead of raw internal preset names
Config panel labels the former download concurrency setting as import loading threads
Eagle import preview appears under the Eagle settings
Eagle import preview has a Test Eagle action that reports connection success or failure for the configured Web API URL
Eagle connection test result stays visible when unrelated non-Eagle settings change
Eagle import preview updates after changing folder preset/path or source tag limit
Eagle import preview shows folder preset, saved folder rule, and example resolved folders as separate rows
Eagle import preview shows batch limit and duplicate policy
Eagle import preview shows confirmation policy, including auto threshold, always, or never
Eagle import preview explains source fields: website stores the source page, url stores the original image, duplicate checks use source/original URL and legacy keys
Eagle import preview explains visible tag priority: copyright:/character:/author: first, then other source tags within the cap
Eagle import preview shows whether the current tab uses global settings, inherits global Eagle settings, or overrides specific Eagle fields
switching between global and site config keeps exactly one Eagle import preview
settings persist after reload
manual folder path edits switch preset to Custom path
matching saved paths infer the correct built-in preset
```

## E2E Import Flow

Expected bulk-import path:

```text
user opens a supported source page
Comic Looms entry appears and opens the full-view grid
user optionally cherry-picks or excludes ranges
Cherry Pick range actions use the current UI language for pick, exclude, and clear buttons
chapter range actions use the current UI language for select all, unselect all, and add new chapters
chapter titles in the range selector render as plain text, even when the source page title contains HTML-like markup
Config preview makes Eagle API URL, folder template, duplicate policy, source tag cap, and config scope visible before import
Load missing & import loads selected gray missing images first, then writes loaded images to Eagle
Import loaded only uses the same Eagle preflight, confirmation, duplicate handling, and stop behavior as Load missing & import, but only writes green loaded images and does not fetch additional images
Eagle preflight checks duplicates and resolves destination folders before writing
preflight stage shows Checking Eagle... on the primary import action
writing stage shows current progress, such as Writing to Eagle 2/6, on the primary import action
auto confirmation mode skips the confirmation when will-write is less than or equal to the configured threshold and there are no preflight failures or import-limit omissions
with the default auto threshold, 1-image and 3-image imports write directly after preflight
with the default auto threshold, 4-image imports show confirmation
always confirmation mode shows confirmation whenever will-write is greater than 0
never confirmation mode skips confirmation unless preflight failures or import-limit omissions need review
preflight failures and over-limit omissions force confirmation even for small batches
confirmation panel defaults to a compact summary: will-write, first destination folders, and skipped-before-writing when present
confirmation panel keeps full selected, planned, limit omissions, item names, folder metadata, tag cap, and duplicate-policy details collapsed by default
Copy plan copies the full collapsed details, not only the compact summary
confirmation toast uses the compact summary instead of the full plan
result toast stays short after writing, such as Imported 2 images to Eagle, and points to the result panel when failures occur
confirmation panel, toast, and final result summary use the current UI language for fixed import-summary labels
confirmation panel uses user-facing wording such as visible tags max, duplicates skipped, and will skip before writing
confirmation panel says writes image items only when new items will be written, and does not show that line for all-skipped duplicate imports
confirmation panel can copy the import plan before writing without confirming the import
long confirmation details scroll inside the body while Copy plan, Cancel, and Write remain visible
confirmation panel focuses the write button, keeps Tab focus inside the panel, restores focus after close, Enter confirms, Escape cancels, and keyboard shortcuts do not trigger page actions while focused inside the panel
Cancel closes the confirmation without writing new Eagle items
clicking either import button again while import/confirmation/write is active stops the pending import and closes the confirmation
Write to Eagle creates image items only, plus the destination folders required by those items
final summary reports planned, imported, skipped, failed, and destination folders
all-skipped duplicate imports show No new items / 没有新项目 instead of Imported / 导入完成
right click / context menu Import current to Eagle shows the same confirmation, running, and No new items / Imported / Failed end states as bulk import
right click / context menu Import current to Eagle reports missing current-image targets in the import result panel
import panel keeps the latest Eagle import result visible until the user clears it or starts a new import
import result panel can copy counts, skipped/failure details, and destination folder links for troubleshooting
long import result details scroll inside the result body while Clear and Copy remain visible
failure details copied from the result panel use the current UI language for Eagle connection, timeout, missing image, canceled, and skipped-reason labels
Eagle connection failures point users to start Eagle, check the Eagle API URL, and use Config > Test Eagle
Eagle connection failures and no-loaded-image failures also appear in the import result panel and can be copied
when no images are loaded/selected, the import result reports that local selection issue before trying Eagle connection
```

Default settings:

```text
Eagle API URL: http://localhost:41595
Folder template: Eagle Looms/{site}/{copyright}
Import limit: 100
Source tag limit: 20
Confirmation mode: auto
Auto confirmation threshold: 3
Skip duplicates: enabled
```

## Import Checks

Before writing, the import plan should show:

```text
resolved destination folders
selected and planned counts
omitted count when over Eagle Import Limit
will-write count
session and Eagle duplicate preflight skips
missing folder metadata counts for used metadata tokens
folder fallback counts when the default Site / Copyright preset has to replace missing copyright
sample resolved copyright/character/author values when present
source tag limit and duplicate policy
```

After import, inspect Eagle:

```text
item names use source identity, without generated 001_ order prefixes
default MyGO folder resolves under Eagle Looms/anime-pictures.net/bang dream when copyright metadata is present
items have website pointing to source post URL
items have original image url when Eagle preserves it
visible tags contain source semantic tags only
items do not force eagle-looms, site:*, gallery:*, chapter:*, ext:*, mime:*, or post:* tags
copyright/character/author tags are normalized and prioritized within the cap
general raw source tags are copied within the cap
normal image item annotation is empty / clean
no _eagle-looms/Data folder or Eagle Looms raw bookmark item is created by the import
legacy raw records, if already present from older versions, are only used for duplicate compatibility
```

Folder-token behavior:

```text
folder tokens resolve from uncapped source metadata even when visible source tag limit is low
multiple copyright values choose the shortest normalized folder value
default Site / Copyright preset falls back to gallery, author, chapter, then Unsorted when copyright is missing
templates using {character} add the same image to multiple character folders when distinct characters exist
longer outfit-style character variants fold into the shorter character name
```

Duplicate behavior:

```text
rerunning import skips exact source/origin/legacy-raw-record/legacy-annotation duplicates
same-session re-import skips before querying Eagle again
same-plan duplicate stable keys are counted as session skips
duplicate-only reruns do not create fresh empty destination folders
multi-file subitems sharing an origin URL are not skipped unless itemKey/stable raw identity also matches
```

Folder naming behavior:

```text
Twitter / X home folders use twitter-home-YYYY-MM-DD instead of parsed post/media counts
Twitter / X user and list timelines include user/list identity plus local date
booru search/gallery fallback folders use semantic source labels and never parsed result counts
anime-pictures detail pages do not use post id as gallery/folder fallback; post id stays item/source identity
ArtStation user folders use artstation-{username}, without project/asset counters
```

anime-pictures behavior:

```text
posts search excludes Last stars/sidebar thumbnails
/stars?page=0 imports the main stars list while excluding recommendation sidebars
/posts/{id} imports only the current detail-page image
detail pages prefer direct images.anime-pictures.net candidates over api download_image endpoints
Cloudflare challenge HTML should trigger candidate retry/failure messaging, not a false successful image import
```

## Known External Limitation

Command-line requests to anime-pictures may return HTTP 403 from this environment. The collector is designed to run inside the real browser page context and use userscript requests for pagination, detail pages, and image/API fetches.
