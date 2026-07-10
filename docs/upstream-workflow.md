# Upstream Workflow

Eagle Looms is maintained as a downstream extension of Comic Looms. The Git history shares ancestry with `upstream/master`; `src/eagle/` is the downstream product layer, while the collector, queue, and UI remain upstream-owned wherever possible.

## Check

```powershell
npm run upstream:check
```

This fetches the read-only upstream remote and reports the integrated merge base, pending commits, and affected maintained files. A weekly GitHub workflow runs the same check and becomes actionable when upstream moves.

## Integrate

```powershell
git switch main
git pull --ff-only
git switch -c upstream-sync/YYYY-MM-DD
npm run upstream:fetch
git merge --no-ff upstream/master
```

Resolve by ownership rather than by choosing one side globally:

```text
src/eagle/                 keep downstream implementation
src/eagle/adapters/        keep downstream metadata adapters
src/platform/, src/ui/     prefer upstream behavior; restore only narrow Eagle hooks
src/download/, queue       prefer upstream contracts; keep EagleDownloader integration points
config, main, vite         combine upstream changes with the smallest Eagle wiring
```

Do not copy the whole upstream tree over the repository and do not maintain a second collector or UI. If an upstream change conflicts with a broad downstream edit, first reduce the downstream edit to a call into `src/eagle/`.

## Verify

```powershell
npm ci
npm run test:unit
npm run build
```

Use `npm run verify:local` when Eagle is running and the integration change touches Web API behavior. After verification, merge the sync branch normally so the new upstream commit remains an ancestor of `main`.
