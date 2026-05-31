# Source Layout

This directory is an upstream-first Comic Looms runtime with a small Eagle save target extension.

```text
src/main.ts
  Comic Looms bootstrap; instantiates EagleDownloader.

src/platform/
  Comic Looms matcher interface and site matchers.
  `matchers/anime-pictures.ts` is the Eagle Looms target matcher.

src/download/
  Upstream downloader, chapter selection, cherry-pick, and queue flow.

src/eagle/
  Eagle Web API client, folder ensure helper, transport, and `eagle-downloader.ts`.

src/ui/
  Upstream Comic Looms UI; Eagle settings are normal ConfigPanel items.
```

See `../docs/implementation-plan.md` before changing source boundaries.
