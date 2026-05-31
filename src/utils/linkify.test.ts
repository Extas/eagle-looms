import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('escapes non-url text before rendering links in message HTML', () => {
    const html = linkify('<img src=x onerror=alert(1)> https://example.test/a?b=1');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<a target="_blank" href="https://example.test/a?b=1">https://example.test/a?b=1</a>');
  });
});
