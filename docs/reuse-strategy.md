# Reuse Strategy

Status: active implementation note
Last updated: 2026-05-31

## From Comic Looms

Eagle Looms now uses an upstream-first fork strategy:

```text
Matcher interface
  keep Comic Looms `Matcher<P>` contract unchanged

Lazy page collection
  keep `PageFetcher` and async `fetchPagesSource` semantics

Origin resolution and binary fetch
  keep `IMGFetcher` stages URL -> DATA -> DONE and `GM.xmlHttpRequest` binary fetch

Downloader branch point
  subclass `Downloader` and override only final `download(chapters)` save target
```

Current comparison target:

```text
MapoMagpie/comic-looms HEAD inspected locally: 8ce7f98
Key files inspected:
  src/platform/platform.ts
  src/fetcher-queue.ts
  src/img-fetcher.ts
  src/page-fetcher.ts
  src/download/downloader.ts
  src/ui/downloader-panel.ts
```

Implementation reuse now reflected in Eagle Looms:

```text
Upstream code copied into this project:
  src/config.ts
  src/main.ts
  src/platform/platform.ts and matchers
  src/page-fetcher.ts
  src/img-fetcher.ts
  src/fetcher-queue.ts
  src/idle-loader.ts
  src/download/downloader.ts
  src/ui/*
  src/utils/*

Minimal Eagle-specific extensions:
  src/eagle/eagle-downloader.ts
    extends Comic Looms Downloader and writes fetched binary data to Eagle
  src/platform/matchers/anime-pictures.ts
    standard Matcher implementation for anime-pictures posts pages
  src/config.ts
    adds Eagle API URL, folder path template, import limit, duplicate skip
  src/main.ts
    instantiates EagleDownloader instead of Downloader

Fetcher state discipline:
  browser fetches binary first, then Eagle receives base64 data URLs
  Eagle URL background download is not the default because anime-pictures returned 403 in testing
  duplicate checks happen before write
```

Comic Looms source is MIT licensed. Keep the upstream commit traceable and preserve license notices when publishing.

## From eagle-plus

Eagle Looms follows the Eagle environment proven by `../eagle-plus`:

```text
Eagle HTTP base: http://localhost:41595
Eagle MCP base:  http://127.0.0.1:41596/mcp
Current Eagle Web API probe:
  GET /api/v2/app/info
  GET /api/v2/library/info
```

For a userscript, use Eagle Web API directly through `GM_xmlhttpRequest`. This avoids relying on the Eagle plugin SDK host and avoids the dev-server MCP proxy used by eagle-plus.

Reusable rules:

```text
timeout bounded calls
no false success
write only through one boundary
self-contained smoke destination
never mutate existing items silently
```
