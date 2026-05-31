import { describe, expect, it } from 'vitest';
import { normalizeEagleBaseUrl, normalizeEagleConfigPatch, normalizeEagleFolderTemplate, normalizeEagleImportLimit, normalizeEagleMaxSourceTags, resolveEagleFolderPath } from './options';

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
    expect(normalizeEagleFolderTemplate('???///')).toBe('Eagle Looms/{site}/{gallery}');
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

  it('normalizes Eagle fields in site-level config patches without adding missing overrides', () => {
    const sitePatch = {
      eagleBaseUrl: 'http://localhost:41595/api/v2',
      eagleFolderPath: ' Eagle:Looms / Site ',
      eagleImportLimit: '1001',
      eagleMaxSourceTags: '-1',
      workURLs: ['example'],
    };

    expect(normalizeEagleConfigPatch(sitePatch)).toEqual({
      eagleBaseUrl: 'http://localhost:41595',
      eagleFolderPath: 'Eagle Looms/Site',
      eagleImportLimit: 1000,
      eagleMaxSourceTags: 0,
      workURLs: ['example'],
    });

    const patchWithoutEagleFields = { workURLs: ['example'] };
    expect(normalizeEagleConfigPatch(patchWithoutEagleFields)).toEqual({ workURLs: ['example'] });
  });
});
