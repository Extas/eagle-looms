---
project: Eagle Looms
status: 1.0 implementation
type: userscript-eagle-import-bridge
updated: 2026-05-31
primary_language: zh-CN
---

# Eagle Looms

Eagle Looms 是基于 [MapoMagpie/comic-looms](https://github.com/MapoMagpie/comic-looms) 的 userscript fork。它保留 Comic Looms 的 matcher、章节、图片队列、懒加载、范围选择和控制栏 UI，把最终“下载成 zip”的保存落点扩展为“导入当前 Eagle 资料库”。

## How It Works

```text
Open supported source page
-> Comic Looms matcher extracts chapters/images
-> Comic Looms queue fetches original binary data in the browser session
-> user selects ranges in the existing UI
-> EagleDownloader writes base64 data URLs to Eagle Web API
-> Eagle stores image items with folders, website/original URL, and semantic tags
```

Eagle Looms 不绕过 Comic Looms 的采集链路，也不让 Eagle 后台直接下载受保护图片 URL。图片二进制先在源页面浏览器会话中抓取，再通过 Eagle Web API 写入。

## Current Behavior

```text
default Eagle API URL: http://localhost:41595
default folder template: Eagle Looms/{site}/{copyright}
default folder fallback: gallery, author, chapter, then Unsorted when copyright is missing
default import limit: 100
default visible source tag limit: 20
duplicate skip: enabled by default
item names: source date prefix when available, then source identity
config preview: shows config scope, resolved example folder, visible tag policy, and extra-asset policy
bulk import: shows an Eagle preflight confirmation before writing when writable items exist
result review: keeps the latest Eagle import result in the import panel until cleared
```

导入项写入：

```text
name       source identity name, no 001_ zip order prefix
website    source page URL
url        original image URL when Eagle preserves it
folders    resolved Eagle folder IDs; multiple folders are allowed
tags       capped source semantic tags only
```

普通图片 item 不强制写 `eagle-looms`、`site:*`、`gallery:*`、`chapter:*`、`ext:*`、`mime:*`、`post:*` 这类重复信息，也默认不写长 annotation。导入只创建正常图片资产和必要文件夹，不额外创建 `_eagle-looms` 这类 bookmark / raw record 资产污染资料库。旧版本 raw record 仍只读兼容，用于识别历史导入重复项。

## Supported Highlights

```text
anime-pictures:
  /posts?page=0
  /stars?page=0
  /posts/{id}
  legacy /pictures/view_posts and /pictures/view_post/{id}
  excludes sidebar recommendation blocks such as Last stars

booru / moebooru style sites:
  Danbooru, Gelbooru, yande.re, konachan and similar categorized tag sources

other source metadata:
  E-Hentai / ExHentai, Pixiv, Twitter / X where existing matchers expose reliable metadata
```

Target smoke page:

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
```

## Project Docs

```text
docs/architecture.md
  code boundaries, import flow, upstream workflow, site coverage

docs/eagle-organization.md
  folder, tag, naming, extra-asset, and duplicate policy

docs/manual-qa.md
  automated gates and focused manual checks

docs/references.md
  upstream, Eagle API, and source metadata references
```

## Build And Verify

```powershell
npm install
npm run test:unit
npm run build
```

Local Eagle read probe:

```powershell
npm run verify:eagle
```

Full local verification, including self-cleaning Eagle write/import smoke items:

```powershell
npm run verify:all
```

Build output:

```text
dist/eagle-looms.user.js
```

Install that userscript in Tampermonkey or Violentmonkey.
