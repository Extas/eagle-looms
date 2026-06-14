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
Site / Date            Eagle Looms/{site}/{date}
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
omit missing token segments
resolve folder tokens from uncapped source metadata
default {date} uses source publish/upload date when available, otherwise local import date
choose the shortest normalized copyright when multiple copyright tags exist
for the optional Site / Copyright preset, fall back to gallery, author, chapter, then Unsorted when copyright is missing
expand multiple distinct characters into multiple Eagle folders only when the template uses {character}
fold obvious outfit-style longer character variants into the shorter character name
do not include parsed item counts, page numbers, retry state, or other run-state values in folder tokens
feed/home timelines without a stable collection title use semantic name plus local date, such as twitter-home-2026-05-31
search/list pages use source taxonomy labels, such as danbooru-search-bang_dream, not result counts
```

The default stays at site/date level to avoid creating too many taxonomy-derived subfolders. Tags carry copyright, character, author, and other source semantics for search. Users can opt into copyright, gallery, author, or character folders when they want that browsing model.

Older saved built-in folder presets from before the site/date default are migrated to `Site / Date`. New explicit preset choices are kept after that migration.

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
copyright / game copyright / parody / parodys / series / franchise / 作品 / 原作 / 系列  -> copyright:{name}
character / char / 角色 / 人物                                                             -> character:{name}
author / artist / creator / illustrator / writer / mangaka / group / circle / 作者 / 藝術家 / 社團  -> author:{name}
```

Other reliable source tags are imported as raw tags. The visible tag cap defaults to 20 and is clamped to `0..100`; `0` copies no visible source tags. Within the cap, `copyright:`, `character:`, and `author:` are ordered before general visual tags.

Object-shaped source tags extract common display fields such as `name`, `tag`, `tag_en`, `tag_name`, `display_name`, `name_en`, and `translated_name`; source-provided `translation.en` / `localized.english` style fields are accepted when no direct display field exists; nested `tag`, `tags`, `values`, and `items` containers are flattened.

Category labels normalize common page decorations before mapping, including case, underscores, hyphens, trailing `:` / `：`, and optional plural markers such as `Artist(s)` or `Tag(s)`.

Source-site display counts are removed from tag values, including suffixes like `120K`, `+403`, `(11)`, and `[1,234]`; non-count qualifiers such as `miku (vocaloid)` are preserved.

Per-post metadata buckets such as `post:123`, `id_123`, and Pixiv-style artwork IDs use the matching bucket only. If bucket values are structured objects, their own `type`, `category`, `tag_type`, `namespace`, or nested `tag` category is normalized before import.

`eagle-looms` and `eagle-looms:raw` are not added to new imports.

## Source Metadata

Current source mapping rules:

```text
Danbooru / Gelbooru / e621
  use data-tag-string attributes, descendant metadata, numeric Danbooru category classes, and detail-page tag lists

yande.re / konachan
  use Moebooru Post.register / Post.register_tags when present

anime-pictures
  map game copyright, character, and author blocks; keep other detail tags raw

E-Hentai / ExHentai
  map gallery namespaces: parody -> copyright, character -> character, artist/group/circle -> author

Hitomi
  map galleryinfo parodys -> copyright, characters -> character, artists/groups -> author

Chinese gallery pages
  map common labels such as 作品/角色/作者/藝術家/社團 into global namespaces; keep 標籤/分類/語言 as raw tags

Pixiv
  author comes from Pixiv user identity; artwork tags stay raw because Pixiv does not classify copyright/character reliably; source-provided tag translations are kept as additional raw tags

Twitter / X
  author comes from screen_name; hashtags stay raw
```

## Item Names

Names are display labels, not duplicate identity.

Rules:

```text
preserve source identity names such as anime-pictures-917184.png
prefix item names with YYYY-MM-DD when the source publish/upload date is available
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

Legacy `eagle-looms/raw/v1` annotations remain readable for duplicate checks so older imported libraries do not regress. They are not written by the current importer.

## Confirmation Policy

Confirmation only controls whether the user reviews the import plan before writing. It does not change the additive write policy, duplicate policy, folder creation, or item fields.

Default mode is `auto` with threshold `3`: imports with `will-write <= 3` write directly after a clean preflight, while larger plans ask for confirmation. `always` confirms any plan with new items to write. `never` skips confirmation unless preflight failures or import-limit omissions need review.

## Duplicate Policy

Default duplicate checks are additive and conservative:

```text
query exact stableKey, source URL, origin URL, and legacy stableKey
match legacy raw records only when assetItemId exists and identity matches
match URL-only duplicates only for single-file items
skip same-session and same-plan stable keys before creating folders
do not query by display name or low-signal subitem filename alone
never merge, delete, retag, or update existing items silently
```

Multi-file subitems with the same origin URL are not treated as duplicates of each other unless their `itemKey` / stable raw identity also matches.
