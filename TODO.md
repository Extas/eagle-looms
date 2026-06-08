---

## Goal 1：小批量导入自动跳过确认

**目标**
少量图片导入不弹“导入前确认”。默认策略：

```text
如果 will-write <= 3
且 preflightFailed = 0
且 omittedByLimit = 0
且不是用户显式要求确认
则直接写入 Eagle。
```

当前代码在 `EagleDownloader.download()` 和 `EagleDownloader.importOne()` 中，只要 `preflight.writable > 0` 就调用 `confirmEagleImportPlan(...)`，因此即使 1 张图也会弹确认。需要改成智能确认。

**建议修改点**

* `src/eagle/eagle-downloader.ts`

  * 抽出 `shouldConfirmImportPlan(plan)`。
  * 在 bulk import 和 importOne 两处复用。
* `src/eagle/import-summary.ts`

  * 可增加轻量判断辅助函数，或保持在 downloader 内。

**建议伪代码**

```ts
const DEFAULT_CONFIRM_THRESHOLD = 3;

function shouldConfirmImportPlan(plan: EagleImportPlan): boolean {
  const writable = plan.writable ?? plan.planned ?? 0;
  if (writable <= 0) return false;
  if (plan.preflightFailed && plan.preflightFailed > 0) return true;
  if (plan.omittedByLimit && plan.omittedByLimit > 0) return true;
  return writable > DEFAULT_CONFIRM_THRESHOLD;
}
```

**验收标准**

```text
1 张图：preflight 成功后直接写入，不弹确认。
3 张图：直接写入。
4 张图：弹确认。
超过 import limit：弹确认。
preflight 有失败：弹确认。
全是 duplicate / session skip 且 will-write = 0：不弹确认，直接显示 No new items。
```

---

## Goal 2：导入前确认内容改为“三行摘要 + 可展开详情”

**目标**
保留审计能力，但默认不要把所有计划信息平铺出来。确认弹窗默认只显示：

```text
Will write: N images
Destination: first 1–2 folders
Skipped before writing: N, if any
```

详细信息折叠到 `<details>` 或“Show details / 显示详情”区域。

现在 `eaglePlanSummaryParts(plan)` 会把 selected、planned、limit、will-write、will-skip、folders、item names、name policy、missing metadata、fallback、metadata samples、tag cap、duplicate policy 全部平铺。信息完整，但作为确认弹窗过载。

**建议修改点**

* `src/eagle/import-summary.ts`

  * 新增 `eaglePlanCompactParts(plan)`。
  * 保留 `eaglePlanSummaryParts(plan)` 作为 details。
* `src/ui/downloader-panel.ts` 或确认弹窗相关实现

  * `confirmEagleImportPlan(compactParts, headline, detailsParts?)`。
  * 详情默认折叠。
* `src/eagle/eagle-downloader.ts`

  * 调用确认时传 compact + details。

**建议输出结构**

```text
Headline:
Write 6 images to Eagle?

Compact:
- Will write: 6
- Destination: Eagle Looms/anime-pictures.net/bang dream (+2)
- Skipped before writing: 1 duplicate

Details:
- Selected: 12
- Planned: 10
- Omitted by limit: 2
- Visible tags max: 20
- Duplicates skipped
- Item name samples...
- Folder metadata...
```

**验收标准**

```text
确认弹窗首屏不超过 3–4 行核心摘要。
长计划不会把 Write / Cancel 按钮挤出视野。
Copy plan 仍复制完整 details，而不是只复制 compact。
toast 可以继续用 compact summary，不再使用完整长 summary。
```

---

## Goal 3：新增确认策略配置项

**目标**
给用户一个清晰配置，而不是硬编码所有行为。建议新增：

```ts
eagleConfirmMode: "auto" | "always" | "never"
eagleConfirmThreshold: number
```

默认：

```ts
eagleConfirmMode = "auto"
eagleConfirmThreshold = 3
```

语义：

```text
always: 有 will-write 就确认。
never: 永不确认，除非 preflightFailed > 0 或 omittedByLimit > 0。
auto: will-write > threshold 时确认；小批量跳过。
```

现有 config 已经包含 Eagle API URL、folder preset、folder path、import limit、source tag limit、name date prefix、skip duplicates 等配置。继续在这个区域加入确认策略比较自然。

**建议修改点**

* `src/config.ts`

  * `Config` 类型新增字段。
  * `defaultConf()` 增加默认值。
  * `ConfigNumberType` / `ConfigSelectType` 增加类型。
  * `ConfigItems` 加入配置项。
* `src/eagle/options.ts`

  * 增加 normalize 函数：

    * `normalizeEagleConfirmMode`
    * `normalizeEagleConfirmThreshold`
* `src/utils/i18n.ts`

  * 增加配置文案。
* `docs/eagle-organization.md` 或 `docs/manual-qa.md`

  * 补充确认策略说明。

**验收标准**

```text
默认 auto + 3。
修改配置后刷新页面仍保留。
site config 能覆盖 global config。
manual folder preset 等现有 Eagle config 不受影响。
```

---

## Goal 4：结果反馈轻量化：小批量只 toast，详情留在结果面板

**目标**
小批量导入成功后不要再用长 toast。toast 只显示：

```text
Imported 2 images to Eagle.
```

如果有 skip/fail，则显示：

```text
Imported 2, skipped 1.
Imported 2, failed 1.
```

完整 counts、失败细节、folder links 继续保留在 import result panel。当前代码在写入后同时调用 `panel.showEagleImportResult(...)` 和 `EBUS.emit(... eagleSummary(stats) ...)`，其中 `eagleSummary(stats)` 可能包含 folders、skipped items、failures 等长信息。

**建议修改点**

* `src/eagle/import-summary.ts`

  * 新增 `eagleToastSummary(stats)`。
  * `eagleSummary(stats)` 保持完整，用于 copy/details。
* `src/eagle/eagle-downloader.ts`

  * toast 改用 `eagleToastSummary(stats)`。
  * result panel 仍用 `eagleSummaryParts(stats)`。

**验收标准**

```text
成功小批量 toast 不包含 folders/item samples/metadata。
失败 toast 指向结果面板，例如 “Failed 1. See import result.”
Copy result 仍包含完整 skipped/failure details。
```

---

## Goal 5：Import loaded only / Load missing & import 的按钮状态更清楚

**目标**
当前 checklist 已经要求导入运行时隐藏 loaded-only action，primary action 变成 stop action。 这块继续优化：让用户知道当前是哪个阶段。

按钮状态建议：

```text
Idle:
- Load missing & import
- Import loaded only

Preflight:
- Checking Eagle...
- Stop

Writing:
- Writing to Eagle 2/6...
- Stop

Done:
- Imported / No new items / Failed
```

**建议修改点**

* `src/eagle/eagle-downloader.ts`

  * 在 preflight 前后 emit 明确阶段。
  * 写每个 job 前更新 progress text。
* `src/ui/downloader-panel.ts`

  * 增加可复用状态 setter，例如 `setImportProgress(label, current?, total?)`。
* 不要重命名 Downloader 基类的大结构，只在 Eagle path 上加最小状态桥接。

**验收标准**

```text
preflight 阶段用户能看见 “Checking Eagle...”。
写入阶段显示当前进度。
点击 stop 能关闭 pending confirmation，且不会继续写入。
importOne 和 bulk import 行为一致。
```

---

## Goal 6：补充 UI/UE 回归测试与 QA checklist

**目标**
把上述交互变更固化，避免之后重新变啰嗦。

现有 `docs/manual-qa.md` 已经覆盖确认弹窗、copy plan、keyboard focus、long details scroll、result panel copy 等。 需要新增“小批量免确认”和“compact confirmation”条目。

**建议修改点**

* `docs/manual-qa.md`

  * 加入：

    ```text
    will-write <= threshold uses no confirmation in auto mode
    will-write > threshold shows compact confirmation
    confirmation details are collapsed by default
    Copy plan copies full details
    failures / over-limit still force confirmation
    ```
* 单元测试搜索路径：

  * 如果已有 tests，补 `import-summary` 与 `shouldConfirmImportPlan` 测试。
  * 如果没有对应测试，新增 `src/eagle/import-confirmation.test.ts` 或类似文件。
* `package.json` 已有 `test:unit`，直接纳入现有 gate。

**验收标准**

```text
npm run test:unit 通过。
npm run build 通过。
manual QA 记录覆盖：
- 1 张图直接导入
- 3 张图直接导入
- 4 张图弹 compact confirmation
- preflight failure 强制确认或阻断
- over-limit 强制确认
```

---

## 建议给 Codex 的执行顺序

```text
1. Goal 1：先做 shouldConfirmImportPlan，快速消除最痛点。
2. Goal 4：toast 轻量化，避免免确认后仍然被长反馈打扰。
3. Goal 2：确认弹窗 compact + details。
4. Goal 3：确认策略配置化。
5. Goal 5：阶段状态与进度反馈。
6. Goal 6：测试与 manual QA 更新。
```