# Eagle Looms - Agent Guide

Eagle Looms is an upstream-first Comic Looms fork. Keep the Comic Looms collection/UI pipeline intact and keep Eagle-specific behavior behind the Eagle save target.

## Read First

```text
README.md
docs/architecture.md
docs/eagle-organization.md
docs/manual-qa.md
docs/references.md
```

## Product Boundary

```text
Source site     page content, cookies, original media URLs, visible source metadata
Comic Looms     matchers, lazy page fetching, image queue, full-view UI, selection UX
Eagle Looms     Eagle import target, import planning, folder/tag/name derivation, duplicate skip
Eagle           asset storage, folders, tags, previews, search, library state
```

Do not build a parallel collector, queue, or Eagle-only panel unless the user explicitly asks for that product change. Prefer adapting the existing `Matcher`, `PageFetcher`, `IMGFetcher`, and `Downloader` contracts.

## Architecture Rules

```text
src/eagle/
  Eagle-specific API, import, option, folder, tag, duplicate logic

src/platform/
  site matchers and source metadata extraction; keep Comic Looms matcher contract

src/download/ src/ui/ src/utils/
  upstream-derived runtime; change only when needed for Eagle integration or upstream parity
```

Default import mode is base64 data URL from already-fetched browser-session bytes. Do not switch sites like anime-pictures to Eagle background URL downloads by default; that path is prone to 403.

Visible image item tags should be source semantic tags only. Keep infrastructure data (`site`, `gallery`, `chapter`, extension, MIME, stable key) out of normal tag lists unless it is needed for user search.

Before adding a non-trivial organization rule or parser, check upstream docs, official APIs, and community practice. Summarize the rule in `docs/eagle-organization.md` or `docs/references.md` if it affects product behavior.

Control complexity:

```text
do not introduce a framework for one site or one rule
do not add abstraction before there are real repeated call sites
prefer existing project dependencies and browser/platform APIs
for common utilities, search for a focused maintained dependency before writing custom code
keep custom helpers narrow, project-specific, and tested
```

## Eagle Write Policy

Writes must be additive by default:

```text
may create folders
may add new image items
must not add Eagle Looms bookmark/raw-record items such as _eagle-looms/Data
must not delete, trash, move, rename, retag, or overwrite existing user items silently
```

Do not create extra Eagle assets for internal bookkeeping. Legacy raw-record annotations may be decoded for backward-compatible duplicate checks, but new imports should only create normal image items and the destination folders they need.

Duplicate checks should stay conservative:

```text
exact stableKey/source URL/origin URL/legacy stableKey queries
legacy raw records count only when assetItemId exists and identity matches
same-session and same-plan stable keys skip before folder creation
display names are not duplicate identity
```

## Upstream

Comic Looms upstream remote:

```text
upstream  https://github.com/MapoMagpie/comic-looms.git
anchor    8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f
```

Do not merge upstream wholesale. Fetch and diff deliberately, then port compatible changes while keeping Eagle logic in `src/eagle/` or narrow adapter points.

## Versioning

Automated validation is expensive, so small iterations are versioned and validated on a fixed cadence.

Current version starts at `0.1.1`. For each small feature iteration, increment the last number by one:

```text
0.1.1 -> 0.1.2 -> ... -> 0.1.100
0.1.100 -> 0.2.1
```

Only run the full automated validation gate when the middle version number changes, i.e. once every 100 small iterations (`0.2.1`, `0.3.1`, ...). For ordinary small-version bumps, prefer targeted local checks or manual review unless a risky change requires more.

## Validation

When validation is due by the versioning cadence above or is specifically requested, run the narrowest useful gate first and finish with the appropriate project gate:

```powershell
npm run test:unit
npm run build
npm run verify:local
npm run verify:all
```

`verify:all` writes self-cleaning smoke items to the current Eagle library, so use it when Eagle is running and local write verification matters.

## Conventions

```text
prefer small typed helpers over ad hoc request objects
keep folder creation idempotent
derive visible organization from source metadata before writing
derive folder names from stable semantic source data, not parsed counts, page numbers, or run-state text
cap visible source tags to avoid Eagle tag explosions
respect dirty worktrees and concurrent user changes
preserve Comic Looms MIT license notices when copying upstream code
```
