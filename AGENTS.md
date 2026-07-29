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

src/eagle/adapters/
  Eagle-specific source metadata adapters; keep matcher changes to narrow calls into these files
  Unified source tag namespaces such as author:/copyright:/character: belong here, not in upstream-derived matchers

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

## Ontology-Guided Delivery

Use Ontology as a design and delivery vocabulary, not as a new runtime framework or dependency. Model the user's real import workflow instead of mirroring every source site's DOM or API shape.

Canonical concepts:

```text
Source Context   site, page, gallery, chapter, and collection meaning
Source Asset     one importable media identity plus its source observation
Import Policy    the remembered user choices that govern an import
Import Plan      the derived names, folders, tags, duplicate state, and warnings
Eagle Item       the committed asset and its Eagle identity
```

Canonical relationships and action:

```text
Source Context contains Source Assets
Import Policy transforms Source Assets into an Import Plan
Import to Eagle confirms and commits an Import Plan into Eagle Items
Eagle Items retain links to their source context and destination folders
```

These concepts do not require matching classes or persistence records. Add a type or abstraction only when the implementation needs it at multiple real call sites.

Advance one closed operational loop at a time:

```text
1. Observe   reproduce one concrete user scenario and record the incorrect outcome
2. Model     identify the canonical property, relationship, action, or invariant involved
3. Map       normalize site-specific evidence at the matcher/adapter boundary
4. Act       implement the smallest complete user-visible import behavior
5. Verify    compare the plan with the actual Eagle item, folder, tags, and source fields
```

An iteration is not complete merely because a parser test passes. It should prove the affected user action end to end with the narrowest reliable evidence available. A larger use case may span several commits, but keep working on the same operational loop until its outcome is verified instead of switching sites after a local test turns green. Keep the existing full-validation cadence, but run targeted tests and build checks for every patch.

Do not turn a broad reliability goal into a stream of unrelated micro-hardening changes. At each continuation, choose the highest-impact open loop from observed user evidence. If there is no reported defect, audit one complete path from a real source page through the import plan to the resulting Eagle item, then fix the first material break or stop with recorded evidence that the path is sound.

Prioritize work in this order:

```text
broken or misleading import actions
identity, provenance, duplicate, and additive-write invariants
configuration clarity and plan/result feedback
shared behavior seen at three real call sites
new site coverage and optional refinements
```

Apply the rule of three: one site-specific case may stay local, two similar cases signal a pattern, and the third is the point to consolidate a canonical helper or adapter contract. Protect stable core contracts and extend through `src/eagle/adapters/` or small capability-oriented helpers rather than widening the downloader or creating site inheritance trees.

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
base      git merge-base HEAD upstream/master
```

`main` must keep `upstream/master` in its ancestry. Use `npm run upstream:check` and follow `docs/upstream-workflow.md`; merge upstream deliberately while keeping Eagle logic in `src/eagle/` / `src/eagle/adapters/` and only narrow adapter calls in upstream-derived files.

## Versioning

Automated validation is expensive, so small iterations are versioned and validated on a fixed cadence. `package.json` is the source of truth for the current version.

For each small feature iteration, increment the last number by one:

```text
1.0.1 -> 1.0.2 -> ... -> 1.0.100
1.0.100 -> 1.1.1
```

Only run the full automated validation gate when the middle version number changes, i.e. once every 100 small iterations (`1.1.1`, `1.2.1`, ...). For ordinary small-version bumps, prefer targeted local checks or manual review unless a risky change requires more.

### GitHub Publication

A package version is complete only after its source and installable userscript are published to GitHub. For every version bump:

```text
run the checks required by the validation cadence and build dist/eagle-looms.user.js
commit the version and its complete intended change set
push that commit to the tracked origin branch, normally origin/main
create and push the v{package.json version} tag
publish a GitHub Release named v{package.json version}
attach dist/eagle-looms.user.js and dist/eagle-looms.meta.js to the release
verify the remote branch, tag, release, and required userscript asset before reporting completion
```

Do not leave a bumped version only in the worktree or a local commit, and do not describe a build-only result as published. Documentation-only or agent-guidance changes that do not bump `package.json` still require a normal commit and push, but they do not create another product release.

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
