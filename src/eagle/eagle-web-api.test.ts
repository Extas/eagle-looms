import { describe, expect, it } from 'vitest';
import { eagleApiRequestUrl, extractEagleItemId, extractEagleItemIds } from './eagle-web-api';

describe('Eagle Web API response helpers', () => {
  it('keeps V2 API tokens on every request URL', () => {
    expect(eagleApiRequestUrl('http://localhost:41595/?token=abc-123', '/api/v2/item/get?limit=1'))
      .toBe('http://localhost:41595/api/v2/item/get?limit=1&token=abc-123');
  });

  it('extracts item ids from common item/add response shapes', () => {
    expect(extractEagleItemId('abc')).toBe('abc');
    expect(extractEagleItemId({ id: 'abc' })).toBe('abc');
    expect(extractEagleItemId({ itemId: 'abc' })).toBe('abc');
    expect(extractEagleItemId({ item: { id: 'abc' } })).toBe('abc');
    expect(extractEagleItemId({ data: { item: { id: 'abc' } } })).toBe('abc');
    expect(extractEagleItemId({ data: [{ id: 'abc' }] })).toBe('abc');
  });

  it('extracts item ids from bulk response shapes', () => {
    expect(extractEagleItemIds({ ids: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(extractEagleItemIds({ itemIds: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(extractEagleItemIds({ items: [{ id: 'a' }, { itemId: 'b' }] })).toEqual(['a', 'b']);
    expect(extractEagleItemIds({ data: { items: [{ id: 'a' }, { item: { id: 'b' } }] } })).toEqual(['a', 'b']);
  });
});
