import { describe, expect, it } from 'vitest';
import { createEagleItemName, normalizeEagleItemName } from './naming';

describe('Eagle item naming', () => {
  it('keeps source identity names without adding Comic Looms order prefixes', () => {
    const used = new Set<string>();

    expect(createEagleItemName('anime-pictures-917184.png', used)).toBe('anime-pictures-917184.png');
    expect(createEagleItemName('anime-pictures-917184.png', used)).toBe('anime-pictures-917184_1.png');
  });

  it('cleans invalid Eagle item name characters and falls back when empty', () => {
    expect(normalizeEagleItemName('bang:dream? mygo.png')).toBe('bang_dream_ mygo.png');
    expect(normalizeEagleItemName('')).toBe('image');
  });
});
