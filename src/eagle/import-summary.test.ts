import { describe, expect, it, vi } from 'vitest';
import { eaglePlanCompactParts, eaglePlanCompactSummary, eaglePlanHeadline, eaglePlanSummary, eaglePlanSummaryParts, eagleSummary, eagleSummaryParts, eagleToastSummary, shouldConfirmImportPlan } from './import-summary';

describe('Eagle import summary', () => {
  it('includes counts, destination folders, and bounded failure details', () => {
    const stats = {
      planned: 5,
      imported: 2,
      skipped: 2,
      duplicateSkipped: 1,
      sessionSkipped: 1,
      failed: 2,
      folders: ['Eagle Looms/site/a', 'Eagle Looms/site/a', 'Eagle Looms/site/b'],
      skippedItems: ['duplicate: 2025-07-08 anime-pictures-908175.png', 'session: 2025-07-08 anime-pictures-908176.png'],
      failures: ['001.jpg: 403 Forbidden', '002.jpg: timeout', '002.jpg: timeout', '003.jpg: invalid'],
    };
    expect(eagleSummary(stats)).toBe('Eagle import: planned 5, imported 2, skipped 2 (duplicates 1, session 1), failed 2, folders Eagle Looms/site/a | Eagle Looms/site/b, first skipped duplicate: 2025-07-08 anime-pictures-908175.png | session: 2025-07-08 anime-pictures-908176.png, first failures 001.jpg: 403 Forbidden | 002.jpg: timeout | 003.jpg: invalid.');
    expect(eagleSummaryParts(stats)).toEqual([
      'planned 5',
      'imported 2',
      'skipped 2 (duplicates 1, session 1)',
      'failed 2',
      'folders Eagle Looms/site/a | Eagle Looms/site/b',
      'first skipped duplicate: 2025-07-08 anime-pictures-908175.png | session: 2025-07-08 anime-pictures-908176.png',
      'first failures 001.jpg: 403 Forbidden | 002.jpg: timeout | 003.jpg: invalid',
    ]);
  });

  it('calls out imports that write nothing because everything was skipped', () => {
    expect(eagleSummaryParts({
      planned: 2,
      imported: 0,
      skipped: 2,
      duplicateSkipped: 2,
      failed: 0,
      skippedItems: ['duplicate: a.png', 'duplicate: b.png'],
    })).toEqual([
      'no new items',
      'planned 2',
      'imported 0',
      'skipped 2 (duplicates 2)',
      'failed 0',
      'first skipped duplicate: a.png | duplicate: b.png',
    ]);
  });

  it('makes early import failures visible even before any item is planned', () => {
    expect(eagleSummaryParts({
      planned: 0,
      imported: 0,
      skipped: 0,
      failed: 1,
      failures: ['Eagle import: Cannot reach Eagle Web API'],
    })).toEqual([
      'no items imported',
      'planned 0',
      'imported 0',
      'skipped 0',
      'failed 1',
      'first failures Eagle import: Cannot reach Eagle Web API',
    ]);
  });

  it('keeps toast summaries short and leaves details for the result panel', () => {
    expect(eagleToastSummary({
      planned: 2,
      imported: 2,
      skipped: 0,
      failed: 0,
      folders: ['Eagle Looms/site/a'],
      skippedItems: ['duplicate: a.png'],
    })).toBe('Imported 2 images to Eagle.');
    expect(eagleToastSummary({
      planned: 3,
      imported: 2,
      skipped: 1,
      failed: 0,
    })).toBe('Imported 2 images to Eagle, skipped 1.');
    expect(eagleToastSummary({
      planned: 3,
      imported: 2,
      skipped: 0,
      failed: 1,
      failures: ['a.png: timeout'],
    })).toBe('Imported 2 images to Eagle, failed 1. See import result.');
    expect(eagleToastSummary({
      planned: 1,
      imported: 0,
      skipped: 0,
      failed: 1,
    })).toBe('Failed 1. See import result.');
  });

  it('summarizes visible import settings before writing', () => {
    const plan = {
      folderTemplate: 'Eagle Looms/{site}/{copyright}/{author}',
      importLimit: 2,
      sourceTagLimit: 20,
      skipDuplicates: true,
      selected: 3,
      planned: 2,
      omittedByLimit: 1,
      writable: 1,
      duplicateSkipped: 1,
      folders: ['Eagle Looms/site/a', 'Eagle Looms/site/a'],
      itemNameSamples: ['2025-07-08 anime-pictures-908175.png', '2025-07-09 anime-pictures-908176.png'],
      itemNamePolicy: 'date prefix when source date exists',
      missingFolderTokens: { copyright: 1, author: 2 },
      folderTokenSamples: { copyright: ['bang dream'], author: ['soha blan', 'soha blan', 'very long artist name that should be shortened in summaries'] },
    };
    expect(eaglePlanSummary(plan)).toBe('Eagle import plan: selected 3, planned 2, limit 2, omitted 1, will write 1, will skip before writing 1 (duplicates 1), folders Eagle Looms/site/a, writes image items only, item names 2025-07-08 anime-pictures-908175.png | 2025-07-09 anime-pictures-908176.png, name policy date prefix when source date exists, missing folder metadata copyright 1, author 2, folder metadata copyright bang dream; author soha blan | very long artist name that should be..., visible tags max 20, duplicates skipped.');
    expect(eaglePlanSummaryParts(plan)).toEqual([
      'selected 3',
      'planned 2',
      'limit 2, omitted 1',
      'will write 1',
      'will skip before writing 1 (duplicates 1)',
      'folders Eagle Looms/site/a',
      'writes image items only',
      'item names 2025-07-08 anime-pictures-908175.png | 2025-07-09 anime-pictures-908176.png',
      'name policy date prefix when source date exists',
      'missing folder metadata copyright 1, author 2',
      'folder metadata copyright bang dream; author soha blan | very long artist name that should be...',
      'visible tags max 20',
      'duplicates skipped',
    ]);
    expect(eaglePlanHeadline(plan)).toBe('Write 1 new item to Eagle (1 skipped before writing, 1 over limit omitted)?');
    expect(eaglePlanCompactSummary(plan)).toBe('Eagle import plan: will write 1, destination Eagle Looms/site/a, skipped before writing 1 (duplicates 1).');
    expect(eaglePlanCompactParts(plan)).toEqual([
      'will write 1',
      'destination Eagle Looms/site/a',
      'skipped before writing 1 (duplicates 1)',
    ]);
  });

  it('keeps the confirmation summary compact with at most two destination folders', () => {
    expect(eaglePlanCompactParts({
      folderTemplate: 'Eagle Looms/{site}/{copyright}',
      sourceTagLimit: 20,
      skipDuplicates: true,
      planned: 6,
      writable: 6,
      duplicateSkipped: 1,
      folders: ['Eagle Looms/site/a', 'Eagle Looms/site/b', 'Eagle Looms/site/c'],
    })).toEqual([
      'will write 6',
      'destination Eagle Looms/site/a | Eagle Looms/site/b (+1)',
      'skipped before writing 1 (duplicates 1)',
    ]);
  });

  it('confirms only risky or larger import plans by default', () => {
    const basePlan = {
      folderTemplate: 'Eagle Looms/{site}/{copyright}',
      sourceTagLimit: 20,
      skipDuplicates: true,
      planned: 1,
      writable: 1,
    };

    expect(shouldConfirmImportPlan({ ...basePlan, writable: 1 })).toBe(false);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 3 })).toBe(false);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 4 })).toBe(true);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 4, confirmThreshold: 5 })).toBe(false);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 1, confirmMode: 'always' })).toBe(true);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 4, confirmMode: 'never' })).toBe(false);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 3, omittedByLimit: 1 })).toBe(true);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 3, preflightFailed: 1 })).toBe(true);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 1, confirmMode: 'never', preflightFailed: 1 })).toBe(true);
    expect(shouldConfirmImportPlan({ ...basePlan, planned: 3, writable: 0, duplicateSkipped: 3 })).toBe(false);
    expect(shouldConfirmImportPlan({ ...basePlan, writable: 1, explicitConfirm: true })).toBe(true);
  });

  it('distinguishes default folder fallback from missing custom folder metadata', () => {
    expect(eaglePlanSummary({
      folderTemplate: 'Eagle Looms/{site}/{copyright}',
      sourceTagLimit: 20,
      skipDuplicates: true,
      planned: 2,
      writable: 2,
      folders: ['Eagle Looms/pixiv.net/artist 42'],
      fallbackFolderTokens: { copyright: 1 },
    })).toBe('Eagle import plan: planned 2, will write 2, folders Eagle Looms/pixiv.net/artist 42, writes image items only, folder fallback copyright 1 (gallery/author/chapter/Unsorted), visible tags max 20, duplicates skipped.');
  });

  it('does not promise writes when the preflight will skip every item', () => {
    expect(eaglePlanSummaryParts({
      folderTemplate: 'Eagle Looms/{site}/{copyright}',
      sourceTagLimit: 20,
      skipDuplicates: true,
      planned: 2,
      writable: 0,
      duplicateSkipped: 2,
      folders: ['Eagle Looms/site/a'],
    })).not.toContain('writes image items only');
  });

  it('localizes the import plan summary through the shared i18n table', async () => {
    const originalLanguage = navigator.language;
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'zh-CN' });
    vi.resetModules();

    const { eaglePlanSummaryParts: localizedParts } = await import('./import-summary');

    expect(localizedParts({
      folderTemplate: 'Eagle Looms/{site}/{copyright}',
      sourceTagLimit: 20,
      skipDuplicates: true,
      planned: 1,
      writable: 1,
      folders: ['Eagle Looms/site/a'],
    })).toEqual([
      '计划 1',
      '将写入 1',
      '文件夹 Eagle Looms/site/a',
      '只写入图片项目',
      '可见标签最多 20',
      '重复项 跳过',
    ]);

    Object.defineProperty(navigator, 'language', { configurable: true, value: originalLanguage });
    vi.resetModules();
  });
});
