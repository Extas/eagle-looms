import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrayBufferToBase64, requestJson } from './transport';

describe('Eagle transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('encodes fetched binary image data for Eagle base64 item imports', () => {
    const buffer = new Uint8Array([97, 98, 99]).buffer;

    expect(arrayBufferToBase64(buffer)).toBe('YWJj');
  });

  it('turns non-JSON API responses into a recognizable Eagle error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html>not Eagle</html>'),
    }));

    await expect(requestJson('http://localhost:41595/api/v2/app/info')).rejects.toThrow('Eagle API returned invalid JSON');
  });

  it('times out the native fetch fallback instead of waiting indefinitely', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));

    const request = requestJson('http://localhost:41595/api/v2/app/info', { timeoutMs: 25 });
    const assertion = expect(request).rejects.toThrow('request timed out');
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });
});
