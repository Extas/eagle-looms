import { describe, expect, it, vi } from 'vitest';
import type { EagleFolder } from '../types';
import type { EagleWebApi } from './eagle-web-api';
import { ensureFolderPath, indexFolderPaths } from './folders';
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

  it('indexes readable paths for nested Eagle folder ids', () => {
    const paths = indexFolderPaths([{
      id: 'root',
      name: 'Eagle Looms',
      children: [{
        id: 'site',
        name: 'Twitter X',
        children: [{ id: 'date', name: '2026-07-11', children: [] }],
      }],
    }]);

    expect(paths.get('root')).toBe('Eagle Looms');
    expect(paths.get('site')).toBe('Eagle Looms / Twitter X');
    expect(paths.get('date')).toBe('Eagle Looms / Twitter X / 2026-07-11');
  });

  it('stops before creating folders when the import is canceled during the tree read', async () => {
    let active = true;
    let releaseFolders!: () => void;
    const blocked = new Promise<void>(resolve => {
      releaseFolders = resolve;
    });
    const api = {
      getFolders: vi.fn(async () => {
        await blocked;
        return [] as EagleFolder[];
      }),
      createFolder: vi.fn(),
    } as unknown as EagleWebApi;

    const result = ensureFolderPath(api, ['Eagle Looms', 'site', 'date'], () => {
      if (!active) throw new Error('abort');
    });
    active = false;
    releaseFolders();

    await expect(result).rejects.toThrow('abort');
    expect((api as any).createFolder).not.toHaveBeenCalled();
  });
});
