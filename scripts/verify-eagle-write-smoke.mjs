const eagleBase = (process.env.EAGLE_API_BASE || 'http://localhost:41595').replace(/\/$/, '');
const smokePath = ['Eagle Looms', '_Smoke', 'write-smoke'];
const runId = `write-smoke-${Date.now()}`;
let createdId = '';

try {
  const preCleanedSmokeIds = await cleanupStaleSmokeItems();
  const folderId = await ensureFolderPath(smokePath);
  createdId = await addSmokeBookmark(folderId, runId);
  if (!createdId) throw new Error('item/add did not return an item id.');
  const readBack = await waitForCreated(createdId, runId);
  if (!readBack || readBack.isDeleted || !readBack.annotation?.includes(runId)) {
    throw new Error('Created smoke item did not round-trip through item/info.');
  }
  await trashItemWithRetry(createdId);
  const trashed = await waitForTrash(createdId);
  if (!trashed) throw new Error(`Smoke item was not moved to trash: ${createdId}`);

  console.log(JSON.stringify({
    source: eagleBase,
    folderPath: smokePath.join('/'),
    createdId,
    preCleanedSmokeIds,
    cleanup: 'moved-created-smoke-item-to-trash',
  }, null, 2));
} catch (error) {
  if (createdId) {
    await trashItemWithRetry(createdId).catch(() => undefined);
  }
  throw error;
}

async function ensureFolderPath(path) {
  let folders = await readFolders();
  let parent;
  let current;
  for (const segment of path) {
    current = findFolderByName(folders, segment);
    if (!current) {
      current = await eagleJson('/api/v2/folder/create', {
        method: 'POST',
        body: { name: segment, ...(parent ? { parent } : {}) },
      });
    }
    parent = current.id;
    folders = current.children || [];
  }
  return current.id;
}

async function readFolders() {
  const library = await eagleJson('/api/v2/library/info');
  if (Array.isArray(library?.folders)) return library.folders;
  const folders = await eagleJson('/api/v2/folder/get?limit=1000');
  return Array.isArray(folders?.data) ? folders.data : Array.isArray(folders) ? folders : [];
}

async function addSmokeBookmark(folderId, id) {
  const result = await eagleJson('/api/v2/item/add', {
    method: 'POST',
    body: {
      name: `Eagle Looms Write Smoke ${id}`,
      bookmarkURL: `https://eagle-looms.local/smoke/${id}`,
      website: `https://eagle-looms.local/smoke/${id}`,
      folders: [folderId],
      tags: ['eagle-looms', 'eagle-looms-smoke'],
      annotation: JSON.stringify({
        schema: 'eagle-looms/smoke/v1',
        id,
        createdAt: new Date().toISOString(),
      }),
    },
  });
  return extractItemId(result);
}

async function queryByRunId(id) {
  const result = await eagleJson('/api/v2/item/query', {
    method: 'POST',
    body: { query: `"${id}"`, limit: 20, offset: 0 },
  });
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

async function readItemInfo(id) {
  return eagleJson(`/api/item/info?id=${encodeURIComponent(id)}`);
}

async function cleanupStaleSmokeItems() {
  const rows = await queryByRunId('eagle-looms-smoke').catch(() => []);
  const staleIds = rows
    .filter((item) => Array.isArray(item.tags) && item.tags.includes('eagle-looms-smoke'))
    .filter((item) => !item.isDeleted)
    .map((item) => item.id)
    .filter(Boolean);
  for (const id of staleIds) {
    await trashItemWithRetry(id).catch(() => undefined);
  }
  return staleIds;
}

async function trashItem(id) {
  await eagleJson('/api/v2/item/update', {
    method: 'POST',
    body: { id, isDeleted: true },
  });
}

async function trashItemWithRetry(id) {
  let lastError;
  for (let i = 0; i < 10; i += 1) {
    try {
      await trashItem(id);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error(`Could not move smoke item to trash: ${id}`);
}

async function waitForCreated(id, runId) {
  for (let i = 0; i < 20; i += 1) {
    const row = await readItemInfo(id).catch(() => undefined);
    if (row?.annotation?.includes(runId)) return row;
    const rows = await queryByRunId(runId).catch(() => []);
    const match = rows.find((item) => item.id === id || item.annotation?.includes(runId));
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return undefined;
}

async function waitForTrash(id) {
  for (let i = 0; i < 15; i += 1) {
    const row = await readItemInfo(id).catch(() => undefined);
    if (!row || row.isDeleted) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function eagleJson(pathname, options = {}) {
  const response = await fetch(new URL(pathname, eagleBase), {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok || json?.status === 'error') {
    throw new Error(String(json?.message || response.statusText));
  }
  return json?.data ?? json;
}

function findFolderByName(folders, name) {
  return (folders || []).find((folder) => String(folder.name || '').trim().toLowerCase() === name.toLowerCase());
}

function extractItemId(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  if (payload.id) return String(payload.id);
  if (payload.itemId) return String(payload.itemId);
  if (Array.isArray(payload.ids)) return String(payload.ids[0] || '');
  if (Array.isArray(payload.itemIds)) return String(payload.itemIds[0] || '');
  if (Array.isArray(payload.data)) return extractItemId(payload.data[0]);
  if (Array.isArray(payload.items)) return extractItemId(payload.items[0]);
  if (payload.item) return extractItemId(payload.item);
  if (payload.data) return extractItemId(payload.data);
  return '';
}
