# MVP - anime-pictures MyGO Import

Status: active 1.0 verification target
Last updated: 2026-05-31

## Goal

先只验证一个具体、可观察的闭环：

```text
从 anime-pictures.net 的 bang dream! it's mygo!!!!! 搜索结果中，按页面顺序采集前 100 张图片，并导入 Eagle。
```

目标 URL：

```text
https://anime-pictures.net/posts?page=0&search_tag=bang+dream!+it%27s+mygo!!!!!
```

当前实现必须沿用 Comic Looms 的采集接口：

```text
Matcher.fetchPagesSource()
-> Matcher.parseImgNodes()
-> Matcher.fetchOriginMeta()
-> BaseMatcher.fetchImageData()
-> IMGFetcherQueue / IdleLoader
-> Downloader.download()
```

Eagle Looms 只替换最后一步保存目标：`EagleDownloader` 继承 Comic Looms `Downloader`，在图片二进制已经由 `IMGFetcher` 抓取完成后，把数据写入 Eagle。

## Success Criteria

MVP 成功标准：

```text
1. userscript 能识别 anime-pictures target search page
2. 能从 page=0 开始提取 post links、thumbnails、post IDs
3. 能按顺序跨页采集，直到 Eagle Import Limit，默认 100，并排除 `Last stars` 等 sidebar 推荐图
4. 能通过 Comic Looms 原有 full-view grid、chapter selection、cherry-pick 和 downloader panel 操作
5. 能在浏览器会话中解析 original image URL 并抓取 binary data
6. 能连接本机 Eagle Web API
7. 能创建或复用目标 folder path
8. 能把已抓取 binary data 作为 base64 data URL 导入 Eagle
9. 每张图片有稳定 name、website、origin url 和 source tags；普通图片不写长 annotation
10. 重复执行默认按 source/origin/annotation stable key 跳过重复项
11. 导入完成后显示 planned/imported/skipped/failed summary，并带目标 folder 与有限失败原因
```

非目标：

```text
不另造独立采集面板
不绕过 Comic Looms Matcher / PageFetcher / IMGFetcherQueue
不把 Eagle URL 后台下载作为默认路径
不做远程 Eagle API/token
不做既有 Eagle item 的批量修改
不做自动删除或清理
```

## Eagle Destination

默认目录模板：

```text
Eagle Looms/{site}/{gallery}
```

For the MyGO target page this resolves to:

```text
Eagle Looms/anime-pictures.net/anime-pictures_bang dream! it's mygo!!!!!_100
```

Config panel 允许用户覆盖保存路径，输入格式为 slash-separated Eagle folder path：

```text
Eagle Looms/{site}/{gallery}/{chapter}
```

支持 tokens：

```text
{site}
{gallery}
{chapter}
```

配置通过 userscript storage 记住。自动 smoke 测试只写入自清理目录：

```text
Eagle Looms/_Smoke/write-smoke
Eagle Looms/_Smoke/import-smoke
```

## Item Naming

Eagle item name 表示资产身份，不承担 zip 文件排序职责。anime-pictures 默认命名：

```text
anime-pictures-{post-id}.{ext}
```

不要添加 Comic Looms zip 打包用的 `001_` 顺序前缀。同名冲突时才追加 `_1`、`_2`。原始页面 URL 写入 Eagle `website`，原图 URL 写入 Eagle `url`，避免把详情面板塞满导入说明。

## Tags

必备 tags：

```text
eagle-looms
site:anime-pictures.net
gallery:{gallery-title}
chapter:{chapter-title}
mime:{content-type}
```

来自 `ImageNode.tags` 的站点 tags 会被保留，例如：

```text
post:{post-id}
ext:{extension}
site:anime-pictures.net
copyright:{work-or-series}
character:{name}
author:{creator}
single
purple eyes
```

anime-pictures 详情页中 `game copyright`、`character`、`author` 会分别归一化为 `copyright:`、`character:`、`author:` 命名空间；`reference`、`object` 等其他来源 tags 原样导入，并统一受 Eagle Source Tag Limit 限制。1.0 不为每个 gallery 自动创建 tag group。常用来源信息优先进入 Eagle 原生字段和 tags，避免 annotation 噪音。

## Annotation

普通图片 item annotation 默认留空。只有多文件子项需要跨会话判重，或需要保留多个作者 URL 时，才写一行紧凑 JSON：

````text
{"schema":"eagle-looms/item/v1","sourceUrl":"...","originUrl":"...","stableKey":"...","itemKey":"...","authorUrls":["..."]}
````

## Fetch Strategy

默认策略：

```text
1. Page/detail collection runs through Comic Looms matcher methods.
2. Original binary fetch runs through Comic Looms `BaseMatcher.fetchImageData()` and `GM_xmlhttpRequest`.
3. Eagle import uses `POST /api/v2/item/add` with `base64: data:<mime>;base64,...`.
4. anime-pictures detail parsing prefers direct `images.anime-pictures.net` original candidates over `api.anime-pictures.net/pictures/download_image/...` endpoints.
```

这样避免 Eagle 进程直接访问 anime-pictures image URL 时遇到 HTTP 403，也避免优先使用容易 403 的 API download endpoint。URL import 只保留为未来高级模式，不作为 anime-pictures 默认路径。

## Dedupe

默认 stable key：

```text
eagle-looms:v2:{source-post-url}|{origin-url}|{sub-item-key}
```

默认 duplicate behavior：

```text
query Eagle by stable key, source URL, origin URL
skip known imports
never update existing items silently
```

## Run Summary

每次导入完成后在 Comic Looms message box 中显示：

```text
Eagle import: planned N, imported N, skipped N, failed N, folders Eagle Looms/..., first failures 001.jpg: ...
```
