import { describe, expect, it } from 'vitest';
import { eagleExtensionTag, normalizeEagleTags, normalizeSourceMetadataTag, sourceMetadataTag } from './tags';

describe('Eagle tags', () => {
  it('keeps required tags and caps source tags', () => {
    expect(normalizeEagleTags(
      ['eagle-looms', 'site:anime-pictures.net', ''],
      ['copyright:project sekai', 'character:kusanagi nene', 'purple eyes'],
      2,
    )).toEqual(['eagle-looms', 'site:anime-pictures.net', 'copyright:project sekai', 'character:kusanagi nene']);
  });

  it('deduplicates, trims, and keeps unnamespaced source tags', () => {
    expect(normalizeEagleTags(
      [' eagle-looms ', 'site:test'],
      ['eagle-looms', 'multi\nline\t tag', 'artist: soha\nblan '],
      10,
    )).toEqual(['eagle-looms', 'site:test', 'multi line tag', 'author:soha blan']);
  });

  it('treats invalid source tag limits as required tags only', () => {
    expect(normalizeEagleTags(
      ['eagle-looms'],
      ['source one'],
      Number.NaN,
    )).toEqual(['eagle-looms']);
  });

  it('normalizes only supported source metadata namespaces', () => {
    expect(sourceMetadataTag('game copyright', 'project sekai 403')).toBe('copyright:project sekai');
    expect(normalizeSourceMetadataTag('artist:soha blan')).toBe('author:soha blan');
    expect(normalizeSourceMetadataTag('general:blue eyes')).toBe('');
  });

  it('derives a required extension tag from title, url, or format query', () => {
    expect(eagleExtensionTag('anime-pictures-917184.png')).toBe('ext:png');
    expect(eagleExtensionTag(undefined, 'https://example.test/image.JPG?token=1')).toBe('ext:jpg');
    expect(eagleExtensionTag(undefined, 'https://pbs.twimg.com/media/id?format=webp&name=large')).toBe('ext:webp');
    expect(eagleExtensionTag('untitled')).toBe('');
  });
});
