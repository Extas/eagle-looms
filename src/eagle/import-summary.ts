export type EagleImportSummaryStats = {
  planned: number;
  imported: number;
  skipped: number;
  sessionSkipped?: number;
  failed: number;
  folders?: string[];
  failures?: string[];
};

export type EagleImportPlan = {
  folderTemplate: string;
  sourceTagLimit: number;
  skipDuplicates: boolean;
};

const MAX_SUMMARY_FOLDERS = 3;
const MAX_SUMMARY_FAILURES = 3;

export function eagleSummary(stats: EagleImportSummaryStats): string {
  const parts = [
    `planned ${stats.planned}`,
    `imported ${stats.imported}`,
    `skipped ${stats.skipped}${stats.sessionSkipped ? ` (session ${stats.sessionSkipped})` : ""}`,
    `failed ${stats.failed}`,
  ];
  const folders = unique(stats.folders || []).slice(0, MAX_SUMMARY_FOLDERS);
  if (folders.length) {
    const more = unique(stats.folders || []).length - folders.length;
    parts.push(`folders ${folders.join(" | ")}${more > 0 ? ` (+${more})` : ""}`);
  }
  const failures = unique(stats.failures || []).slice(0, MAX_SUMMARY_FAILURES);
  if (failures.length) {
    const more = unique(stats.failures || []).length - failures.length;
    parts.push(`first failures ${failures.join(" | ")}${more > 0 ? ` (+${more})` : ""}`);
  }
  return `Eagle import: ${parts.join(", ")}.`;
}

export function eaglePlanSummary(plan: EagleImportPlan): string {
  return [
    `Eagle import target ${plan.folderTemplate}`,
    `source tags ${plan.sourceTagLimit}`,
    `duplicates ${plan.skipDuplicates ? "skip" : "add"}`,
  ].join(", ") + ".";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
