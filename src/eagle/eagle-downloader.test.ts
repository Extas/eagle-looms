import { describe, expect, it, vi } from 'vitest';
import { defaultConf } from '../config';
import { ADAPTER } from '../platform/adapt';
import { i18n } from '../utils/i18n';
import { clearSessionImportedAssets, duplicateQueries, hasPlannedAssetKey, isDuplicateItem, isSessionImported, markPlannedAssetKey, markSessionImported, stableKeyForAsset } from './duplicates';
import { EagleDownloader, eagleImportEndStage, eagleImportErrorMessage } from './eagle-downloader';
import { EAGLE_IMPORT_DONE_STAGE, isReadyForEagleImport } from './import-readiness';
import { EAGLE_RAW_RECORD_SCHEMA, type EagleRawRecord } from './raw-record';

const eagleProbeMock = vi.hoisted(() => vi.fn());

vi.mock("$", () => ({
  GM: { xmlHttpRequest: vi.fn() },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

vi.mock("./eagle-web-api", () => ({
  EagleWebApi: class EagleWebApi {
    readonly baseUrl: string;

    constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
    }

    probe = eagleProbeMock;
  },
}));

const asset = {
  sourceUrl: 'https://anime-pictures.net/posts/917184',
  originUrl: 'https://images.anime-pictures.net/pictures/917184.jpg',
};

describe('Eagle downloader duplicate checks', () => {
  it('uses simple exact queries instead of relying on Eagle search OR syntax', () => {
    expect(duplicateQueries(asset)).toEqual([
      '"eagle-looms:v2:https://anime-pictures.net/posts/917184|https://images.anime-pictures.net/pictures/917184.jpg|"',
      '"eagle-looms:https://anime-pictures.net/posts/917184"',
      '"https://anime-pictures.net/posts/917184"',
      '"https://images.anime-pictures.net/pictures/917184.jpg"',
    ]);
    expect(duplicateQueries({ ...asset, itemKey: 'frame-002.png' })).toEqual([
      '"eagle-looms:v2:https://anime-pictures.net/posts/917184|https://images.anime-pictures.net/pictures/917184.jpg|frame-002.png"',
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

    expect(isDuplicateItem({ website: asset.sourceUrl }, asset)).toBe(true);
    expect(isDuplicateItem({ url: asset.originUrl }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation: JSON.stringify({ sourceUrl: asset.sourceUrl, originUrl: asset.originUrl, stableKey: stableKeyForAsset(asset) }) }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation: 'stable eagle-looms:https://anime-pictures.net/posts/917184' }, asset)).toBe(true);
    expect(isDuplicateItem({ website: asset.sourceUrl }, { sourceUrl: asset.sourceUrl })).toBe(true);
    expect(isDuplicateItem({ website: 'https://example.test/other' }, asset)).toBe(false);
  });

  it('does not treat one subitem origin URL match as every sibling subitem duplicate', () => {
    const subitem = { ...asset, itemKey: 'frame-002.png' };
    const siblingAnnotation = JSON.stringify({
      sourceUrl: asset.sourceUrl,
      originUrl: asset.originUrl,
      stableKey: stableKeyForAsset({ ...asset, itemKey: 'frame-001.png' }),
      itemKey: 'frame-001.png',
    });

    expect(isDuplicateItem({ url: asset.originUrl }, subitem)).toBe(false);
    expect(isDuplicateItem({ website: asset.sourceUrl }, subitem)).toBe(false);
    expect(isDuplicateItem({ url: asset.originUrl, name: '917184 - frame-002.png' }, subitem)).toBe(true);
    expect(isDuplicateItem({ url: asset.originUrl, name: '917184 - frame-001.png' }, subitem)).toBe(false);
    expect(isDuplicateItem({ annotation: siblingAnnotation, url: asset.originUrl }, subitem)).toBe(false);
    expect(isDuplicateItem({
      annotation: JSON.stringify({
        sourceUrl: asset.sourceUrl,
        originUrl: asset.originUrl,
        stableKey: stableKeyForAsset(subitem),
        itemKey: subitem.itemKey,
      }),
      url: asset.originUrl,
    }, subitem)).toBe(true);
  });

  it('keeps legacy raw records compatible without treating draft records as duplicates', () => {
    const mismatchedRawRecord = rawRecord(asset, 'eagle-item-1');
    mismatchedRawRecord.identity.stableKey = 'wrong';

    expect(isDuplicateItem({ annotation: legacyRawRecordAnnotation(rawRecord(asset)) }, asset)).toBe(false);
    expect(isDuplicateItem({ annotation: legacyRawRecordAnnotation(rawRecord(asset, 'eagle-item-1')) }, asset)).toBe(true);
    expect(isDuplicateItem({ annotation: legacyRawRecordAnnotation(mismatchedRawRecord) }, asset)).toBe(false);
    expect(isDuplicateItem({ annotation: legacyRawRecordAnnotation(rawRecord(asset, 'eagle-item-1')) }, { ...asset, originUrl: 'https://images.anime-pictures.net/pictures/other.jpg' })).toBe(false);
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

  it('tracks duplicate stable keys inside one import plan before writing', () => {
    const plannedKeys = new Set<string>();
    const first = eagleAsset('first.jpg');
    const second = eagleAsset('second.jpg');

    expect(hasPlannedAssetKey(first, plannedKeys)).toBe(false);
    markPlannedAssetKey(first, plannedKeys);
    expect(hasPlannedAssetKey(first, plannedKeys)).toBe(true);
    expect(hasPlannedAssetKey(second, plannedKeys)).toBe(true);
    expect(hasPlannedAssetKey({ ...second, originUrl: 'https://images.anime-pictures.net/pictures/other.jpg' }, plannedKeys)).toBe(false);
  });

  it('imports only fetched images that match the upstream DONE-and-data contract', () => {
    const data = new Uint8Array([1]);

    expect(isReadyForEagleImport({ stage: EAGLE_IMPORT_DONE_STAGE, data })).toBe(true);
    expect(isReadyForEagleImport({ stage: 2, data })).toBe(false);
    expect(isReadyForEagleImport({ stage: 0, data })).toBe(false);
    expect(isReadyForEagleImport({ stage: EAGLE_IMPORT_DONE_STAGE, data: undefined })).toBe(false);
  });

  it('maps import result counts to user-facing end states', () => {
    expect(eagleImportEndStage({ failed: 1, imported: 0 })).toBe('downloadFailed');
    expect(eagleImportEndStage({ failed: 0, imported: 1 })).toBe('downloaded');
    expect(eagleImportEndStage({ failed: 0, imported: 0 })).toBe('importNoNewItems');
  });

  it('turns common Eagle Web API transport failures into actionable messages', () => {
    expect(eagleImportErrorMessage(new Error('Failed to fetch'))).toContain('use Config > Test Eagle');
    expect(eagleImportErrorMessage(new Error('0 network error'))).toContain('Cannot reach Eagle Web API');
    expect(eagleImportErrorMessage(new Error('request timed out'))).toContain('Eagle Web API timed out');
    expect(eagleImportErrorMessage(new Error('403 Forbidden'))).toBe('403 Forbidden');
  });

  it('localizes actionable Eagle Web API transport failures', async () => {
    const originalLanguage = navigator.language;
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'zh-CN' });
    vi.resetModules();

    const { eagleImportErrorMessage: localizedErrorMessage } = await import('./eagle-downloader');

    expect(localizedErrorMessage(new Error('Failed to fetch'))).toContain('无法连接 Eagle Web API');
    expect(localizedErrorMessage(new Error('request timed out'))).toContain('Eagle Web API 超时');

    Object.defineProperty(navigator, 'language', { configurable: true, value: originalLanguage });
    vi.resetModules();
  });

  it('reports no-ready-image imports before connecting to Eagle', async () => {
    const panel = {
      abort: vi.fn(),
      flushUI: vi.fn(),
      showEagleImportResult: vi.fn(),
    };
    const idleLoader = { abort: vi.fn() };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      panel,
      idleLoader,
      selectedChapters: [],
      pageFetcher: { chapters: [] },
      cherryPicks: [],
      downloading: false,
      done: false,
    }) as EagleDownloader;
    ADAPTER.conf = defaultConf();
    eagleProbeMock.mockReset();

    await expect(downloader.download([])).rejects.toThrow('No fetched images are selected');

    expect(eagleProbeMock).not.toHaveBeenCalled();
    expect(panel.showEagleImportResult).toHaveBeenCalledWith(
      expect.arrayContaining([
        'no items imported',
        expect.stringContaining('No fetched images are selected'),
      ]),
      true,
      []
    );
  });

  it('writes a small current-image import without confirmation', async () => {
    const imf = { stage: EAGLE_IMPORT_DONE_STAGE, data: new Uint8Array([1]) };
    const chapter = { title: 'Chapter 1', filteredQueue: [imf] };
    const panel = {
      flushUI: vi.fn(),
      setImportProgress: vi.fn(),
      confirmEagleImportPlan: vi.fn().mockResolvedValue(false),
      showEagleImportResult: vi.fn(),
    };
    const job = {
      asset: eagleAsset('current.jpg'),
      folderPaths: [['Eagle Looms', 'site', 'gallery']],
      folderKeys: ['Eagle Looms/site/gallery'],
      folderKey: 'Eagle Looms/site/gallery',
    };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      panel,
      pageFetcher: { chapters: [chapter] },
      meta: vi.fn().mockReturnValue({}),
      assetsForChapter: vi.fn().mockReturnValue([job.asset]),
      jobForAsset: vi.fn().mockReturnValue(job),
      preflightJobs: vi.fn().mockResolvedValue({ writable: 1, sessionSkipped: 0, duplicateSkipped: 0, failed: 0 }),
      writeJob: vi.fn(),
      abort: vi.fn(),
      downloading: false,
      done: false,
    }) as any as EagleDownloader;
    ADAPTER.conf = defaultConf();
    eagleProbeMock.mockReset();
    eagleProbeMock.mockResolvedValue({});

    await downloader.importOne(0, 0);

    expect(panel.confirmEagleImportPlan).not.toHaveBeenCalled();
    expect(panel.setImportProgress).toHaveBeenCalledWith(i18n.eagleImportCheckingEagle.get());
    expect(panel.setImportProgress).toHaveBeenCalledWith(i18n.eagleImportWritingToEagle.get(), 1, 1);
    expect((downloader as any).writeJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Map),
      job,
      expect.objectContaining({ planned: 1 }),
      expect.any(Set)
    );
  });

  it('shows a result-panel error when current-image import has no image target', async () => {
    const panel = {
      showEagleImportResult: vi.fn(),
    };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      panel,
      pageFetcher: { chapters: [] },
      downloading: false,
    }) as EagleDownloader;
    eagleProbeMock.mockReset();

    await downloader.importOne(0, 0);

    expect(eagleProbeMock).not.toHaveBeenCalled();
    expect(panel.showEagleImportResult).toHaveBeenCalledWith(
      expect.arrayContaining([
        'no items imported',
        expect.stringContaining('No image found for Eagle import.'),
      ]),
      true,
      []
    );
  });
});

function eagleAsset(name: string) {
  return {
    ...asset,
    name,
    data: new Uint8Array([1]),
    contentType: 'image/jpeg',
    tags: [],
    website: asset.sourceUrl,
    folderTokens: { site: 'site', gallery: 'gallery', chapter: '' },
  };
}

function rawRecord(input: typeof asset, assetItemId?: string): EagleRawRecord {
  return {
    identity: {
      stableKey: stableKeyForAsset(input),
      sourceUrl: input.sourceUrl,
      originUrl: input.originUrl,
    },
    ...(assetItemId ? { assetItemId } : {}),
  };
}

function legacyRawRecordAnnotation(record: EagleRawRecord): string {
  return JSON.stringify({ schema: EAGLE_RAW_RECORD_SCHEMA, record });
}
