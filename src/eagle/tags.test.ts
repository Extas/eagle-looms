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
    expect(normalizeSourceMetadataTag('artist：soha blan')).toBe('author:soha blan');
    expect(normalizeSourceMetadataTag('parody:bang dream')).toBe('copyright:bang dream');
    expect(sourceMetadataTag('parodys', 'project sekai')).toBe('copyright:project sekai');
    expect(normalizeSourceMetadataTag('group:circle name')).toBe('author:circle name');
    expect(sourceMetadataTag('circles', 'circle name')).toBe('author:circle name');
    expect(sourceMetadataTag('作品', 'project sekai')).toBe('copyright:project sekai');
    expect(sourceMetadataTag('角色', 'kusanagi nene')).toBe('character:kusanagi nene');
    expect(sourceMetadataTag('藝術家', 'soha blan')).toBe('author:soha blan');
    expect(sourceMetadataTag('社团', 'circle name')).toBe('author:circle name');
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
      femaleTag: ['school uniform'],
      'male-tag': ['solo male'],
      misc: ['uncategorized tag'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://eahentai.com/a/1/0')).toEqual([
      'Image Set',
      'Doujinshi',
      'glasses',
      'school uniform',
      'solo male',
      'uncategorized tag',
    ]);
  });

  it('maps numeric booru metadata categories from structured gallery metadata', () => {
    const meta = new GalleryMeta('https://danbooru.donmai.us/posts', 'posts');
    meta.tags = {
      '3': ['project_sekai 403'],
      '4': ['kusanagi_nene 26'],
      '1': ['soha_blan 11'],
      '0': ['blue_eyes 120K'],
      '5': ['highres 80K'],
    };

    const sourceTags = sourceTagsFromGalleryMeta(meta, 'https://danbooru.donmai.us/posts/100');
    expect(sourceTags).toEqual([
      'blue_eyes',
      'author:soha_blan',
      'copyright:project_sekai',
      'character:kusanagi_nene',
      'highres',
    ]);
    expect(normalizeEagleItemTags(sourceTags, 10)).toEqual([
      'copyright:project_sekai',
      'character:kusanagi_nene',
      'author:soha_blan',
      'blue_eyes',
      'highres',
    ]);
  });

  it('normalizes common Chinese metadata categories from gallery pages', () => {
    const meta = new GalleryMeta('https://hanime1.me/comic/123', 'gallery');
    meta.tags = {
      '作品：': ['project sekai'],
      '角色': ['kusanagi nene'],
      '作者：': ['soha blan'],
      '標籤': ['school uniform'],
      '語言': ['chinese'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://hanime1.me/comic/123')).toEqual([
      'copyright:project sekai',
      'character:kusanagi nene',
      'author:soha blan',
      'school uniform',
      'chinese',
    ]);
  });

  it('maps Hitomi API category spellings into unified source namespaces', () => {
    const meta = new GalleryMeta('https://hitomi.la/galleries/123.html', 'gallery');
    meta.tags = {
      parodys: ['project sekai'],
      artists: ['soha blan'],
      groups: ['circle name'],
      characters: ['kusanagi nene'],
      tags: ['school uniform'],
    };
    (meta.tags as Record<string, unknown>).language = 'english';

    expect(sourceTagsFromGalleryMeta(meta, 'https://hitomi.la/galleries/123.html')).toEqual([
      'copyright:project sekai',
      'author:soha blan',
      'author:circle name',
      'character:kusanagi nene',
      'school uniform',
      'english',
    ]);
  });

  it('keeps language-like flag metadata from API galleries', () => {
    const meta = new GalleryMeta('https://yabai.si/g/test', 'gallery');
    meta.tags = {
      flag: [{ name: 'English', code: 'en' }],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://yabai.si/g/test')).toEqual([
      'English',
    ]);
  });

  it('extracts common object-shaped metadata tag values without stringifying objects', () => {
    const meta = new GalleryMeta('https://example.test/gallery/1', 'gallery');
    meta.tags = {
      artist: [{ name: 'soha blan' }, { label: 'circle name' }],
      character: [{ tag: 'kusanagi nene' }],
      tags: [{ value: 'blue eyes' }, { title: 'school uniform' }, { count: 42 }],
    };
    (meta.tags as Record<string, unknown>).category = { name: 'doujinshi' };

    expect(sourceTagsFromGalleryMeta(meta, 'https://example.test/gallery/1')).toEqual([
      'author:soha blan',
      'author:circle name',
      'character:kusanagi nene',
      'blue eyes',
      'school uniform',
      'doujinshi',
    ]);
  });

  it('extracts nested metadata tag arrays from common API container fields', () => {
    const meta = new GalleryMeta('https://example.test/gallery/1', 'gallery');
    meta.tags = {
      tags: [
        ['blue eyes', { name: 'school uniform' }],
        { tags: ['long hair', { value: 'smile' }] },
        { values: ['indoors'] },
        { items: [{ label: 'highres' }] },
      ],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://example.test/gallery/1')).toEqual([
      'blue eyes',
      'school uniform',
      'long hair',
      'smile',
      'indoors',
      'highres',
    ]);
  });

  it('normalizes source metadata category key shape before mapping', () => {
    const meta = new GalleryMeta('https://example.test/gallery/1', 'gallery');
    meta.tags = {
      game_copyright: ['project sekai 403'],
      'other-copyright': ['bang dream +20'],
      'Character:': ['kusanagi nene'],
      'Artist：': ['soha blan'],
      Artist: ['soha blan'],
      'female：': ['school uniform'],
      femaleTags: ['casual outfit'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://example.test/gallery/1')).toEqual([
      'copyright:project sekai',
      'copyright:bang dream',
      'character:kusanagi nene',
      'author:soha blan',
      'school uniform',
      'casual outfit',
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

  it('matches common per-post metadata bucket key variants', () => {
    const meta = new GalleryMeta('https://example.test/posts', 'posts');
    meta.tags = {
      'post:100': ['copyright:project sekai'],
      'id：100': ['character:kusanagi nene'],
      id_100: [{ name: 'character:kusanagi nene' }],
      'artwork-100': ['author:soha blan'],
      'post:101': ['wrong post'],
    };

    expect(sourceTagsFromGalleryMeta(meta, 'https://example.test/posts/100')).toEqual([
      'copyright:project sekai',
      'character:kusanagi nene',
      'author:soha blan',
    ]);
  });

  it('derives a required extension tag from title, url, or format query', () => {
    expect(eagleExtensionTag('anime-pictures-917184.png')).toBe('ext:png');
    expect(eagleExtensionTag(undefined, 'https://example.test/image.JPG?token=1')).toBe('ext:jpg');
    expect(eagleExtensionTag(undefined, 'https://pbs.twimg.com/media/id?format=webp&name=large')).toBe('ext:webp');
    expect(eagleExtensionTag('untitled')).toBe('');
  });
});
