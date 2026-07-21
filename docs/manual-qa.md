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

`verify:all` creates small managed, unfiled smoke items in the current Eagle library, verifies readback, then moves only those smoke items to trash. It does not create persistent smoke-test folders.
The import smoke also verifies the observed V2 identity contract: an image written with an origin URL and a source website remains discoverable by the source-page URL used by duplicate preflight.

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
https://rule34.us/index.php?r=posts/index
https://rule34.us/index.php?r=posts/view&id={id}
https://pawchive.pw/fanbox/user/{id}
https://pawchive.pw/fanbox/user/{id}/post/{post-id}
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
Eagle import limit, confirmation threshold, and source tag limit accept direct numeric entry as well as +/- adjustment
Eagle API URL and folder path inputs expand across the available settings row instead of truncating to the upstream short text-input width
Eagle API URL accepts localhost or IP plus a custom port without requiring an explicit http:// prefix
invalid or non-HTTP Eagle API addresses show native validation feedback and do not overwrite the saved address
Config panel contains Eagle confirmation mode and auto confirmation threshold
Auto confirmation threshold is visible only while confirmation mode is Auto
Folder preset dropdown uses the current UI language instead of raw internal preset names
Config panel labels the former download concurrency setting as import loading threads
Eagle import preview appears under the Eagle settings
Eagle import preview has a Test Eagle action that reports connection success or failure for the configured Web API URL
successful connection tests identify the currently open Eagle library by name
connection preview and test results mask API token values
Eagle connection test result stays visible when unrelated non-Eagle settings change
Eagle import preview updates after changing folder preset/path or source tag limit
Eagle import preview shows folder preset, saved folder rule, and example resolved folders as separate rows
Eagle import preview shows batch limit and duplicate policy
Eagle import preview shows confirmation policy, including auto threshold, always, or never
Eagle import preview explains the observed V2 result: source page is the visible Eagle link; the original URL is submitted but may not remain observable; collected author URLs are retained; duplicate checks use source URL plus stable media identity
Eagle import preview explains visible tag priority: copyright:/character:/author: first, then other source tags within the cap
Eagle import preview explains that source:published:* is retained independently of the source tag cap
Eagle import preview shows whether the current tab uses global settings, inherits global Eagle settings, or overrides specific Eagle fields
switching between global and site config keeps exactly one Eagle import preview
site-specific Eagle overrides can be cleared back to global values without resetting unrelated site settings
clearing site-specific Eagle overrides requires confirmation and Cancel leaves stored settings unchanged
settings persist after reload
damaged or non-object stored configuration recovers to valid defaults instead of preventing the userscript from opening
manual folder path edits switch preset to Custom path
matching saved paths infer the correct built-in preset
unknown custom folder tokens show a warning and block import before Eagle connection or folder creation
unmatched or nested braces in custom folder tokens show a warning before import
malformed folder-token braces stop bulk and current-image imports before Eagle connection or folder creation
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
every import preflight summary identifies the currently open target Eagle library, including auto-confirmed small imports
if Eagle switches libraries during duplicate checking or confirmation, the importer stops before creating folders or items and asks the user to retry
every actual item write rechecks the target Eagle library; switching libraries mid-batch stops before the next folder or item write
multi-level folder creation and the final item submission each recheck the same target library; switching during folder resolution stops before another folder or item write
Windows library-path case, slash direction, and trailing separators do not produce a false library-switch warning
Load missing & import loads selected gray missing images first, then writes loaded images to Eagle
Import loaded only uses the same Eagle preflight, confirmation, duplicate handling, and stop behavior as Load missing & import, but only writes green loaded images and does not fetch additional images
Eagle preflight checks duplicates and resolves destination folders before writing
Eagle preflight reuses identical source/query lookups within the current batch while evaluating each sibling media identity independently
preflight stage shows Checking Eagle 0/N through N/N on the primary import action while duplicate queries run
Eagle Import Limit caps new writes after duplicate preflight; duplicate/session-skipped items do not consume the write quota
the config preview distinguishes that write quota from paged collection: a paged source may stop after the same number of candidates and therefore produce fewer new writes
the same import limit applies when Import current to Eagle expands one logical item into multiple files
writing stage shows current progress, such as Writing to Eagle 2/6, on the primary import action
auto confirmation mode skips the confirmation when will-write is less than or equal to the configured threshold and there are no preflight failures or import-limit omissions
with the default auto threshold, 1-image and 3-image imports write directly after preflight
with the default auto threshold, 4-image imports show confirmation
always confirmation mode shows confirmation whenever will-write is greater than 0
never confirmation mode skips confirmation unless preflight failures or import-limit omissions need review
preflight failures and over-limit omissions force confirmation even for small batches
confirmation panel defaults to a compact summary: will-write, first destination folders, and skipped-before-writing when present
compact plans include the configured import limit and omitted count whenever selected writable items exceed the limit
confirmation panel keeps full selected, planned, limit omissions, item names, folder metadata, tag cap, and duplicate-policy details collapsed by default
expanded confirmation details show a bounded sample of the actual visible tags from writable items only
Copy plan copies the full collapsed details, not only the compact summary
confirmation toast uses the compact summary instead of the full plan
result toast stays short after writing, such as Imported 2 images to Eagle, and points to the result panel when failures occur
confirmation panel, toast, and final result summary use the current UI language for fixed import-summary labels
confirmation panel uses user-facing wording such as additional source tags max, duplicates skipped, and will skip before writing
confirmation panel says writes image items only when new items will be written, and does not show that line for all-skipped duplicate imports
all-skipped plans do not show a destination folder or naming policy because no folder or item will be written
compact plans show preflight failure counts, including when every selected item failed before writing
confirmation panel can copy the import plan before writing without confirming the import
long confirmation details scroll inside the body while Copy plan, Cancel, and Write remain visible
confirmation panel focuses the write button, keeps Tab focus inside the panel, restores focus after close, Enter confirms, Escape cancels, and keyboard shortcuts do not trigger page actions while focused inside the panel
Cancel closes the confirmation without writing new Eagle items
clicking either import button again while import/confirmation/write is active stops the pending import and closes the confirmation
stopping during duplicate preflight prevents queued Eagle queries from reaching confirmation or write stages
starting another import after stopping does not revive requests or progress updates from the previous import session
stopping while destination folders resolve prevents the pending item/add call and is not reported as an import failure
canceling during an Eagle folder-tree read prevents subsequent folder creation; cancellation between nested creates stops before the next segment
stopping after some items were written keeps a persistent result marked as partial, with actual imported/skipped/failed counts and links
stopping during single-image fetch, Eagle preflight, or confirmation keeps a persistent canceled result even when no item was handled yet
Write to Eagle creates image items only, plus the destination folders required by those items
final summary reports planned, imported, skipped, failed, and only destination folders that were successfully resolved before any failure or cancellation
final summary and toast retain selected and over-limit omission counts instead of making a limited batch look complete
final result panel and copied diagnostics retain the target Eagle library name after the transient plan notification closes
API errors redact `?token=...` consistently in import results, connection tests, NovelAI status, and console diagnostics
ordinary Global/site configuration-scope changes do not emit console noise
imports that actually create exactly one item include its direct Eagle item link, even when other planned items were duplicates or failed
all-skipped duplicate imports show No new items / 没有新项目 instead of Imported / 导入完成
right click / context menu Import current to Eagle shows the same confirmation, running, and No new items / Imported / Failed end states as bulk import
right click / context menu Import current to Eagle reports missing current-image targets in the import result panel
import panel keeps the latest Eagle import result visible until the user clears it or starts a new import
import result panel can copy counts, skipped/failure details, and destination folder links for troubleshooting
long import result details scroll inside the result body while Clear and Copy remain visible
import results and confirmation dialogs stay inside their panel or viewport when padding is applied on narrow layouts
long localized result and dialog titles wrap without covering Clear, Copy, Cancel, or Write actions
failure details copied from the result panel use the current UI language for Eagle connection, timeout, missing image, canceled, and skipped-reason labels
Eagle connection failures point users to start Eagle, check the Eagle API URL, and use Config > Test Eagle
native fetch fallback requests time out with the same diagnosis as userscript GM requests instead of waiting indefinitely
native fetch timeout remains active until the complete JSON or image response body has been read
item/add is never retried automatically; timeout, connection loss, or an invalid success response reports that the item may already exist and directs duplicate-safe recovery
an uncertain item/add outcome stops the current batch before any later item writes while preserving completed and failed counts
fatal errors with unhandled planned items mark the result as stopped before completion instead of leaving unexplained count gaps
Eagle 401/403 or invalid-token failures point users to the API token in Config and Eagle Developer settings
oversized or multiline API failures remain compact in notifications and result panels while preserving the actionable diagnosis
HTML or otherwise non-JSON responses identify the configured endpoint as a likely non-Eagle/V2 API URL
Eagle connection failures and no-loaded-image failures also appear in the import result panel and can be copied
when no images are loaded/selected, the import result reports that local selection issue before trying Eagle connection
```

Default settings:

```text
Eagle API URL: http://localhost:41595
Folder template: Eagle Looms/{site}/{date}
Import limit: 100
Source tag limit: 20 additional tags; source:published:* is retained when available
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
folder fallback counts when the optional Site / Copyright preset has to replace missing copyright
sample resolved copyright/character/author values when present
destination folders and folder metadata samples only describe items that will actually be written, not duplicates or preflight failures
source tag limit and duplicate policy
```

After import, inspect Eagle:

```text
item names use source identity, without generated 001_ order prefixes
pathological punctuation-only titles and extensible structured names remain non-empty and at most 180 characters
default MyGO folder resolves under Eagle Looms/anime-pictures.net/YYYY-MM-DD
items have website pointing to source post URL
items have original image url when Eagle preserves it
visible tags contain source semantic tags only
items do not force eagle-looms, site:*, gallery:*, chapter:*, ext:*, mime:*, or post:* tags
copyright/character/author tags are normalized and prioritized within the cap
case-only tag and character-path variants collapse to one visible tag or folder assignment while preserving the first readable spelling
case-only folder paths share the same folder-ID and filename caches, avoiding repeated tree reads and inconsistent same-folder name suffixes
general raw source tags are copied within the cap
normal image item annotation is empty / clean
author annotations contain only unique absolute HTTP(S) links and stop at 20 entries
copying an import plan or result falls back cleanly when Clipboard API is denied or the page loses focus
no _eagle-looms/Data folder or Eagle Looms raw bookmark item is created by the import
legacy raw records, if already present from older versions, are only used for duplicate compatibility
```

Folder-token behavior:

```text
folder tokens resolve from uncapped source metadata even when visible source tag limit is low
multiple copyright values choose the shortest normalized folder value
default Site / Import date preset uses the local date captured when import starts, even when source publication metadata exists
optional Site / Copyright preset falls back to gallery, author, chapter, then Unsorted when copyright is missing
templates using {character} add the same image to multiple character folders when distinct characters exist
explicitly qualified character variants fold only when the unqualified base character is present
qualified disambiguations such as same-name characters from different works remain separate folders
```

Duplicate behavior:

```text
rerunning import skips exact source/origin/legacy-raw-record/legacy-annotation duplicates
relative post and media links collected from list pages are stored as absolute HTTP(S) URLs and remain duplicate-queryable after reload
Anime Pictures post links with by_tag/lang navigation state or the legacy pictures/view_post route resolve to the same stable /posts/{id} source identity
Anime Pictures detail pages retain the visible Date published value and About artists profile URLs when the API is unavailable
Anime Pictures single-post pages collect only the current post and use its explicit thumbnail; Similar to and uploader-avatar images never enter the import plan
Twitter/twitter.com/mobile.twitter.com media links and tracking parameters resolve to one x.com source identity while retaining the photo/video position
reversing a Twitter multi-image post changes display order without changing each image's original /photo/{n} source position
Danbooru, Gelbooru, yande.re, Konachan, Rule34, e621, Pixiv, ExHentai, and E-Hentai detail routes discard navigation state while retaining their stable post/work/page identity
same-session re-import skips before querying Eagle again
same-session skips are scoped to the current Eagle library, so switching libraries does not suppress a valid import into the new library
turning off Skip Eagle Duplicates clearly states that existing-library matches are allowed while same-session repeats remain skipped
same-plan duplicate stable keys are counted as session skips
duplicate-only reruns do not create fresh empty destination folders
multi-file subitems sharing an origin URL are not skipped unless itemKey/stable raw identity also matches
normal images sharing a source page require an exact origin or structured identity, so a partial retry does not skip unimported siblings
annotation-free V2 items can use exact source URL plus the stable source media name as a compatibility identity without collapsing sibling media
```

Folder naming behavior:

```text
Twitter / X home folders use twitter-home-YYYY-MM-DD instead of parsed post/media counts
Twitter / X user timelines use twitter-user-YYYY-MM-DD without the author name; list timelines include list identity plus local date
Twitter / X item names use the media-bearing source author instead of generic User Media chapter text
Twitter / X falls back to the media source URL for author name, tag, and profile URL when GraphQL user metadata is missing
Twitter / X keeps a saved bottom-right collapsed entry above the native X Chat launcher
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

Pawchive behavior:

```text
API tag-array text is split into individual Eagle tags instead of one brace-wrapped tag
artist and single-post pages prefer the human-readable page author over service/user ids
author annotations retain a traceable creator profile URL
```

Gelbooru behavior:

```text
list-page thumbnail `title` tags are available before detail-image loading
Wiki `?` and add/remove-search controls never become Eagle tags or author URLs
detail-page `Posted:` time becomes the source:published tag and optional item-name date prefix
```

Rule34.us behavior:

```text
statistics such as Added by, Source, and Score do not become source tags
moderation actions such as Flag for Deletion do not become source tags or author URLs
actual copyright, character, artist, general, and metadata tag links remain importable
```

NovelAI bridge behavior:

```text
Eagle item links inherit the source item's existing folder assignments for generated results
generated results smaller than 64 pixels on either edge are rejected and do not consume the monitor result limit
```

## Known External Limitation

Command-line requests to anime-pictures may return HTTP 403 from this environment. The collector is designed to run inside the real browser page context and use userscript requests for pagination, detail pages, and image/API fetches.
