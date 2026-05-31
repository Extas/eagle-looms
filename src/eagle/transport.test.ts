import { describe, expect, it } from 'vitest';
import { arrayBufferToBase64 } from './transport';

describe('Eagle transport', () => {
  it('encodes fetched binary image data for Eagle base64 item imports', () => {
    const buffer = new Uint8Array([97, 98, 99]).buffer;

    expect(arrayBufferToBase64(buffer)).toBe('YWJj');
  });
});
