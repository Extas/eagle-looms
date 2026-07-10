import { describe, expect, it } from 'vitest';
import {
  buildStructuredEagleName,
  createEagleItemName,
  localDatePrefix,
  normalizeEagleItemName,
  normalizeEagleItemNameWithDatePrefix,
  parseStructuredEagleName,
  sourceDatePrefix,
} from './naming';

describe('Eagle item naming', () => {
  it('formats folder dates in local calendar time', () => {
    expect(localDatePrefix(new Date(2026, 5, 16, 23, 30))).toBe('2026-06-16');
  });

  it('keeps source identity names without adding Comic Looms order prefixes', () => {
    const used = new Set<string>();

    expect(createEagleItemName('anime-pictures-917184.png', used)).toBe('anime-pictures-917184.png');
    expect(createEagleItemName('anime-pictures-917184.png', used)).toBe('anime-pictures-917184 (2).png');
  });

  it('cleans invalid Eagle item name characters and falls back when empty', () => {
    expect(normalizeEagleItemName('bang:dream? mygo.png')).toBe('bang dream mygo.png');
    expect(normalizeEagleItemName('')).toBe('image');
  });

  it('normalizes noisy web and filesystem-style titles without losing extensions', () => {
    expect(normalizeEagleItemName('https://img.example.test/a%20b/Cat%20&amp;%20Dog.JPG?download=1')).toBe('Cat & Dog.jpg');
    expect(normalizeEagleItemName('CON.png')).toBe('CON_.png');
    expect(normalizeEagleItemName('ＡＢＣ\u200b\u0007.png')).toBe('ABC.png');
    expect(normalizeEagleItemName('a'.repeat(220) + '.webp')).toHaveLength(180);
  });

  it('deduplicates case-insensitively while preserving readable copy suffixes', () => {
    const used = new Set<string>(['Image.jpg', 'image (2).jpg']);

    expect(createEagleItemName('image.JPG', used)).toBe('image (3).jpg');
  });

  it('can prefix source publish dates without losing source identity or extensions', () => {
    expect(normalizeEagleItemNameWithDatePrefix('anime-pictures-917184.png', '2025-07-08T12:34:56Z')).toBe('2025-07-08 anime-pictures-917184.png');
    expect(normalizeEagleItemNameWithDatePrefix('2025-07-08 anime-pictures-917184.png', '2025-07-08')).toBe('2025-07-08 anime-pictures-917184.png');
    expect(normalizeEagleItemNameWithDatePrefix('anime-pictures-917184.png', '')).toBe('anime-pictures-917184.png');
  });

  it('normalizes common source date formats for sortable prefixes', () => {
    expect(sourceDatePrefix('2025/7/8 12:34:56')).toBe('2025-07-08');
    expect(sourceDatePrefix('Wed Oct 10 20:19:24 +0000 2018')).toBe('2018-10-10');
    expect(sourceDatePrefix(1719792000)).toBe('2024-07-01');
    expect(sourceDatePrefix('2025-02-31')).toBe('');
  });

  it('builds parseable structured names with a stable right-side capsule', () => {
    const name = buildStructuredEagleName('2026-06-14 User Media - NovelAI.jpg', 'PNG', {
      src: 'MQFVMXHVIRSIQ',
      seq: '01',
      at: '20260617T001403Z',
      tool: 'novelai',
    });

    expect(name).toBe('2026-06-14 User Media - NovelAI -- el1[tool=novelai;at=20260617T001403Z;seq=01;src=MQFVMXHVIRSIQ].png');
    expect(parseStructuredEagleName(name)).toEqual({
      display: '2026-06-14 User Media - NovelAI',
      extension: 'png',
      version: 1,
      capsule: 'el1[tool=novelai;at=20260617T001403Z;seq=01;src=MQFVMXHVIRSIQ]',
      fields: {
        tool: 'novelai',
        at: '20260617T001403Z',
        seq: '01',
        src: 'MQFVMXHVIRSIQ',
      },
    });
  });

  it('preserves structured capsules when truncating long display titles', () => {
    const name = buildStructuredEagleName('a'.repeat(260), 'png', {
      tool: 'novelai',
      at: '20260617T001403Z',
      seq: '02',
      src: 'SRC1',
    });

    expect(name).toHaveLength(180);
    expect(name.endsWith(' -- el1[tool=novelai;at=20260617T001403Z;seq=02;src=SRC1].png')).toBe(true);
    expect(parseStructuredEagleName(name)?.fields.src).toBe('SRC1');
  });

  it('treats malformed structured-looking tails as ordinary names', () => {
    expect(parseStructuredEagleName('Image -- el1[broken].png')).toBeUndefined();
    expect(parseStructuredEagleName('Image -- el1[tool=novelai;tool=other].png')).toBeUndefined();
    expect(parseStructuredEagleName('Image.png')).toBeUndefined();
  });

  it('normalizes structured field keys and values to a compact safe alphabet', () => {
    expect(buildStructuredEagleName('Image', 'png', {
      Tool: 'novel ai',
      'source id': 'ABC 123',
      prompt: 'girl, blue eyes',
    })).toBe('Image -- el1[tool=novel-ai;prompt=girl-blue-eyes;source-id=ABC-123].png');
  });
});
