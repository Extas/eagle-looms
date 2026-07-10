import { describe, expect, it, vi } from 'vitest';
import { defaultConf } from '../config';
import { GalleryMeta } from '../download/gallery-meta';
import { ADAPTER } from '../platform/adapt';
import { i18n } from '../utils/i18n';
import { clearSessionImportedAssets, duplicateQueries, hasPlannedAssetKey, isDuplicateItem, isSessionImported, markPlannedAssetKey, markSessionImported, stableKeyForAsset } from './duplicates';
import { assertEagleLibraryUnchanged, EagleDownloader, eagleFolderTemplateForImport, eagleImportEndStage, eagleImportErrorMessage, eagleImportResultLinks, isPartialImportResult, limitWritableImportJobs, toAddItemInput } from './eagle-downloader';
import { EAGLE_IMPORT_DONE_STAGE, isReadyForEagleImport } from './import-readiness';
import { EAGLE_RAW_RECORD_SCHEMA, type EagleRawRecord } from './raw-record';

const eagleProbeMock = vi.hoisted(() => vi.fn());
const eagleLibraryInfoMock = vi.hoisted(() => vi.fn());

vi.mock("$", () => ({
  GM: { xmlHttpRequest: vi.fn() },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

vi.mock("./eagle-web-api", () => ({
  extractEagleLibraryName: (value: any) => value?.name || value?.data?.name || '',
  extractEagleLibraryPath: (value: any) => value?.path || value?.data?.path || '',
  EagleWebApi: class EagleWebApi {
    readonly baseUrl: string;

    constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
    }

    probe = eagleProbeMock;
    libraryInfo = eagleLibraryInfoMock;
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
    expect(isDuplicateItem({ url: asset.sourceUrl }, asset)).toBe(true);
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
    expect(isDuplicateItem({ url: asset.sourceUrl }, subitem)).toBe(false);
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

  it('checks Eagle duplicates with bounded concurrency and visible progress', async () => {
    clearSessionImportedAssets();
    ADAPTER.conf = defaultConf();
    const panel = { setImportProgress: vi.fn() };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), { panel }) as EagleDownloader;
    let active = 0;
    let maxActive = 0;
    const api = {
      queryItems: vi.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return [];
      }),
    };
    const jobs = Array.from({ length: 6 }, (_, index) => ({
      asset: {
        ...eagleAsset(`image-${index}.jpg`),
        sourceUrl: `https://example.test/posts/${index}`,
        originUrl: `https://img.example.test/${index}.jpg`,
      },
    }));

    const result = await (downloader as any).preflightJobs(api, jobs);

    expect(result).toEqual({ writable: 6, sessionSkipped: 0, duplicateSkipped: 0, failed: 0 });
    expect(maxActive).toBe(4);
    expect(panel.setImportProgress).toHaveBeenLastCalledWith(i18n.eagleImportCheckingEagle.get(), 6, 6);
  });

  it('cancels duplicate preflight before queued Eagle queries continue', async () => {
    ADAPTER.conf = defaultConf();
    const panel = { setImportProgress: vi.fn() };
    const api = { queryItems: vi.fn().mockResolvedValue([]) };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      panel,
      importStopRequested: true,
    }) as EagleDownloader;

    await expect((downloader as any).preflightJobs(api, [{ asset: eagleAsset('image.jpg') }])).rejects.toThrow('abort');
    expect(api.queryItems).not.toHaveBeenCalled();
  });

  it('skips repeated assets in one plan before querying Eagle', async () => {
    clearSessionImportedAssets();
    ADAPTER.conf = defaultConf();
    const panel = { setImportProgress: vi.fn() };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), { panel }) as EagleDownloader;
    const api = { queryItems: vi.fn().mockResolvedValue([]) };
    const repeated = eagleAsset('same.jpg');
    const jobs = [{ asset: repeated }, { asset: { ...repeated } }];

    const result = await (downloader as any).preflightJobs(api, jobs);

    expect(result).toEqual({ writable: 1, sessionSkipped: 1, duplicateSkipped: 0, failed: 0 });
    expect(api.queryItems).toHaveBeenCalledTimes(4);
    expect(jobs[1].asset).toBeDefined();
    expect((jobs[1] as any).skipReason).toBe('session');
  });

  it('applies the import limit to writable items without letting duplicates consume it', () => {
    const duplicate = { asset: eagleAsset('duplicate.jpg'), skipReason: 'duplicate' };
    const first = { asset: eagleAsset('first.jpg') };
    const second = { asset: eagleAsset('second.jpg') };
    const failed = { asset: eagleAsset('failed.jpg'), preflightError: new Error('query failed') };

    const plan = limitWritableImportJobs([duplicate, first, second, failed] as any, 1);

    expect(plan.jobs).toEqual([duplicate, first, failed]);
    expect(plan.writable).toBe(1);
    expect(plan.omittedByLimit).toBe(1);
    expect(plan.selected).toBe(4);
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

  it('distinguishes partial cancellation from a fully handled import', () => {
    expect(isPartialImportResult({ planned: 5, imported: 2, skipped: 1, failed: 0 })).toBe(true);
    expect(isPartialImportResult({ planned: 3, imported: 2, skipped: 1, failed: 0 })).toBe(false);
    expect(isPartialImportResult({ planned: 3, imported: 0, skipped: 0, failed: 0 })).toBe(false);
  });

  it('keeps a persistent result when cancellation follows successful writes', () => {
    const panel = { showEagleImportResult: vi.fn() };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), { panel }) as any;
    const stats = {
      canceled: false,
      planned: 3,
      imported: 1,
      skipped: 0,
      failed: 0,
      folders: ['Eagle Looms/site/date'],
      folderLinks: [{ label: 'Eagle Looms/site/date', url: 'http://localhost:41595/folder?id=folder' }],
      itemLinks: [{ label: 'image.jpg', url: 'http://localhost:41595/item?id=item' }],
      skippedItems: [],
      failures: [],
    };

    downloader.showPartialCancellation(stats);

    expect(stats.canceled).toBe(true);
    expect(panel.showEagleImportResult).toHaveBeenCalledWith(
      expect.arrayContaining(['stopped before completion', 'imported 1']),
      false,
      [...stats.itemLinks, ...stats.folderLinks],
    );
  });

  it('turns common Eagle Web API transport failures into actionable messages', () => {
    expect(eagleImportErrorMessage(new Error('Failed to fetch'))).toContain('use Config > Test Eagle');
    expect(eagleImportErrorMessage(new Error('0 network error'))).toContain('Cannot reach Eagle Web API');
    expect(eagleImportErrorMessage(new Error('request timed out'))).toContain('Eagle Web API timed out');
    expect(eagleImportErrorMessage(new Error('403 Forbidden'))).toBe('403 Forbidden');
  });

  it('rejects malformed folder rules before an Eagle write can create literal brace folders', () => {
    expect(eagleFolderTemplateForImport('Eagle Looms/{site}/{date}')).toBe('Eagle Looms/{site}/{date}');
    expect(() => eagleFolderTemplateForImport('Eagle Looms/{site/{date}')).toThrow(i18n.eagleImportMalformedFolderRule.get());
  });

  it('reports a malformed current-image folder rule before connecting to Eagle', async () => {
    const imf = { stage: EAGLE_IMPORT_DONE_STAGE, data: new Uint8Array([1]) };
    const panel = {
      flushUI: vi.fn(),
      showEagleImportResult: vi.fn(),
    };
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      panel,
      pageFetcher: { chapters: [{ title: 'Chapter', filteredQueue: [imf] }] },
      abort: vi.fn(),
      downloading: false,
      done: false,
    }) as EagleDownloader;
    ADAPTER.conf = { ...defaultConf(), eagleFolderPath: 'Eagle Looms/{site/{date}' };
    eagleProbeMock.mockReset();

    await downloader.importOne(0, 0);

    expect(eagleProbeMock).not.toHaveBeenCalled();
    expect(panel.showEagleImportResult).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining(i18n.eagleImportMalformedFolderRule.get())]),
      true,
      [],
    );
  });

  it('stops before writing when Eagle switches libraries during preflight', async () => {
    const api = {
      libraryInfo: vi.fn().mockResolvedValue({ name: 'Library B', path: 'D:/B.library', folders: [] }),
    };

    await expect(assertEagleLibraryUnchanged(api as any, {
      name: 'Library A',
      path: 'D:/A.library',
    })).rejects.toThrow('Library A');
  });

  it('writes collected author URLs into Eagle item annotations', () => {
    const input = toAddItemInput({
      ...eagleAsset('artist.jpg'),
      meta: { authorUrls: ['https://exhentai.org/tag/artist:soha_blan'] },
      node: { authorUrls: [' https://www.pixiv.net/users/42 ', 'https://www.pixiv.net/users/42'] },
    } as any, ['folder-id']);

    expect(input.annotation).toBeTruthy();
    expect(JSON.parse(input.annotation!)).toEqual({
      schema: 'eagle-looms/item/v1',
      sourceUrl: asset.sourceUrl,
      originUrl: asset.originUrl,
      stableKey: stableKeyForAsset(asset),
      authorUrls: ['https://www.pixiv.net/users/42', 'https://exhentai.org/tag/artist:soha_blan'],
    });
    expect(input.folders).toEqual(['folder-id']);
  });

  it('uses import date for folders and keeps source published date as an item tag', () => {
    const chapter = {
      title: 'Chapter',
      filteredQueue: [{
        stage: EAGLE_IMPORT_DONE_STAGE,
        data: new Uint8Array([1]),
        contentType: 'image/jpeg',
        node: {
          title: 'source-image.jpg',
          href: 'https://example.test/posts/1',
          originSrc: 'https://img.example.test/source-image.jpg',
          tags: new Set<string>(['copyright:project sekai']),
          authorUrls: [],
          publishedAt: '1999-01-02T00:00:00Z',
        },
      }],
    };
    const downloader = Object.create(EagleDownloader.prototype) as EagleDownloader;
    ADAPTER.conf = defaultConf();

    const assets = (downloader as any).assetsForChapter(
      chapter,
      { picked: () => true },
      '',
      new GalleryMeta('https://example.test/posts', 'Example posts'),
      '2026-06-16',
    );

    expect(assets).toHaveLength(1);
    expect(assets[0].folderTokens.date).toBe('2026-06-16');
    expect(assets[0].tags).toContain('source:published:1999-01-02');
  });

  it('keeps normal Eagle item payloads annotation-free when no extra identity is needed', () => {
    const input = toAddItemInput({
      ...eagleAsset('plain.jpg'),
      meta: { authorUrls: [] },
      node: { authorUrls: [] },
    } as any, ['folder-id']);

    expect(input.annotation).toBeUndefined();
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
    eagleProbeMock.mockResolvedValue({ library: { name: 'Test Library', path: 'D:/Test.library' } });
    eagleLibraryInfoMock.mockReset();
    eagleLibraryInfoMock.mockResolvedValue({ name: 'Test Library', path: 'D:/Test.library', folders: [] });

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
    expect(panel.showEagleImportResult).toHaveBeenCalledWith(
      expect.arrayContaining(['library Test Library']),
      false,
      [],
    );
  });

  it('adds a direct Eagle item link after a single-item write', async () => {
    clearSessionImportedAssets();
    ADAPTER.conf = defaultConf();
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      folderIdsForJob: vi.fn().mockResolvedValue(['folder-id']),
    }) as any;
    const api = {
      baseUrl: 'http://localhost:41595',
      addItem: vi.fn().mockResolvedValue('item-id'),
    };
    const assetWithMeta = {
      ...eagleAsset('source image.jpg'),
      node: { authorUrls: [] },
      meta: { authorUrls: [] },
    };
    const stats = {
      planned: 1,
      imported: 0,
      skipped: 0,
      sessionSkipped: 0,
      duplicateSkipped: 0,
      failed: 0,
      folders: [],
      folderLinks: [],
      itemLinks: [],
      skippedItems: [],
      failures: [],
    };

    await downloader.writeJob(api, {
      get: vi.fn(),
    }, {
      asset: assetWithMeta,
      folderPaths: [['Eagle Looms', 'site', '2026-07-11']],
      folderKeys: ['Eagle Looms/site/2026-07-11'],
      folderKey: 'Eagle Looms/site/2026-07-11',
      preflightChecked: true,
    }, stats, new Set());

    expect(stats.imported).toBe(1);
    expect(stats.itemLinks).toContainEqual({
      label: 'source image.jpg',
      url: 'http://localhost:41595/item?id=item-id',
    });
    clearSessionImportedAssets();
  });

  it('stops after folder resolution without submitting the item write', async () => {
    ADAPTER.conf = defaultConf();
    const downloader = Object.assign(Object.create(EagleDownloader.prototype), {
      importStopRequested: false,
    }) as any;
    downloader.folderIdsForJob = vi.fn().mockImplementation(async () => {
      downloader.importStopRequested = true;
      return ['folder-id'];
    });
    const api = {
      baseUrl: 'http://localhost:41595',
      addItem: vi.fn().mockResolvedValue('item-id'),
    };
    const stats = {
      planned: 1,
      imported: 0,
      skipped: 0,
      sessionSkipped: 0,
      duplicateSkipped: 0,
      failed: 0,
      folders: [],
      folderLinks: [],
      itemLinks: [],
      skippedItems: [],
      failures: [],
    };

    await expect(downloader.writeJob(api, new Map(), {
      asset: {
        ...eagleAsset('source image.jpg'),
        node: { authorUrls: [] },
        meta: { authorUrls: [] },
      },
      folderPaths: [['Eagle Looms', 'site', 'date']],
      folderKeys: ['Eagle Looms/site/date'],
      folderKey: 'Eagle Looms/site/date',
      preflightChecked: true,
    }, stats, new Set())).rejects.toThrow('abort');

    expect(api.addItem).not.toHaveBeenCalled();
    expect(stats.failed).toBe(0);
  });

  it('shows an item link when exactly one asset was actually imported', () => {
    const folderLinks = [{ label: 'Eagle Looms/site/date', url: 'http://localhost:41595/folder?id=folder' }];
    const itemLinks = [{ label: 'image.jpg', url: 'http://localhost:41595/item?id=item' }];

    expect(eagleImportResultLinks({ imported: 1, folderLinks, itemLinks })).toEqual([...itemLinks, ...folderLinks]);
    expect(eagleImportResultLinks({ imported: 2, folderLinks, itemLinks })).toEqual(folderLinks);
    expect(eagleImportResultLinks({ imported: 0, folderLinks, itemLinks })).toEqual(folderLinks);
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
