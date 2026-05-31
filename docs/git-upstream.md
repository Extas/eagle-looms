# Git and Upstream

Status: active local workflow  
Last updated: 2026-05-31

## Remotes

```text
upstream  https://github.com/MapoMagpie/comic-looms.git
origin    not configured yet
```

`upstream` is Comic Looms and should be treated as read-only. `origin` should point to the Eagle Looms repository only after that repository exists.

Current upstream anchor:

```text
upstream/master  8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f
```

## Branch Model

```text
main              Eagle Looms development branch
upstream/master   Comic Looms source of truth
upstream/gm_api   Comic Looms upstream branch, fetch-only unless needed
```

Do not merge `upstream/master` wholesale into `main`. Eagle Looms is a userscript fork with an Eagle save target, so upstream changes should be ported deliberately.

## Upstream Update Workflow

```powershell
git fetch upstream --tags
git log --oneline 8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f..upstream/master
git diff 8ce7f98fc2539d8e2a6ba2199b60ea03c6d0ad1f..upstream/master -- src package.json vite.config.ts tsconfig.json
```

Then:

1. Review changes in copied Comic Looms areas: `src/platform/`, `src/download/`, `src/ui/`, `src/utils/`, `src/page-fetcher.ts`, `src/img-fetcher.ts`, `src/fetcher-queue.ts`, `src/idle-loader.ts`, `src/config.ts`, `src/main.ts`.
2. Port only the changes that preserve the Eagle Looms boundary.
3. Keep Eagle-specific logic in `src/eagle/` or small adapter points.
4. Run `npm run verify:local`.
5. Update the upstream anchor in this file and `docs/reuse-strategy.md` after the port is complete.

## Local Release Workflow

```powershell
npm run verify:local
npm run build
```

`dist/` is ignored by Git. Treat it as generated release output unless a release process explicitly says otherwise.

