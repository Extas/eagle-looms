import { describe, expect, it } from 'vitest';
import { createEagleItemName, normalizeEagleItemName, normalizeEagleItemNameWithDatePrefix, sourceDatePrefix } from './naming';

describe('Eagle item naming', () => {
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
});
