import type { EagleFolder } from '../types';
import { EagleWebApi } from './eagle-web-api';
import { cleanFolderName } from './options';

export async function ensureFolderPath(api: EagleWebApi, path: string[], assertActive: () => void = () => undefined): Promise<string> {
  const cleanPath = path.map(cleanFolderName).filter(Boolean);
  if (!cleanPath.length) throw new Error('Folder path is empty.');

  assertActive();
  const roots = await api.getFolders();
  assertActive();
  let parentId: string | undefined;
  let siblings = roots;
  let current: EagleFolder | undefined;

  for (const segment of cleanPath) {
    assertActive();
    current = findChild(siblings, segment);
    if (!current) {
      current = await api.createFolder(segment, parentId);
    }
    parentId = current.id;
    siblings = current.children || [];
  }

  if (!current?.id) throw new Error(`Could not resolve Eagle folder path: ${cleanPath.join('/')}`);
  return current.id;
}

function findChild(folders: EagleFolder[], name: string): EagleFolder | undefined {
  return folders.find((folder) => folder.name.trim().toLowerCase() === name.trim().toLowerCase());
}
