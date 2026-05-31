import { describe, expect, it } from 'vitest';
import { eagleFolderPresetForTemplate, eagleFolderTemplateForPreset, normalizeEagleBaseUrl, normalizeEagleBoolean, normalizeEagleConfigPatch, normalizeEagleFolderPreset, normalizeEagleFolderTemplate, normalizeEagleImportLimit, normalizeEagleMaxSourceTags, resolveEagleFolderPath, resolveEagleFolderPaths } from './options';

describe('Eagle options', () => {
  it('normalizes Eagle API URL input to an origin', () => {
    expect(normalizeEagleBaseUrl('http://localhost:41595/api/v2/')).toBe('http://localhost:41595');
    expect(normalizeEagleBaseUrl('not a url')).toBe('http://localhost:41595');
  });

  it('normalizes folder template and resolves tokens into safe folder segments', () => {
    const template = normalizeEagleFolderTemplate(' Eagle:Looms / {site} / {copyright} / {author} / bad?{gallery} / {chapter} ');
    expect(template).toBe('Eagle Looms/{site}/{copyright}/{author}/bad {gallery}/{chapter}');
    expect(resolveEagleFolderPath(template, {
      site: 'anime-pictures.net',
      gallery: 'bang:dream? mygo',
      chapter: '',
      copyright: 'bang dream',
      author: 'soha/blan',
    })).toEqual(['Eagle Looms', 'anime-pictures.net', 'bang dream', 'soha blan', 'bad bang dream mygo']);
  });

  it('falls back to the default folder template when input has no valid segments', () => {
    expect(normalizeEagleFolderTemplate('???///')).toBe('Eagle Looms/{site}/{copyright}');
  });

  it('normalizes folder presets and exposes their templates', () => {
    expect(normalizeEagleFolderPreset('copyrightAuthor')).toBe('copyrightAuthor');
    expect(normalizeEagleFolderPreset('unknown')).toBe('copyright');
    expect(eagleFolderTemplateForPreset('copyright')).toBe('Eagle Looms/{site}/{copyright}');
    expect(eagleFolderTemplateForPreset('gallery')).toBe('Eagle Looms/{site}/{gallery}');
    expect(eagleFolderTemplateForPreset('custom')).toBeUndefined();
    expect(eagleFolderPresetForTemplate(' Eagle Looms / {site} / {copyright} ')).toBe('copyright');
    expect(eagleFolderPresetForTemplate('Eagle Looms/{site}/{copyright}/{author}')).toBe('copyrightAuthor');
    expect(eagleFolderPresetForTemplate('Eagle Looms/Custom')).toBe('custom');
  });

  it('expands character folder templates into multiple Eagle folders', () => {
    expect(resolveEagleFolderPaths('Eagle Looms/{site}/{copyright}/{character}', {
      site: 'anime-pictures.net',
      gallery: '',
      chapter: '',
      copyright: 'bang dream',
      character: 'tomori takamatsu',
      characters: ['tomori takamatsu', 'anon chihaya'],
    })).toEqual([
      ['Eagle Looms', 'anime-pictures.net', 'bang dream', 'tomori takamatsu'],
      ['Eagle Looms', 'anime-pictures.net', 'bang dream', 'anon chihaya'],
    ]);
  });

  it('keeps the default copyright folder preset useful when copyright metadata is missing', () => {
    expect(resolveEagleFolderPath('Eagle Looms/{site}/{copyright}', {
      site: 'pixiv.net',
      gallery: 'artist 42',
      chapter: '',
    })).toEqual(['Eagle Looms', 'pixiv.net', 'artist 42']);

    expect(resolveEagleFolderPath('Eagle Looms/{site}/{copyright}', {
      site: 'x.com',
      gallery: '',
      chapter: '',
    })).toEqual(['Eagle Looms', 'x.com', 'Unsorted']);

    expect(resolveEagleFolderPath('Eagle Looms/{site}/{copyright}/{author}', {
      site: 'pixiv.net',
      gallery: 'artist 42',
      chapter: '',
      author: 'artist name',
    })).toEqual(['Eagle Looms', 'pixiv.net', 'artist name']);
  });

  it('clamps import limits to the supported range', () => {
    expect(normalizeEagleImportLimit(0)).toBe(1);
    expect(normalizeEagleImportLimit(1001)).toBe(1000);
    expect(normalizeEagleImportLimit('42.8')).toBe(42);
  });

  it('clamps source tag limits to the supported range', () => {
    expect(normalizeEagleMaxSourceTags(-1)).toBe(0);
    expect(normalizeEagleMaxSourceTags(101)).toBe(100);
    expect(normalizeEagleMaxSourceTags('12.8')).toBe(12);
  });

  it('normalizes Eagle boolean options from stored config values', () => {
    expect(normalizeEagleBoolean('false')).toBe(false);
    expect(normalizeEagleBoolean('1')).toBe(true);
    expect(normalizeEagleBoolean(undefined, false)).toBe(false);
  });

  it('normalizes Eagle fields in site-level config patches without adding missing overrides', () => {
    const sitePatch = {
      eagleBaseUrl: 'http://localhost:41595/api/v2',
      eagleFolderPreset: 'chapter',
      eagleFolderPath: ' Eagle:Looms / Site ',
      eagleImportLimit: '1001',
      eagleMaxSourceTags: '-1',
      eagleNameDatePrefix: 'false',
      eagleSkipDuplicates: '0',
      workURLs: ['example'],
    };

    expect(normalizeEagleConfigPatch(sitePatch)).toEqual({
      eagleBaseUrl: 'http://localhost:41595',
      eagleFolderPreset: 'custom',
      eagleFolderPath: 'Eagle Looms/Site',
      eagleImportLimit: 1000,
      eagleMaxSourceTags: 0,
      eagleNameDatePrefix: false,
      eagleSkipDuplicates: false,
      workURLs: ['example'],
    });

    const patchWithoutEagleFields = { workURLs: ['example'] };
    expect(normalizeEagleConfigPatch(patchWithoutEagleFields)).toEqual({ workURLs: ['example'] });
  });
});
