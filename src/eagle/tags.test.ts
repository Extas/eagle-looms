import { describe, expect, it } from 'vitest';
import { GalleryMeta } from '../download/gallery-meta';
import { eagleExtensionTag, normalizeEagleItemTags, normalizeEagleTags, normalizeSourceMetadataTag, semanticSourceTags, sourceMetadataTag, sourceTagsFromGalleryMeta } from './tags';

describe('Eagle tags', () => {
  it('keeps required tags and caps source tags', () => {
    expect(normalizeEagleTags(
      ['eagle-looms', 'site:anime-pictures.net', ''],
      ['copyright:project sekai', 'character:kusanagi nene', 'purple eyes'],
      2,
    )).toEqual(['eagle-looms', 'site:anime-pictures.net', 'copyright:project sekai', 'character:kusanagi nene']);
  });

  it('prioritizes source identity tags before raw visual tags within the source tag cap', () => {
    expect(normalizeEagleTags(
      ['eagle-looms'],
      ['purple eyes', 'blue hair', 'artist:soha blan', 'character:kusanagi nene', 'copyright:project sekai'],
      3,
    )).toEqual(['eagle-looms', 'copyright:project sekai', 'character:kusanagi nene', 'author:soha blan']);
  });

  it('keeps visible Eagle item tags to source semantic tags', () => {
    const source = [
      'eagle-looms',
      'site:anime-pictures.net',
      'post:917184',
      'ext:png',
      'mime:image/png',
      'gallery:bang dream',
      'chapter:Default',
      'artist:soha blan',
      'copyright:bang dream',
      'character:tomori takamatsu',
      'blue eyes',
    ];

    expect(semanticSourceTags(source)).toEqual([
      'artist:soha blan',
      'copyright:bang dream',
      'character:tomori takamatsu',
      'blue eyes',
    ]);
    expect(normalizeEagleItemTags(source, 10)).toEqual([
      'copyright:bang dream',
      'character:tomori takamatsu',
      'author:soha blan',
      'blue eyes',
    ]);
  });

  it('deduplicates, trims, and keeps unnamespaced source tags', () => {
    expect(normalizeEagleTags(
      [' eagle-looms ', 'site:test'],
      ['eagle-looms', 'multi\nline\t tag', 'artist: soha\nblan '],
      10,
    )).toEqual(['eagle-looms', 'site:test', 'author:soha blan', 'multi line tag']);
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
    expect(sourceMetadataTag('game_copyright', 'project sekai 403')).toBe('copyright:project sekai');
    expect(sourceMetadataTag('other-copyright', 'project sekai +403')).toBe('copyright:project sekai');
    expect(normalizeSourceMetadataTag('artist:soha blan')).toBe('author:soha blan');
    expect(normalizeSourceMetadataTag('parody:bang dream')).toBe('copyright:bang dream');
    expect(normalizeSourceMetadataTag('group:circle name')).toBe('author:circle name');
    expect(sourceMetadataTag('circles', 'circle name')).toBe('author:circle name');
    expect(sourceMetadataTag('Artist:', 'soha blan')).toBe('author:soha blan');
    expect(normalizeSourceMetadataTag('general:blue eyes')).toBe('');
  });

  it('derives Eagle source tags from gallery metadata categories', () => {
    const meta = new GalleryMeta('https://exhentai.org/g/1/token', 'gallery');
    meta.tags = {
      parody: ['bang dream'],
      character: ['takamatzu tomori'],
      artist: ['soha blan'],
      female: ['school uniform'],
      language: ['japanese'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://exhentai.org/s/key/1-1')).toEqual([
      'copyright:bang dream',
      'character:takamatzu tomori',
      'author:soha blan',
      'school uniform',
      'japanese',
    ]);
  });

  it('keeps gallery raw tag categories while normalizing author/copyright namespaces', () => {
    const meta = new GalleryMeta('https://hdoujin.org/g/1/key', 'gallery');
    meta.tags = {
      circle: ['circle name'],
      parody: ['project sekai'],
      male_tags: ['glasses'],
      female_tags: ['school uniform'],
      genres: ['comedy'],
      categories: ['doujinshi'],
      languages: ['english'],
      uploader: ['source uploader'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://hdoujin.org/g/1/key/read/1')).toEqual([
      'author:circle name',
      'copyright:project sekai',
      'glasses',
      'school uniform',
      'comedy',
      'doujinshi',
      'english',
      'source uploader',
    ]);
  });

  it('keeps common gallery type and misc categories from API metadata', () => {
    const meta = new GalleryMeta('https://eahentai.com/a/1', 'gallery');
    meta.tags = {
      albumType: ['Image Set'],
      type: ['Doujinshi'],
      maleTags: ['glasses'],
      misc: ['uncategorized tag'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://eahentai.com/a/1/0')).toEqual([
      'Image Set',
      'Doujinshi',
      'glasses',
      'uncategorized tag',
    ]);
  });

  it('normalizes source metadata category key shape before mapping', () => {
    const meta = new GalleryMeta('https://example.test/gallery/1', 'gallery');
    meta.tags = {
      game_copyright: ['project sekai 403'],
      'other-copyright': ['bang dream +20'],
      'Character:': ['kusanagi nene'],
      Artist: ['soha blan'],
      femaleTags: ['school uniform'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://example.test/gallery/1')).toEqual([
      'copyright:project sekai',
      'copyright:bang dream',
      'character:kusanagi nene',
      'author:soha blan',
      'school uniform',
    ]);
  });

  it('uses only matching per-post metadata buckets for Pixiv-style metadata', () => {
    const meta = new GalleryMeta('https://www.pixiv.net/users/42', 'pixiv_42');
    meta.tags = {
      '100': ['blue archive', 'mika'],
      '101': ['bang dream'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://www.pixiv.net/artworks/100')).toEqual([
      'blue archive',
      'mika',
    ]);
  });

  it('derives a required extension tag from title, url, or format query', () => {
    expect(eagleExtensionTag('anime-pictures-917184.png')).toBe('ext:png');
    expect(eagleExtensionTag(undefined, 'https://example.test/image.JPG?token=1')).toBe('ext:jpg');
    expect(eagleExtensionTag(undefined, 'https://pbs.twimg.com/media/id?format=webp&name=large')).toBe('ext:webp');
    expect(eagleExtensionTag('untitled')).toBe('');
  });
});
