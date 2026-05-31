# Eagle Looms - Agent Guide

> Last updated: 2026-05-31.

Eagle Looms 是一个 userscript-first 的 Eagle 导入桥：尽量保持 MapoMagpie/comic-looms 的采集接口、队列、UI/UE 和工程范式，只把最终下载保存目标扩展为 Eagle Web API 导入。

文档主体使用 zh-CN；产品名、API 名、代码标识保留 English。

## Product

Eagle Looms 扩展 Comic Looms 的采集链路，新增一个受控的 Eagle import lane。

```text
Supported page
-> Comic Looms matcher
-> Gallery / chapter / image queue
-> Comic Looms downloader panel
-> EagleDownloader save target
-> Eagle Web API
-> Eagle folders, tags, annotations
```

它不是 Eagle 替代品、通用下载器、Eagle 插件、媒体数据库，也不是 tag taxonomy engine。

Ownership boundary:

```text
Source site    页面内容、原始媒体 URL、页面可见作者/标题/标签
Comic Looms    site matchers、lazy page fetching、image fetch queue、浏览/下载 UI
Eagle          资产存储、folders、tags、preview、search、用户可见的 library state
Eagle Looms    EagleDownloader、Eagle API calls、folder path template、import annotations、duplicate skip
```

默认写入必须是 additive：可以创建 folders、tag groups、tags、items；不得删除、移动、重命名、覆盖、trash 或静默 retag 既有 Eagle items，除非用户明确触发一个 UI 文案清楚说明后果的命令。

## References

非平凡工作前先读：

```text
README.md
  项目目的和当前范围

docs/references.md
  upstream repository 和 Eagle API 参考索引

docs/git-upstream.md
  本地 Git remote、Comic Looms upstream anchor 和更新流程

docs/mvp-anime-pictures-mygo.md
  当前 MVP 目标：anime-pictures MyGO 搜索结果前 100 张导入 Eagle

docs/reuse-strategy.md
  复用 Comic Looms 与 eagle-plus 的边界和取舍

docs/manual-qa.md
  自动验证和目标页手动 QA 清单

docs/implementation-plan.md
  目标模块布局和 import flow

docs/eagle-organization.md
  Eagle folder/tag/annotation/duplicate policy
```

关键外部参考：

```text
https://github.com/MapoMagpie/comic-looms
https://developer.eagle.cool/web-api
https://developer.eagle.cool/web-api/api/item
https://developer.eagle.cool/web-api/api/folder
https://developer.eagle.cool/web-api/api/tag-group
```

从 Comic Looms 复制或 fork 代码时，保留 MIT license notice，并保持 upstream 变更可追踪。

## Git

本地仓库使用 `main` 开发 Eagle Looms。`upstream` remote 指向 `https://github.com/MapoMagpie/comic-looms.git`，只用于 fetch 和比较上游，不直接 push，不整仓 merge 到 `main`。

当需要同步 Comic Looms：

```powershell
git fetch upstream --tags
git diff <previous-upstream-anchor>..upstream/master -- src package.json vite.config.ts tsconfig.json
```

按模块移植必要改动，保持 `src/eagle/` 为 Eagle save target 边界。完成后更新 `docs/git-upstream.md` 和 `docs/reuse-strategy.md` 中的 upstream anchor。

## Architecture

目标代码布局：

```text
src/main.ts
  upstream-style userscript entry、route bootstrap、matcher setup

src/platform/
  Comic Looms compatible site matchers 和 gallery metadata extraction

src/download/
  upstream Comic Looms downloader/queue code; avoid edits unless required for Eagle target

src/eagle/
  eagle-web-api.ts       typed HTTP client around Eagle Web API V2
  eagle-downloader.ts    subclass of Comic Looms Downloader; overrides final save step only
  folders.ts             ensure folder path and folder cache
  transport.ts           GM_xmlhttpRequest/fetch transport shared by Eagle helpers

src/ui/
  keep Comic Looms UI; Eagle options are normal ConfigPanel items
```

Eagle import 语义放在 `src/eagle/eagle-downloader.ts`。不要重新造一套独立面板、采集队列或状态机；优先适配上游 `Matcher`、`PageFetcher`、`IMGFetcher`、`Downloader` 的接口。

## Eagle API Rules

使用 Eagle Web API V2，本地 base URL：

```text
http://localhost:41595/api/v2/
```

启动检查：

```text
GET /api/v2/app/info
GET /api/v2/library/info
```

v1 import 需要的 endpoints：

```text
POST /api/v2/folder/get
POST /api/v2/folder/create
POST /api/v2/item/get
POST /api/v2/item/query
POST /api/v2/item/add
GET  /api/v2/tagGroup/get
POST /api/v2/tagGroup/create
POST /api/v2/tagGroup/addTags
```

在 userscript 中，默认假设页面上下文的 browser `fetch` 可能被 CORS 拦截。Eagle API 调用优先走 `GM_xmlhttpRequest`，除非 runtime probe 证明普通 `fetch` 可用。

默认不使用 remote Eagle API access 或 token。若以后加入远程访问，不得提交 token、真实 token 示例或包含 token 的日志。

## Import Policy

首选 item import mode：

```text
base64 data URL    默认。由浏览器会话内的 Comic Looms fetch pipeline 获取二进制后写入 Eagle，避免 Eagle 后台下载被站点 403。
url                仅保留为未来高级模式，不应作为 anime-pictures 等站点默认路径。
path/bookmark      未来扩展。
```

Eagle 写入默认逐项执行。userscript 内存才是主要限制，尤其是 Base64；不要为了吞吐量牺牲可靠性。

每个导入 item 应包含：

```text
name       稳定 source identity，不添加 zip 打包序号前缀
website    原始页面 URL
url        原图 URL
folders    resolved Eagle Looms folder IDs
tags       required Eagle tags + capped source tags; copyright/character/author namespaces are normalized
annotation compact eagle-looms JSON only when needed for subitems or author URLs
```

## Validation

当前项目是 1.0 userscript implementation。常规 gates：

```powershell
npm run typecheck
npm run test:unit
npm run build
```

Live write testing 使用小型测试图库和测试根目录，例如：

```text
Eagle Looms/_Smoke
```

清理测试数据时，只能针对本次测试创建的 items，并且需要用户明确确认。

## Conventions

```text
prefer small typed adapters over ad hoc request objects
keep Eagle writes behind EagleDownloader and the Eagle API helper layer
keep folder/tag creation idempotent
store source metadata in Eagle native fields and tags first; use annotation only for compact extras
cap source tags to avoid tag explosions while still importing raw source tags within the limit
respect source site load limits inherited from Comic Looms
respect dirty worktrees and concurrent writers
```
