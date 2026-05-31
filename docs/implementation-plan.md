# Eagle Looms Implementation Plan

Status: 1.0 implementation note
Last updated: 2026-05-31

## Decision

Eagle Looms 先做成 userscript-first TypeScript 项目，基于 Comic Looms 的源页面采集能力，而不是做 Eagle plugin。

原因：

```text
Comic Looms 已经运行在 source page 内，能拿到 cookies、DOM state、lazy gallery data 和站点特定图片 fetch 行为。
Eagle Web API 本来就面向外部工具和浏览器扩展，通过本地 HTTP 接入 Eagle。
真正缺失的是 import planning 和 safe Eagle writes，而不是另一个 Eagle-side UI。
```

## Target Product

```text
Browse gallery with Comic Looms
-> use existing downloader panel, chapter selection, cherry-pick, and progress UI
-> fetch original binary data through IMGFetcher
-> ensure destination folder path
-> import images to Eagle as base64 data URLs
-> annotate each item with source provenance
-> summarize planned/imported/skipped/failed with destination and bounded failure details
```

## Target Source Tree

```text
src/main.ts
  startup, route changes, Comic Looms bootstrap, EagleDownloader instantiation

src/platform/
  upstream-compatible matchers and metadata extraction

src/download/
  image queue and binary fetch pipeline

src/eagle/eagle-web-api.ts
  typed methods for app, library, folder, tagGroup, item endpoints and common response wrappers

src/eagle/eagle-downloader.ts
  extends Comic Looms Downloader and overrides only final save target

src/eagle/options.ts
  Eagle API URL, folder template, import limit, source tag limit normalization

src/eagle/duplicates.ts
  stable key and exact duplicate query helpers

src/eagle/tags.ts
  required tag preservation, source tag cleanup, dedupe, and cap

src/eagle/import-readiness.ts
  shared DONE-and-data readiness check matching upstream zip export behavior

src/eagle/folders.ts
  idempotent ensureFolderPath(root/site/creator/gallery/chapter)
```

## Eagle Write Flow

```text
1. probe /api/v2/app/info
2. probe /api/v2/library/info
3. resolve folder path template from {site}, {gallery}, {chapter}
4. ensure folder path
5. for each selected and fetched IMGFetcher:
   - require upstream-compatible DONE-and-data readiness
   - skip duplicate by exact stable key, source URL, and origin URL queries if enabled
   - build data URL from already fetched binary data
   - normalize required tags and capped source tags
   - POST /api/v2/item/add with name, base64, website, tags, folders, annotation
6. show planned/imported/skipped/failed summary with destination folders and bounded first failures
7. accept common Eagle item/add id wrappers so successful writes are not misreported as failures
```

## Integration Point In Comic Looms

最干净的分支点是在 image fetch queue 已经拿到 original image data 之后、`Downloader.download()` 把 `FileLike[]` 打包成 zip volumes 之前。

1.0 实现：

```text
reuse Downloader selected chapter logic
reuse CherryPick page filtering
reuse mapToFileLikes-like title sanitization
replace zip.add/saveAs with Eagle Web API item/add
```

1.0 为 Eagle-first 发行版，Download panel 的 primary action 导入 Eagle。保留上游结构，后续如果要同时支持 zip 和 Eagle，应通过 save target abstraction 增加切换，而不是复制一套 UI。

## Compatibility Contract

新增站点必须优先实现或复用 Comic Looms matcher：

```text
fetchChapters()
fetchPagesSource(chapter)
parseImgNodes(pageSource, chapterID)
fetchOriginMeta(node, retry, chapterID)
headers(node)
galleryMeta(chapter)
```

禁止为单个站点绕过 `PageFetcher`、`IMGFetcherQueue`、`IdleLoader` 或 `DownloaderPanel` 重新实现采集 UI。Eagle 相关逻辑只允许出现在保存目标和配置项中。

## Dedupe Strategy

需要 layered dedupe，因为不同站点没有单一可靠 key：

```text
stableKey        `eagle-looms:{sourceUrl}`
website/url      Eagle item filter by source URL and origin URL
annotation       embedded eagle-looms envelope for search/recovery
```

默认 duplicate behavior：

```text
skip exact known imports
query stable key, source URL, and origin URL separately instead of relying on Eagle search OR syntax
never update existing items silently
allow explicit "add anyway" for intentional variants
```

## Phases

### Current MVP - anime-pictures MyGO 100

```text
target URL: https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
target count: first 100 results
strategy: standard Comic Looms Matcher under src/platform/matchers/anime-pictures.ts
destination template: Eagle Looms/{site}/{gallery}
details: docs/mvp-anime-pictures-mygo.md
```

### Phase 0 - Scaffold

```text
docs and AGENTS.md
project name and boundaries
target organization policy
done
```

### Phase 1 - Upstream-first Fork

```text
copy Comic Looms TypeScript/Vite/vite-plugin-monkey runtime
preserve Comic Looms MIT license and upstream commit trace
keep matcher/page-fetcher/downloader UI interfaces unchanged
instantiate EagleDownloader in src/main.ts
route changes recompute runtime config from global config plus normalized site overrides
done
```

### Phase 2 - Eagle Save Target

```text
probe Eagle app/library through Web API V2
ensure folder path from Config panel template
import already-fetched IMGFetcher binary data as base64 data URL
write website, url, required tags, capped source tags, and compact eagle-looms JSON only when needed
normalize copyright/character/author source namespaces while preserving other source tags within the cap
skip duplicate source/origin/annotation matches by default
done
```

### Phase 3 - anime-pictures MyGO 100

```text
add upstream-compatible anime-pictures matcher
collect posts pages until Eagle Import Limit
resolve original media from detail page
prefer direct images.anime-pictures.net media candidates over api download_image endpoints
reuse Comic Looms chapter selection, cherry-pick, retry, progress canvas
automated local gates pass
source tag cap implemented as a shared Eagle tag normalizer
pending live target-page manual QA
```

### Phase 4 - Broader Site Coverage

```text
keep copied Comic Looms matchers current with upstream
add only missing matchers as standard Matcher implementations
consider a save target switch if zip and Eagle need to coexist
add per-site source tag normalization only after real source metadata patterns are observed
```
