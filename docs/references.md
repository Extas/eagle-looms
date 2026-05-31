# References

## Upstream

- Comic Looms repository: <https://github.com/MapoMagpie/comic-looms>
- Comic Looms releases publish userscript bundles such as `comic-looms.user.js`.
- Comic Looms stack: TypeScript, Vite, `vite-plugin-monkey`.
- Comic Looms license: MIT. Preserve license notices and upstream traceability when copying or porting source.

Useful upstream areas:

```text
src/platform/platform.ts      Matcher contract
src/platform/matchers/        site extractors
src/page-fetcher.ts           lazy chapter/page collection
src/img-fetcher.ts            origin URL and binary fetch state
src/fetcher-queue.ts          fetch scheduling
src/idle-loader.ts            idle loading behavior
src/download/downloader.ts    original zip save target and selection flow
src/download/gallery-meta.ts  gallery metadata container
```

## Eagle Web API

- Web API introduction: <https://developer.eagle.cool/web-api>
- Item API: <https://developer.eagle.cool/web-api/api/item>
- Folder API: <https://developer.eagle.cool/web-api/api/folder>
- Tag API: <https://developer.eagle.cool/web-api/api/tag>
- Tag Group API: <https://developer.eagle.cool/web-api/api/tag-group>
- Library API: <https://developer.eagle.cool/web-api/api/library>
- App API: <https://developer.eagle.cool/web-api/api/app>

Implementation facts to keep current:

```text
base URL: http://localhost:41595/api/v2/
Web API V2 requires Eagle 4.0 Build 21+
localhost access does not require a token
list endpoints are paginated; default limit 50, max limit 1000
item/add accepts base64, url, path, or bookmarkURL plus name, tags, folders, annotation, website
userscripts should use GM_xmlHttpRequest when page-context fetch is blocked by CORS
```

## Source Metadata

References behind the `copyright:` / `character:` / `author:` namespace policy:

- Danbooru API and tag category practice: <https://danbooru.donmai.us/wiki_pages/help:api>
- Danbooru tag categories and wiki practice: <https://danbooru.donmai.us/wiki_pages/help:tags>
- Gelbooru DAPI: <https://gelbooru.com/index.php?page=help&topic=dapi>
- yande.re / Moebooru API: <https://yande.re/help/api>
- E-Hentai gallery tagging namespaces: <https://ehwiki.org/wiki/Gallery_Tagging>
- Hydrus tag namespaces and tag-management practice: <https://wiki.hydrus.network/books/hydrus-manual/page/getting-started-tags>
- DeepDanbooru-style automatic tagging docs: <https://dghs-imgutils.deepghs.org/main/api_doc/tagging/deepdanbooru.html>
- X API data dictionary for tweet/user fields: <https://docs.x.com/x-api/fundamentals/data-dictionary>

Pixiv artwork/user data provides author/user identity and user-defined tags, but not a reliable copyright/character taxonomy, so Pixiv tags stay raw unless a matcher can classify them from another reliable source.

Best-practice summary used by this project:

```text
category/namespace tags are stable enough for identity and folder tokens
general/AI tags are useful for search but should be capped and kept out of default folder roots
source metadata should be parsed before deriving visible Eagle organization
avoid creating per-gallery or per-author tag groups by default
avoid creating extra bookkeeping assets in the Eagle library for ordinary imports
```
