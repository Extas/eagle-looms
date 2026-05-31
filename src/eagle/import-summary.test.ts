import { describe, expect, it } from 'vitest';
import { eaglePlanSummary, eagleSummary } from './import-summary';

describe('Eagle import summary', () => {
  it('includes counts, destination folders, and bounded failure details', () => {
    expect(eagleSummary({
      planned: 5,
      imported: 2,
      skipped: 1,
      sessionSkipped: 1,
      failed: 2,
      folders: ['Eagle Looms/site/a', 'Eagle Looms/site/a', 'Eagle Looms/site/b'],
      failures: ['001.jpg: 403 Forbidden', '002.jpg: timeout', '002.jpg: timeout', '003.jpg: invalid'],
    })).toBe('Eagle import: planned 5, imported 2, skipped 1 (session 1), failed 2, folders Eagle Looms/site/a | Eagle Looms/site/b, first failures 001.jpg: 403 Forbidden | 002.jpg: timeout | 003.jpg: invalid.');
  });

  it('summarizes visible import settings before writing', () => {
    expect(eaglePlanSummary({
      folderTemplate: 'Eagle Looms/{site}/{copyright}/{author}',
      sourceTagLimit: 20,
      skipDuplicates: true,
    })).toBe('Eagle import target Eagle Looms/{site}/{copyright}/{author}, source tags 20, duplicates skip.');
  });
});
