import { describe, expect, it } from 'vitest';
import { clearSessionImportedAssets, duplicateQueries, isDuplicateItem, isSessionImported, markSessionImported, stableKeyForAsset } from './duplicates';
import { EAGLE_IMPORT_DONE_STAGE, isReadyForEagleImport } from './import-readiness';

describe('Eagle downloader duplicate checks', () => {
  const asset = {
    sourceUrl: 'https://anime-pictures.net/posts/917184',
    originUrl: 'https://images.anime-pictures.net/pictures/917184.jpg',
  };

  it('uses simple exact queries instead of relying on Eagle search OR syntax', () => {
    expect(duplicateQueries(asset)).toEqual([
      '"eagle-looms:v2:https://anime-pictures.net/posts/917184|https://images.anime-pictures.net/pictures/917184.jpg|"',
      '"eagle-looms:https://anime-pictures.net/posts/917184"',
      '"https://anime-pictures.net/posts/917184"',
      '"https://images.anime-pictures.net/pictures/917184.jpg"',
    ]);
  });

  it('matches existing Eagle items by precise URL or annotation identity', () => {
    const annotation = [
      'Imported by Eagle Looms',
      '```eagle-looms-json',
      JSON.stringify({ sourceUrl: asset.sourceUrl, originUrl: asset.originUrl, stableKey: stableKeyForAsset(asset) }),
      '```',
    ].join('\n');

    expect(isDuplicateItem({ website: asset.sourceUrl }, asset)).toBe(false);
    expect(isDuplicateItem({ url: asset.originUrl }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation: JSON.stringify({ sourceUrl: asset.sourceUrl, originUrl: asset.originUrl, stableKey: stableKeyForAsset(asset) }) }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation: 'stable eagle-looms:https://anime-pictures.net/posts/917184' }, asset)).toBe(true);
    expect(isDuplicateItem({ website: asset.sourceUrl }, { sourceUrl: asset.sourceUrl })).toBe(true);
    expect(isDuplicateItem({ website: 'https://example.test/other' }, asset)).toBe(false);
  });

  it('tracks assets already imported during the current userscript session', () => {
    clearSessionImportedAssets();

    expect(isSessionImported(asset)).toBe(false);
    markSessionImported(asset);
    expect(isSessionImported(asset)).toBe(true);
    expect(isSessionImported({ sourceUrl: 'https://anime-pictures.net/posts/other' })).toBe(false);
    expect(isSessionImported({ ...asset, originUrl: 'https://images.anime-pictures.net/pictures/other.jpg' })).toBe(false);
    expect(isSessionImported({ ...asset, itemKey: 'frame-2.jpg' })).toBe(false);

    clearSessionImportedAssets();
  });

  it('imports only fetched images that match the upstream DONE-and-data contract', () => {
    const data = new Uint8Array([1]);

    expect(isReadyForEagleImport({ stage: EAGLE_IMPORT_DONE_STAGE, data })).toBe(true);
    expect(isReadyForEagleImport({ stage: 2, data })).toBe(false);
    expect(isReadyForEagleImport({ stage: 0, data })).toBe(false);
    expect(isReadyForEagleImport({ stage: EAGLE_IMPORT_DONE_STAGE, data: undefined })).toBe(false);
  });
});
