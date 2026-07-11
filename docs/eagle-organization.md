# Eagle Organization

This document is the source of truth for how Eagle Looms writes Eagle image items.

## Principles

Folders answer where a batch belongs. Tags answer what an asset is. Eagle fields hold provenance that Eagle already models, such as website and original URL.

Avoid turning infrastructure into visible tags. `site`, `gallery`, `chapter`, file extension, MIME type, and stable keys are already represented by folders, fields, media data, or duplicate logic. Duplicating them in the user-visible tag list makes Eagle harder to browse.

This follows booru and tag-manager practice: category/namespace tags such as artist, copyright, and character are stable identity signals; general or AI-predicted feature tags are useful for search but too noisy for default folder roots. Keep the visible tag list bounded and keep folder names semantic.

## Folders

Default template:

```text
Eagle Looms/{site}/{date}
```

Supported path tokens:

```text
{site}
{date}
{gallery}
{chapter}
{copyright}
{character}
{author}
```

Built-in presets:

```text
Site / Import date     Eagle Looms/{site}/{date}
Site / Copyright       Eagle Looms/{site}/{copyright}
Site / Gallery         Eagle Looms/{site}/{gallery}
Site / Gallery / Chapter
Site / Copyright / Author
Site / Copyright / Character
Custom path
```

Folder token rules:

```text
sanitize unsafe folder characters
render booru-style underscores as spaces in copyright, character, and author folder names
omit missing token segments
resolve folder tokens from uncapped source metadata
{date} always uses the local date captured when the import starts
source publication date stays in source:published:* and can optionally prefix item names
choose the shortest normalized copyright when multiple copyright tags exist
for the optional Site / Copyright preset, fall back to gallery, author, chapter, then Unsorted when copyright is missing
expand multiple distinct characters into multiple Eagle folders only when the template uses {character}
fold an explicitly qualified character variant only when its unqualified base character is also present
keep qualified names used to distinguish different characters, and merely prefix-similar names, in separate folders
do not include parsed item counts, page numbers, retry state, or other run-state values in folder tokens
feed/home/user timelines without a stable collection title use semantic name plus local date, such as twitter-home-2026-05-31 or twitter-user-2026-05-31
search/list pages use source taxonomy labels, such as danbooru-search-bang_dream, not result counts
```

The default stays at site/date level to avoid creating too many taxonomy-derived subfolders. Tags carry copyright, character, author, and other source semantics for search. Users can opt into copyright, gallery, author, or character folders when they want that browsing model.

Older saved built-in folder presets from Eagle Looms 1.0.7 and earlier are migrated to `Site / Import date`. New explicit preset choices are kept after that migration.

Import plan messages report copyright fallback only when the optional Site / Copyright preset is selected. Custom templates still report missing metadata so users can decide whether to change the template.

## Visible Tags

Visible image item tags are source semantic tags only. Eagle Looms does not force these infrastructure tags onto normal image items:

```text
eagle-looms
site:*
gallery:*
chapter:*
ext:*
mime:*
post:*
```

Source metadata namespaces are normalized globally:

```text
copyright / game copyright / parody / parodys / series / work / original work / franchise / IP / 作品 / 原作 / 系列  -> copyright:{name}
character / char / 角色 / 人物                                                             -> character:{name}
author / artist / creator / illustrator / writer / translator / editor / mangaka / group / circle / 作者 / 藝術家 / 社團  -> author:{name}
```

Tags and resolved folder paths are deduplicated case-insensitively while preserving the first source spelling. This matches Eagle's case-insensitive tag lookup and prevents case-only source variations from creating duplicate visible tags or repeated folder assignments.

The reliable `source:published:YYYY-MM-DD` metadata tag is preserved independently of the visible source-tag cap. Other reliable source tags are imported as raw tags. The cap defaults to 20 and is clamped to `0..100`; `0` copies no additional source tags. Within the cap, `copyright:`, `character:`, and `author:` are ordered before general visual tags.

Object-shaped source tags extract common display fields such as `name`, `tag`, `tag_en`, `tag_name`, `slug`, `display`, `text`, `display_name`, `name_en`, and `translated_name`; source-provided `translation.en` / `localized.english` style fields are accepted when no direct display field exists; nested `tag`, `tags`, `values`, and `items` containers are flattened. Object-shaped category fields such as `category: { name: "artist" }` or `tag_type: { slug: "copyright" }` are normalized before import.

Category labels normalize common page decorations before mapping, including case, underscores, hyphens, trailing `:` / `：`, and optional plural markers such as `Artist(s)` or `Tag(s)`.

Source-site display counts are removed from tag values, including suffixes like `120K`, `+403`, `(11)`, and `[1,234]`; non-count qualifiers such as `miku (vocaloid)` are preserved.

Per-item metadata buckets such as `post:123`, `id_123`, Pixiv-style artwork IDs, and slug/hash buckets like `project:neon-garden` or `artwork-neon-garden` use the matching bucket only. If bucket values are structured objects, their own `type`, `category`, `tag_type`, `namespace`, or nested `tag` category is normalized before import.

Author URL extraction follows the same author-like categories where source pages expose tag links, including artist, author, creator, illustrator, writer, translator, editor, colorist, letterer, mangaka, group, circle, 作者, 藝術家, 畫師, 社團, and 團體. Category labels are normalized before matching, so decorated labels such as `Artist(s):`, `Illustrator(s)`, `Circle(s)`, and `作者：` are accepted.

`eagle-looms` and `eagle-looms:raw` are not added to new imports.

## Source Metadata

Current source mapping rules:

```text
Danbooru / Gelbooru / e621
  use data-tag-string attributes from post cards and detail pages, descendant metadata, numeric Danbooru category/tag-type classes, detail-page tag lists, and general/meta raw tag attributes; map copyright-like aliases such as parody/series/source-work/franchise and author-like aliases such as illustrator/writer/editor/mangaka

yande.re / konachan
  use Moebooru Post.register / Post.register_tags from list and post/show pages when present, including multiline/repeated tag maps and the same copyright/character/author alias families

anime-pictures
  map game copyright/copyright-like blocks, character blocks, and author-like blocks from detail pages and API payloads; keep other detail tags raw

E-Hentai / ExHentai
  map gallery namespaces: parody -> copyright, character -> character, artist/group/circle -> author

eahentai
  map API tags, characters, author, and album type through source metadata; image publish date comes from image addDt with gallery addDt fallback

nhentai / nhentai.xxx
  map gallery tag types through source metadata; author URLs point to author-like tag pages; image publish date comes from API upload_date or page upload metadata

HentaiNexus
  map detail table rows through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like detail rows

HentaiZap / im-hentai
  map gallery detail tag rows through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like detail rows

Akuma.moe
  map info-list metadata rows through source metadata; author URLs point to author-like metadata links; image publish date comes from date-like metadata rows

AsmHentai
  map gallery detail tag rows through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like detail rows

3Hentai
  map direct-text tag rows through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like tag rows

18comic / JM
  map data-type tag rows through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like data-type rows

RokuHentai
  map categorized data-tag chips through source metadata; author URLs point to author-like tag pages; image publish date comes from date-like data-tag chips

Hitomi
  map galleryinfo parodys -> copyright, characters -> character, artists/groups -> author; image publish date comes from galleryinfo date metadata

HDoujin / Niyaniya
  map numeric API tag namespaces such as artist/circle -> author and parody -> copyright; image publish date comes from gallery creation time

Yabai
  map gallery tags through source metadata; image publish date comes from gallery date metadata

Chinese gallery pages
  map common labels such as 作品/角色/作者/藝術家/社團 into global namespaces; keep 標籤/分類/語言 as raw tags

Hanime1
  map comic metadata rows through source metadata; author URLs point to author-like metadata links; image publish date comes from date-like metadata rows

Pixiv
  author comes from Pixiv user identity in both item tags and per-artwork metadata buckets; artwork tags stay raw because Pixiv does not classify copyright/character reliably; source-provided tag translations are kept as additional raw tags

ArtStation
  author comes from user identity; project tags stay raw and support string or common object-shaped tag values

Twitter / X
  author comes from the media-bearing tweet screen_name; hashtags stay raw

Instagram
  author comes from username; caption hashtags stay raw

Kemono
  author comes from API artist/creator identity when available, otherwise stable service/user identity; post tags stay raw; author URL points to the source creator page

Jandan
  author comes from comment author metadata; publish date comes from comment date fields when available

Douban albums
  author comes from album owner metadata; author URL points to the owner profile; image publish date comes from album date metadata

Komiic
  comic authors map to author tags through gallery metadata; comic categories stay raw; image publish date comes from chapter date metadata

MangaCopy
  map comic detail rows through source metadata; author URLs point to author-like detail links; image publish date comes from comic detail update date when available

MangaGui
  map comic detail rows through source metadata; author URLs point to author-like detail links; image publish date comes from comic detail status date when available

Manga160
  map Introduct detail rows through source metadata; author URLs point to author-like detail links

YKMH
  map comic_deCon detail rows through source metadata; author URLs point to author-like detail links

WNACG
  gallery tag chips stay raw source tags; gallery description is kept in source metadata but not imported as visible tags

KuaiKan
  image publish date comes from chapter creation date metadata

Bilibili
  author comes from opus author metadata; author URL points to the Bilibili space profile; image publish date comes from opus publish time metadata

Steam Screenshots
  author comes from the Steam profile path; author URL points to the source profile; gallery title uses appid when present

Arcalive
  channel comes from the /b/{channel}/ article URL as a raw source tag; author comes from article user metadata; image publish date comes from explicit time/meta fields when available
```

## Item Names

Names are display labels, not duplicate identity.
All names retain a non-empty display stem and stay within the 180-character limit, including structured tool capsules with future extension fields.

Rules:

```text
preserve source identity names such as anime-pictures-917184.png
prefix item names with YYYY-MM-DD when the source publish/upload date is available
use the source author for Twitter/X item prefixes instead of generic User Media chapter text
do not add Comic Looms zip order prefixes such as 001_
decode common URL and HTML noise
normalize Unicode with NFKC
replace unsafe separators/reserved characters with spaces
preserve and lowercase the final extension
trim trailing spaces/periods and cap long names
dedupe visible sibling names in the current import batch with suffixes
```

Duplicate identity remains `sourceUrl`, `originUrl`, `itemKey`, and legacy stable-key annotations for backward compatibility.

## Extra Assets

New imports do not create Eagle Looms bookkeeping assets:

```text
no _eagle-looms/Data folder
no companion bookmark raw records
no eagle-looms / eagle-looms:raw tags on normal image items
```

The image item annotation stays clean by default. Source organization is derived before write from the current page metadata and stored in normal Eagle fields where applicable:

```text
name
website
url
folders
tags
```

An annotation is added only when a multi-file item needs an `itemKey` or when the source exposes traceable author pages. Author metadata accepts only absolute HTTP(S) URLs, keeps the first readable spelling, removes equivalent duplicates, and stores at most 20 links. Invalid, oversized, or relative values do not make an otherwise normal item annotation-visible.

Legacy `eagle-looms/raw/v1` annotations remain readable for duplicate checks so older imported libraries do not regress. They are not written by the current importer.

## Confirmation Policy

Confirmation only controls whether the user reviews the import plan before writing. It does not change the additive write policy, duplicate policy, folder creation, or item fields.

Default mode is `auto` with threshold `3`: imports with `will-write <= 3` write directly after a clean preflight, while larger plans ask for confirmation. `always` confirms any plan with new items to write. `never` skips confirmation unless preflight failures or import-limit omissions need review.

## Duplicate Policy

Default duplicate checks are additive and conservative:

```text
query exact stableKey, source URL, origin URL, and legacy stableKey
match legacy raw records only when assetItemId exists and identity matches
when an origin URL exists, require exact origin or structured identity instead of source-page equality alone
use source-page-only matches only when the asset has no stronger origin/subitem identity
skip same-session and same-plan stable keys before creating folders
do not query by display name or low-signal subitem filename alone
never merge, delete, retag, or update existing items silently
```

Multi-file subitems with the same origin URL are not treated as duplicates of each other unless their `itemKey` / stable raw identity also matches.
Likewise, separate images sharing one gallery/post page do not suppress one another during a partial-import retry.
