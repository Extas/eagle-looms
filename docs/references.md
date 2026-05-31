# Eagle Looms References

Status: active reference index
Last updated: 2026-05-31

## Upstream

- Comic Looms repository: <https://github.com/MapoMagpie/comic-looms>
- Comic Looms install/release model: GitHub releases publish `comic-looms.user.js`.
- Comic Looms build stack: TypeScript, Vite, `vite-plugin-monkey`.
- Comic Looms license: MIT. 复制或 fork source 时保留 upstream license notice。

关键 upstream implementation areas：

```text
src/main.ts
  userscript bootstrap 和 route-change reinitialization

src/platform/platform.ts
  Matcher interface: chapters、page sources、image nodes、origin metadata、binary fetches、gallery metadata

src/platform/matchers/
  site-specific extractors

src/page-fetcher.ts
  lazy chapter/page queue initialization

src/img-fetcher.ts
src/fetcher-queue.ts
src/idle-loader.ts
  origin URL 与 binary image loading pipeline

src/download/downloader.ts
  当前 zip packaging flow；Eagle Looms 在 `Downloader.download()` 分支到 Eagle save target

src/download/gallery-meta.ts
  minimal gallery metadata object；Eagle Looms 将其写入 tags/annotation envelope
```

## Eagle Web API

- Web API introduction: <https://developer.eagle.cool/web-api>
- Item API: <https://developer.eagle.cool/web-api/api/item>
- Folder API: <https://developer.eagle.cool/web-api/api/folder>
- Tag API: <https://developer.eagle.cool/web-api/api/tag>
- Tag Group API: <https://developer.eagle.cool/web-api/api/tag-group>
- Library API: <https://developer.eagle.cool/web-api/api/library>
- App API: <https://developer.eagle.cool/web-api/api/app>

需要保持最新的关键事实：

```text
Base URL: http://localhost:41595/api/v2/
Minimum Eagle version for Web API V2: Eagle 4.0 Build 21+
Localhost access: no token required
Userscript page-context calls: use GM_xmlhttpRequest when CORS blocks fetch
List endpoints: paginated, default limit 50, max limit 1000
```

v1 实现的主 endpoints：

```text
GET  /api/v2/app/info
GET  /api/v2/library/info
POST /api/v2/folder/get
POST /api/v2/folder/create
POST /api/v2/item/get
POST /api/v2/item/query
POST /api/v2/item/add
```

`POST /api/v2/item/add` 支持从 `url`、`base64`、`path` 或 `bookmarkURL` 创建 items，并接受 `name`、`tags`、`folders`、`annotation`、`website` 等字段。
