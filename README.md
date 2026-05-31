---
project: Eagle Looms
status: 1.0 implementation
type: userscript-eagle-import-bridge
updated: 2026-05-31
primary_language: zh-CN
---

# Eagle Looms

Eagle Looms 是一个基于 MapoMagpie/comic-looms 的 userscript：保留 Comic Looms 的 matcher、章节、图片队列、懒加载、范围选择和控制栏 UI/UE，把最终“下载成 zip”的保存落点扩展为“通过 Eagle Web API 导入当前 Eagle 资料库”。

项目名 `eagle-looms` 合适：`looms` 保留 Comic Looms 的“织机/批量编织图库”心智，`eagle` 明确最终资产归档目的地。

## Core Loop

```text
Open supported gallery page
-> Comic Looms matcher extracts chapters/images
-> Comic Looms queue fetches original binary data in browser session
-> User uses the existing Download panel/chapter/cherry-pick UI
-> EagleDownloader ensures Eagle folders
-> EagleDownloader imports base64 data URLs into Eagle
-> Eagle stores folders, tags, website, and original URL
```

## Boundary

```text
Source site owns page content and original media URLs.
Comic Looms owns site matchers, lazy fetching, browse UI, and binary image pipeline.
Eagle owns asset storage, folders, tags, preview, search, and library state.
Eagle Looms owns the Eagle save target, Eagle API calls, folder path template, duplicate skipping, and tags.
```

默认写入是 additive：创建 folders、创建 tag groups/tags、添加新 items。除非用户明确选择 update action，否则不修改既有 Eagle assets。

## Initial Documents

| File | Role |
|---|---|
| `AGENTS.md` | agent/contributor operating guide |
| `docs/mvp-anime-pictures-mygo.md` | 当前 MVP 目标：采集 anime-pictures MyGO 前 100 张 |
| `docs/reuse-strategy.md` | 复用 Comic Looms 和 eagle-plus 的具体边界 |
| `docs/manual-qa.md` | 本地自动验证和目标页手动 QA 清单 |
| `docs/references.md` | upstream 和 Eagle API reference index |
| `docs/git-upstream.md` | 本地 Git remote 和 Comic Looms upstream 更新流程 |
| `docs/implementation-plan.md` | implementation architecture 和 phased work |
| `docs/eagle-organization.md` | 推荐的 Eagle folder/tag/annotation strategy |
| `src/README.md` | planned source layout |

## Current Behavior

```text
入口、浏览、章节选择、范围选择、加载状态、失败重试沿用 Comic Looms UI。
Download panel 的 Start action 写入 Eagle，而不是打包 zip。
配置面板新增 Eagle API URL、Eagle folder path、Eagle import limit、Eagle source tag limit、Skip duplicates。
Eagle API URL、folder path template、import limit、source tag limit 会在保存和启动时归一化，避免空路径、非法 URL、越界数量或标签爆炸造成整批失败。
全局配置和站点级配置都会对 Eagle 字段做归一化；路由切换时从 global config 重新合并，避免上一个站点的 Eagle 覆盖项污染当前站点。
图片二进制由 Comic Looms `IMGFetcher` 在浏览器会话内抓取，导入 Eagle 时使用 `data:<mime>;base64,...`，避免 Eagle 后台 URL 下载触发 403。
anime-pictures 原图解析优先使用页面暴露的 `images.anime-pictures.net` 直连候选；`api.anime-pictures.net/pictures/download_image/...` 只作为候选回退，避免复现 Eagle 后台下载 403。
anime-pictures 搜索页采集会排除 `#sidebar`、`.sidebar_block`、`.last-stars` 等侧栏推荐区，避免 `Last stars` 缩略图混入目标搜索结果。
导入队列沿用上游 zip 保存的 `FetchState.DONE && data` 契约，不导入重置/失败状态里的旧数据。
默认目标目录模板：`Eagle Looms/{site}/{gallery}`，支持 `{site}`、`{gallery}`、`{chapter}`。
每个 item 写入 `website`、`url`、必备 tags 和受上限约束的来源 tags；`copyright`、`character`、`author/artist` 统一归一化为 `copyright:`、`character:`、`author:` 前缀，其他来源 tags 原样导入。普通图片默认不写长 annotation；多文件子项或作者 URL 仅写一行最小 JSON。
Booru 类 matcher 会把列表页已有 tag 字符串写回图片节点；如果页面暴露 copyright/character/artist 分类属性，则同样进入统一命名空间，否则按 raw source tags 导入。
Eagle `item/add` 响应会兼容常见 `id`、`itemId`、`item`、`items`、`ids`、`data.*` 包装，避免写入成功但脚本误判失败。
duplicate check 默认分别按 source URL、origin URL、annotation stable key 精确查询 Eagle，不依赖复杂搜索语法，不静默修改既有 items。
导入 summary 显示 planned/imported/skipped/failed、目标文件夹和前几个失败原因；如果没有已加载且选中的图片，会明确失败而不是显示空成功。
```

## Current MVP

当前目标先收缩到一个可验证任务：

```text
采集 https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!! 的前 100 张图片，并导入 Eagle。
```

具体执行标准见 `docs/mvp-anime-pictures-mygo.md`。

## Build

```powershell
npm install
npm run test:unit
npm run build
npm run verify:eagle
npm run verify:eagle:write-smoke
```

构建产物是 `dist/eagle-looms.user.js`，安装到 Tampermonkey/Violentmonkey 后，在 Comic Looms 支持的页面显示原有控制栏；在 anime-pictures posts 搜索页可使用新增 matcher 导入 Eagle。

日常本地门禁：

```powershell
npm run verify:local
```

包含 self-cleaning Eagle 写入 smoke 的完整本地门禁：

```powershell
npm run verify:all
```
