import { describe, expect, it, vi } from 'vitest';
import { classifyEagleApiError, EagleWebApi, eagleApiRequestUrl, extractEagleItemId, extractEagleItemIds, extractEagleLibraryName, extractEagleLibraryPath, redactEagleApiSecrets } from './eagle-web-api';

const requestJsonMock = vi.hoisted(() => vi.fn());

vi.mock('./transport', () => ({ requestJson: requestJsonMock }));

describe('Eagle Web API response helpers', () => {
  it('keeps V2 API tokens on every request URL', () => {
    expect(eagleApiRequestUrl('http://localhost:41595/?token=abc-123', '/api/v2/item/get?limit=1'))
      .toBe('http://localhost:41595/api/v2/item/get?limit=1&token=abc-123');
  });

  it('reads all exact URL candidates through the V2 item filter', async () => {
    requestJsonMock.mockResolvedValueOnce({
      status: 'success',
      data: { data: [{ id: 'a', url: 'https://example.test/source' }, { id: 'deleted', isDeleted: true }] },
    });
    const api = new EagleWebApi('http://localhost:41595/?token=abc-123');

    await expect(api.itemsByUrl('https://example.test/source')).resolves.toEqual([
      { id: 'a', url: 'https://example.test/source' },
    ]);
    expect(requestJsonMock).toHaveBeenCalledWith(
      'http://localhost:41595/api/v2/item/get?token=abc-123',
      {
        method: 'POST',
        body: {
          url: 'https://example.test/source',
          fields: ['id', 'name', 'url', 'website', 'annotation', 'isDeleted'],
          limit: 1000,
          offset: 0,
        },
      },
    );
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

  it('extracts the current library name from V2 response shapes', () => {
    expect(extractEagleLibraryName({ name: 'My Library' })).toBe('My Library');
    expect(extractEagleLibraryName({ data: { name: 'Nested Library' } })).toBe('Nested Library');
    expect(extractEagleLibraryName({})).toBe('');
    expect(extractEagleLibraryPath({ path: 'D:/Library.library' })).toBe('D:/Library.library');
    expect(extractEagleLibraryPath({ data: { path: 'D:/Nested.library' } })).toBe('D:/Nested.library');
  });

  it('classifies actionable Eagle API transport and authorization failures', () => {
    expect(classifyEagleApiError(new Error('403 Forbidden'))).toBe('authorization');
    expect(classifyEagleApiError(new Error('invalid API token'))).toBe('authorization');
    expect(classifyEagleApiError(new Error('Eagle API returned invalid JSON'))).toBe('response');
    expect(classifyEagleApiError(new Error('request timed out'))).toBe('timeout');
    expect(classifyEagleApiError(new Error('Failed to fetch'))).toBe('connection');
    expect(classifyEagleApiError(new Error('bad request'))).toBe('other');
  });

  it('redacts V2 tokens from API error text without hiding the endpoint', () => {
    expect(redactEagleApiSecrets('Request failed: https://eagle.test/api/v2/item/get?token=secret-value&limit=1'))
      .toBe('Request failed: https://eagle.test/api/v2/item/get?token=***&limit=1');
    expect(redactEagleApiSecrets('Forbidden token=secret-value')).toBe('Forbidden token=***');
  });
});
