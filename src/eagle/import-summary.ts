import { i18n } from "../utils/i18n";
import { DEFAULT_EAGLE_CONFIRM_THRESHOLD, normalizeEagleConfirmMode, normalizeEagleConfirmThreshold, type EagleConfirmMode } from "./options";

export type EagleImportSummaryStats = {
  planned: number;
  imported: number;
  skipped: number;
  sessionSkipped?: number;
  duplicateSkipped?: number;
  failed: number;
  folders?: string[];
  skippedItems?: string[];
  failures?: string[];
};

export type EagleImportPlan = {
  folderTemplate: string;
  explicitConfirm?: boolean;
  confirmMode?: EagleConfirmMode;
  confirmThreshold?: number;
  importLimit?: number;
  sourceTagLimit: number;
  skipDuplicates: boolean;
  selected?: number;
  planned?: number;
  omittedByLimit?: number;
  writable?: number;
  sessionSkipped?: number;
  duplicateSkipped?: number;
  preflightFailed?: number;
  folders?: string[];
  itemNameSamples?: string[];
  itemNamePolicy?: string;
  missingFolderTokens?: Record<string, number>;
  fallbackFolderTokens?: Record<string, number>;
  folderTokenSamples?: Record<string, string[]>;
};

const MAX_SUMMARY_FOLDERS = 3;
const MAX_SUMMARY_FAILURES = 3;
const MAX_SUMMARY_SKIPPED_ITEMS = 3;
const MAX_SUMMARY_TOKEN_VALUES = 2;
const MAX_SUMMARY_ITEM_NAMES = 3;
const MAX_COMPACT_FOLDERS = 2;

export function eagleSummary(stats: EagleImportSummaryStats): string {
  return `${i18n.eagleSummaryTitle.get()}: ${eagleSummaryParts(stats).join(", ")}.`;
}

export function eagleToastSummary(stats: EagleImportSummaryStats): string {
  if (stats.failed > 0 && stats.imported === 0 && stats.skipped === 0) {
    return format(i18n.eagleToastFailedOnly.get(), { count: stats.failed });
  }
  const base = stats.imported > 0
    ? format(i18n.eagleToastImported.get(), {
      count: stats.imported,
      item: stats.imported === 1 ? i18n.eagleToastImage.get() : i18n.eagleToastImages.get(),
    })
    : i18n.eagleToastNoNewItems.get();
  const skipped = stats.skipped > 0 ? format(i18n.eagleToastSkippedSuffix.get(), { count: stats.skipped }) : "";
  const failed = stats.failed > 0 ? format(i18n.eagleToastFailedSuffix.get(), { count: stats.failed }) : "";
  return `${base}${skipped}${failed}.`;
}

export function eagleSummaryParts(stats: EagleImportSummaryStats): string[] {
  const skippedReasons = [
    stats.duplicateSkipped ? format(i18n.eagleSummaryReasonDuplicates.get(), { count: stats.duplicateSkipped }) : "",
    stats.sessionSkipped ? format(i18n.eagleSummaryReasonSession.get(), { count: stats.sessionSkipped }) : "",
  ].filter(Boolean);
  const reasons = skippedReasons.length ? ` (${skippedReasons.join(", ")})` : "";
  const parts = [
    importOutcome(stats),
    format(i18n.eagleSummaryPlanned.get(), { count: stats.planned }),
    format(i18n.eagleSummaryImported.get(), { count: stats.imported }),
    format(i18n.eagleSummarySkipped.get(), { count: stats.skipped, reasons }),
    format(i18n.eagleSummaryFailed.get(), { count: stats.failed }),
  ].filter(Boolean);
  const folders = unique(stats.folders || []).slice(0, MAX_SUMMARY_FOLDERS);
  if (folders.length) {
    const more = unique(stats.folders || []).length - folders.length;
    parts.push(format(i18n.eagleSummaryFolders.get(), { value: `${folders.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  }
  const skippedItems = unique(stats.skippedItems || []).slice(0, MAX_SUMMARY_SKIPPED_ITEMS).map(shortNameValue);
  if (skippedItems.length) {
    const more = unique(stats.skippedItems || []).length - skippedItems.length;
    parts.push(format(i18n.eagleSummaryFirstSkipped.get(), { value: `${skippedItems.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  }
  const failures = unique(stats.failures || []).slice(0, MAX_SUMMARY_FAILURES);
  if (failures.length) {
    const more = unique(stats.failures || []).length - failures.length;
    parts.push(format(i18n.eagleSummaryFirstFailures.get(), { value: `${failures.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  }
  return parts;
}

function importOutcome(stats: EagleImportSummaryStats): string {
  if (stats.planned > 0 && stats.imported === 0 && stats.failed === 0 && stats.skipped > 0) return i18n.eagleSummaryNoNewItems.get();
  if (stats.failed > 0 && stats.imported === 0) return i18n.eagleSummaryNoItemsImported.get();
  return "";
}

export function eaglePlanSummary(plan: EagleImportPlan): string {
  return `${i18n.eaglePlanTitle.get()}: ${eaglePlanSummaryParts(plan).join(", ")}.`;
}

export function eaglePlanCompactSummary(plan: EagleImportPlan): string {
  return `${i18n.eaglePlanTitle.get()}: ${eaglePlanCompactParts(plan).join(", ")}.`;
}

export function eaglePlanHeadline(plan: EagleImportPlan): string {
  const writable = plan.writable ?? plan.planned ?? 0;
  const notes = [
    skippedCount(plan) > 0 ? format(i18n.eaglePlanNoteSkippedBeforeWriting.get(), { count: skippedCount(plan) }) : "",
    plan.omittedByLimit ? format(i18n.eaglePlanNoteOverLimit.get(), { count: plan.omittedByLimit }) : "",
    plan.preflightFailed ? format(i18n.eaglePlanNotePreflightFailed.get(), { count: plan.preflightFailed }) : "",
  ].filter(Boolean);
  return format(i18n.eaglePlanHeadline.get(), {
    count: writable,
    item: writable === 1 ? i18n.eaglePlanHeadlineItem.get() : i18n.eaglePlanHeadlineItems.get(),
    notes: notes.length ? ` (${notes.join(", ")})` : "",
  });
}

export function eaglePlanSummaryParts(plan: EagleImportPlan): string[] {
  const parts = [];
  if (plan.selected !== undefined && plan.planned !== undefined && plan.selected !== plan.planned) {
    parts.push(format(i18n.eaglePlanSelected.get(), { count: plan.selected }));
  }
  if (plan.planned !== undefined) parts.push(format(i18n.eagleSummaryPlanned.get(), { count: plan.planned }));
  if (plan.omittedByLimit) {
    parts.push(format(i18n.eaglePlanLimitOmitted.get(), { limit: plan.importLimit ?? plan.planned ?? plan.omittedByLimit, omitted: plan.omittedByLimit }));
  }
  if (plan.writable !== undefined) {
    parts.push(format(i18n.eaglePlanWillWrite.get(), { count: plan.writable }));
  }
  const preflightSkipped = skippedCount(plan);
  if (preflightSkipped > 0) {
    const skippedReasons = [
      plan.duplicateSkipped ? format(i18n.eagleSummaryReasonDuplicates.get(), { count: plan.duplicateSkipped }) : "",
      plan.sessionSkipped ? format(i18n.eagleSummaryReasonSession.get(), { count: plan.sessionSkipped }) : "",
    ].filter(Boolean);
    parts.push(format(i18n.eaglePlanWillSkipBeforeWriting.get(), {
      count: preflightSkipped,
      reasons: skippedReasons.length ? ` (${skippedReasons.join(", ")})` : "",
    }));
  }
  if (plan.preflightFailed) parts.push(format(i18n.eaglePlanPreflightFailed.get(), { count: plan.preflightFailed }));
  const folders = unique(plan.folders || []).slice(0, MAX_SUMMARY_FOLDERS);
  if (folders.length) {
    const more = unique(plan.folders || []).length - folders.length;
    parts.push(format(i18n.eagleSummaryFolders.get(), { value: `${folders.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  } else {
    parts.push(format(i18n.eaglePlanTarget.get(), { value: plan.folderTemplate }));
  }
  if ((plan.writable ?? plan.planned ?? 0) > 0) {
    parts.push(i18n.eaglePlanWritesImageItemsOnly.get());
  }
  const itemNames = unique(plan.itemNameSamples || []).slice(0, MAX_SUMMARY_ITEM_NAMES).map(shortNameValue);
  if (itemNames.length) {
    const more = unique(plan.itemNameSamples || []).length - itemNames.length;
    parts.push(format(i18n.eaglePlanItemNames.get(), { value: `${itemNames.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  }
  if (plan.itemNamePolicy) parts.push(format(i18n.eaglePlanNamePolicy.get(), { value: plan.itemNamePolicy }));
  const missingTokens = Object.entries(plan.missingFolderTokens || {})
    .filter(([, count]) => count > 0)
    .map(([token, count]) => `${token} ${count}`);
  if (missingTokens.length) parts.push(format(i18n.eaglePlanMissingFolderMetadata.get(), { value: missingTokens.join(", ") }));
  const fallbackTokens = Object.entries(plan.fallbackFolderTokens || {})
    .filter(([, count]) => count > 0)
    .map(([token, count]) => `${token} ${count}`);
  if (fallbackTokens.length) parts.push(format(i18n.eaglePlanFolderFallback.get(), {
    value: fallbackTokens.join(", "),
    fallback: plan.fallbackFolderTokens?.copyright ? i18n.eaglePlanCopyrightFallback.get() : "",
  }));
  const tokenSamples = Object.entries(plan.folderTokenSamples || {})
    .map(([token, values]) => tokenSample(token, values))
    .filter(Boolean);
  if (tokenSamples.length) parts.push(format(i18n.eaglePlanFolderMetadata.get(), { value: tokenSamples.join("; ") }));
  parts.push(format(i18n.eaglePlanVisibleTagsMax.get(), { count: plan.sourceTagLimit }));
  parts.push(format(i18n.eaglePlanDuplicates.get(), { policy: plan.skipDuplicates ? i18n.eaglePlanDuplicatesSkipped.get() : i18n.eaglePlanDuplicatesAllowed.get() }));
  return parts;
}

export function eaglePlanCompactParts(plan: EagleImportPlan): string[] {
  const parts = [];
  const writable = plan.writable ?? plan.planned ?? 0;
  parts.push(format(i18n.eaglePlanWillWrite.get(), { count: writable }));
  const folders = unique(plan.folders || []).slice(0, MAX_COMPACT_FOLDERS);
  if (folders.length) {
    const more = unique(plan.folders || []).length - folders.length;
    parts.push(format(i18n.eaglePlanDestination.get(), { value: `${folders.join(" | ")}${more > 0 ? ` (+${more})` : ""}` }));
  } else {
    parts.push(format(i18n.eaglePlanDestination.get(), { value: plan.folderTemplate }));
  }
  const preflightSkipped = skippedCount(plan);
  if (preflightSkipped > 0) {
    const skippedReasons = [
      plan.duplicateSkipped ? format(i18n.eagleSummaryReasonDuplicates.get(), { count: plan.duplicateSkipped }) : "",
      plan.sessionSkipped ? format(i18n.eagleSummaryReasonSession.get(), { count: plan.sessionSkipped }) : "",
    ].filter(Boolean);
    parts.push(format(i18n.eaglePlanSkippedBeforeWriting.get(), {
      count: preflightSkipped,
      reasons: skippedReasons.length ? ` (${skippedReasons.join(", ")})` : "",
    }));
  }
  return parts;
}

export function shouldConfirmImportPlan(plan: EagleImportPlan): boolean {
  const writable = plan.writable ?? plan.planned ?? 0;
  if (writable <= 0) return false;
  if ((plan.preflightFailed || 0) > 0) return true;
  if ((plan.omittedByLimit || 0) > 0) return true;
  const mode = normalizeEagleConfirmMode(plan.confirmMode);
  if (plan.explicitConfirm) return true;
  if (mode === "always") return true;
  if (mode === "never") return false;
  return writable > normalizeEagleConfirmThreshold(plan.confirmThreshold ?? DEFAULT_EAGLE_CONFIRM_THRESHOLD);
}

function skippedCount(plan: Pick<EagleImportPlan, "sessionSkipped" | "duplicateSkipped">): number {
  return (plan.sessionSkipped || 0) + (plan.duplicateSkipped || 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function tokenSample(token: string, values: string[]): string {
  const samples = unique(values).slice(0, MAX_SUMMARY_TOKEN_VALUES).map(shortValue);
  if (samples.length === 0) return "";
  const more = unique(values).length - samples.length;
  return `${token} ${samples.join(" | ")}${more > 0 ? ` (+${more})` : ""}`;
}

function shortValue(value: string): string {
  return value.length > 40 ? `${value.slice(0, 37).trimEnd()}...` : value;
}

function shortNameValue(value: string): string {
  return value.length > 96 ? `${value.slice(0, 93).trimEnd()}...` : value;
}

function format(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}
