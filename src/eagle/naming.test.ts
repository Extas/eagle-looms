import { describe, expect, it } from 'vitest';
import { createEagleItemName, normalizeEagleItemName } from './naming';

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
});
