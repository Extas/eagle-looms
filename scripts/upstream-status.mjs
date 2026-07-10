import { execFileSync } from "node:child_process";

const upstreamRef = "upstream/master";
const requireCurrent = process.argv.includes("--require-current");

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

try {
  git("rev-parse", "--verify", upstreamRef);
  const base = git("merge-base", "HEAD", upstreamRef);
  const [upstreamOnly, downstreamOnly] = git("rev-list", "--left-right", "--count", `${upstreamRef}...HEAD`)
    .split(/\s+/)
    .map(Number);
  const commits = git("log", "--format=%h %s", `${base}..${upstreamRef}`);
  const files = git(
    "diff",
    "--name-only",
    `${base}..${upstreamRef}`,
    "--",
    "src",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "tsconfig.json",
  );

  console.log(`Integrated upstream base: ${base}`);
  console.log(`Pending upstream commits: ${upstreamOnly}`);
  console.log(`Downstream commits since divergence: ${downstreamOnly}`);
  if (commits) console.log(`\nPending commits:\n${commits}`);
  if (files) console.log(`\nAffected maintained files:\n${files}`);

  if (requireCurrent && upstreamOnly > 0) process.exitCode = 1;
} catch (error) {
  console.error("Cannot inspect Comic Looms upstream. Confirm the read-only upstream remote exists and shares history with this branch.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
