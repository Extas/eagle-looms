# Eagle Organization Policy

Status: active planning target
Last updated: 2026-05-31

## Principle

Folders 回答“这批资产来自哪里”。Tags 回答“这个资产是什么、之后怎么找”。Eagle `website`/`url` 保留来源；annotation 只在必要时保留紧凑 duplicate key。

不要把每个 source site tag 都编码进 folder path。Folder explosion 会让 Eagle 难以浏览；高基数 metadata 应由 tags 和 annotation 承担。

## Recommended Folder Tree

默认 root：

```text
Eagle Looms/
```

1.0 默认目录模板：

```text
Eagle Looms/{site}/{gallery}
```

支持用户在 Config panel 中改为：

```text
Eagle Looms/
  {site}/
    {gallery}/
      {chapter}/
```

示例：

```text
Eagle Looms/pixiv.net/{artist-name}/{work-id - title}/
Eagle Looms/x.com/{handle}/{yyyy-mm-dd - post-id}/
Eagle Looms/mangacopy.com/{comic-title}/{chapter-title}/
```

Rules：

```text
sanitize folder names for filesystem-like safety
shrink long names while preserving ID/title signal
deduplicate sibling folder names
store exact original URL in Eagle `url` and keep annotation empty unless an item needs a compact duplicate key
```

## Tags

使用紧凑、可预测的 tags。机器来源的 tags 使用 prefix，避免和用户手动 tags 混在一起。

必备 tags：

```text
eagle-looms
site:{site}
gallery:{gallery-title}
chapter:{chapter-title}
ext:{extension}
mime:{content-type}
```

Source metadata tags：

```text
copyright:{work-or-series}
character:{name}
author:{creator}
```

这些命名空间全局统一：

```text
game copyright / copyright -> copyright:{name}
character                  -> character:{name}
author / artist            -> author:{name}
```

其他来源 tags 同样导入，但不强行套命名空间。为了避免高流量站点把 Eagle tag 池打爆，仍受 source tag limit 控制：

```text
configurable max source tags per item: 20 by default, clamped to 0..100
0 keeps only required Eagle Looms tags
namespaced copyright/character/author tags and raw source tags share the same cap
drop tags beyond the cap instead of forcing them into annotation
```

## Tag Groups

Managed tag groups 是可选项。启用时只维护宽泛分组：

```text
Eagle Looms
  eagle-looms

Source Site
  site:pixiv.net
  site:x.com
  site:artstation.com

Source Metadata
  copyright:*
  character:*
  author:*
```

不要为每个 gallery 或 creator 创建一个 tag group。

## Item Names

默认命名：

```text
{source-title-or-original-filename}
```

Multi-chapter import：

```text
{chapter-title} - {source-title-or-original-filename}
```

名称表示资产身份，不承担 zip 排序职责；不要添加 `001_` 这类 Comic Looms 打包序号。同名冲突时追加 `_1`、`_2`。冗长标题不强制写入 annotation，避免详情面板噪音。

## Annotation

普通 imported item 默认不写长 annotation。需要区分多文件子项或保留多个作者 URL 时，annotation 只保留紧凑 JSON：

````text
{"schema":"eagle-looms/item/v1","stableKey":"...","sourceUrl":"...","originUrl":"...","itemKey":"...","authorUrls":["..."]}
````

Eagle 原生字段和 tags 先承担可见信息；annotation 只用于必要的 duplicate checks 和后续 migrations。

## Gallery Bookmark Item

对 gallery import，可选创建一个 `bookmarkURL` item：

```text
name: {gallery title}
bookmarkURL: gallery URL
tags: looms:gallery, looms:site:{site}
folders: gallery folder
annotation: import summary, item count, chapter list
```

这样即使单张图片 URL 过期，Eagle 中也仍有一个可见 source anchor。

## Duplicate Policy

默认：

```text
skip items already imported by stableKey
skip exact source URL matches when URL is reliable
warn on hash matches from a different URL
never merge or update existing items silently
```

显式用户选项：

```text
Skip duplicates
Add anyway
Update tags/annotation only
```

最后一个选项等 basic additive import path 稳定后再做。
