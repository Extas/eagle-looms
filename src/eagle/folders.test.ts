import { describe, expect, it } from 'vitest';
import type { EagleFolder } from '../types';
import type { EagleWebApi } from './eagle-web-api';
import { ensureFolderPath } from './folders';
import { cleanFolderName } from './options';

describe('Eagle folders', () => {
  it('cleans user-facing folder path segments for Eagle writes', () => {
    expect(cleanFolderName(' anime:pictures.net / MyGO?\n')).toBe('anime pictures.net MyGO');
  });

  it('creates a missing nested folder path in order', async () => {
    const created: Array<{ name: string; parent?: string }> = [];
    const api = {
      getFolders: async () => [] as EagleFolder[],
      createFolder: async (name: string, parent?: string) => {
        created.push({ name, parent });
        return { id: `folder-${created.length}`, name, children: [] };
      },
    } as unknown as EagleWebApi;

    const id = await ensureFolderPath(api, ['Eagle Looms', 'anime-pictures.net', 'Gallery']);

    expect(id).toBe('folder-3');
    expect(created).toEqual([
      { name: 'Eagle Looms', parent: undefined },
      { name: 'anime-pictures.net', parent: 'folder-1' },
      { name: 'Gallery', parent: 'folder-2' },
    ]);
  });
});
