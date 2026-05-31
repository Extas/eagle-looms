# Eagle Item Naming

Status: active design note
Last updated: 2026-05-31

## Goal

Item names should be readable, stable, and safe for Eagle imports without taking over duplicate identity. Eagle item identity remains `sourceUrl`, `originUrl`, `itemKey`, and the annotation `stableKey`; item name cleanup only prevents broken-looking names and visible same-folder collisions in one import batch.

## Sources

- Eagle Web API `addFromURL` and `addFromPath` both accept a `name` plus source fields such as `website`, `tags`, `annotation`, and folder target, so the name is only one display field: <https://api.eagle.cool/item/add-from-url> and <https://api.eagle.cool/item/add-from-path>.
- Eagle Plugin API can query items by fields beyond display name; this supports keeping duplicate detection on source identity rather than display name: <https://developer.eagle.cool/plugin-api/api/item>.
- Windows filename rules are a useful lower bound for user-visible names: avoid reserved characters, control characters, device names, and trailing spaces or periods: <https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file>.
- JavaScript `String.prototype.normalize("NFKC")` is available in target browsers and handles full-width and compatibility forms without an extra dependency: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize>.

## Rules

1. Preserve source identity names such as `anime-pictures-917184.png`.
2. Decode common web noise: URL path last segment, percent encoding, and common HTML entities.
3. Normalize Unicode with NFKC, remove invisible formatting controls, and collapse whitespace.
4. Replace filesystem/Eagle-hostile separators and reserved characters with spaces rather than underscores for readability.
5. Preserve and lowercase the final extension.
6. Avoid Windows device-name stems such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`, and `LPT1`.
7. Trim trailing spaces/periods and cap names at 180 characters while preserving extension and copy suffix.
8. Deduplicate only within the resolved destination folder for the current batch, using case-insensitive comparison and copy suffixes like `name (2).jpg`.

## Non-Goals

- Do not transliterate CJK, kana, emoji, or source-native names.
- Do not query the whole Eagle library by name; same display name can legitimately refer to different assets.
- Do not add a slug or filename library for this small, deterministic transformation.
