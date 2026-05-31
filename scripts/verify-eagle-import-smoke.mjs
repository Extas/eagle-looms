const eagleBase = (process.env.EAGLE_API_BASE || 'http://localhost:41595').replace(/\/$/, '');
const smokePath = ['Eagle Looms', '_Smoke', 'import-smoke'];
const smokeTag = 'eagle-looms-import-smoke';
const runId = `import-smoke-${Date.now()}`;
const pixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
let createdId = '';
let lastReadDebug;

try {
  const preCleanedSmokeIds = await cleanupStaleSmokeItems();
  const folderId = await ensureFolderPath(smokePath);
  createdId = await addSmokeImage(folderId, runId);
  if (!createdId) throw new Error('item/add did not return an item id for image smoke.');
  const readBack = await waitForCreated(createdId, runId);
  if (!readBack || readBack.isDeleted || !readBack.annotation?.includes(runId)) {
    throw new Error(`Created image smoke item did not round-trip through item/info. ${JSON.stringify({ createdId, lastReadDebug })}`);
  }
  if (!Array.isArray(readBack.tags) || !readBack.tags.includes(smokeTag)) {
    throw new Error('Created image smoke item did not preserve smoke tag.');
  }
  for (const tag of ['eagle-looms', 'site:smoke.local', 'gallery:import-smoke', 'chapter:default', 'ext:png', 'mime:image/png']) {
    if (!readBack.tags.includes(tag)) {
      throw new Error(`Created image smoke item did not preserve required organization tag: ${tag}`);
    }
  }
  if (!readBack.annotation.includes('"sourceTags":["source:smoke","post:import-smoke"]')) {
    throw new Error('Created image smoke item did not preserve sourceTags in annotation JSON.');
  }
  await trashItemWithRetry(createdId);
  const trashed = await waitForTrash(createdId);
  if (!trashed) throw new Error(`Image smoke item was not moved to trash: ${createdId}`);

  console.log(JSON.stringify({
    source: eagleBase,
    folderPath: smokePath.join('/'),
    createdId,
    preCleanedSmokeIds,
    cleanup: 'moved-created-image-smoke-item-to-trash',
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

async function addSmokeImage(folderId, id) {
  const body = {
    name: `Eagle Looms Import Smoke ${id}.png`,
    base64: pixelPngBase64,
    website: `https://eagle-looms.local/import-smoke/${id}`,
    folders: [folderId],
    tags: [
      'eagle-looms',
      smokeTag,
      'site:smoke.local',
      'gallery:import-smoke',
      'chapter:default',
      'ext:png',
      'mime:image/png',
      'source:smoke',
      'post:import-smoke',
    ],
    annotation: [
      'Imported by Eagle Looms',
      `Smoke run: ${id}`,
      '',
      '```eagle-looms-json',
      JSON.stringify({
        schema: 'eagle-looms/import-smoke/v1',
        id,
        stableKey: `eagle-looms:import-smoke:${id}`,
        sourceTags: ['source:smoke', 'post:import-smoke'],
        createdAt: new Date().toISOString(),
      }),
      '```',
    ].join('\n'),
  };

  try {
    return extractItemId(await eagleJson('/api/v2/item/add', {
      method: 'POST',
      body: {
        ...body,
        base64: `data:image/png;base64,${pixelPngBase64}`,
      },
    }));
  } catch (error) {
    return extractItemId(await eagleJson('/api/v2/item/add', {
      method: 'POST',
      body,
    }));
  }
}

async function queryByText(text) {
  const result = await eagleJson('/api/v2/item/query', {
    method: 'POST',
    body: { query: `"${text}"`, limit: 20, offset: 0 },
  });
  return rows(result);
}

async function readItemInfo(id) {
  const result = await eagleJson('/api/v2/item/get', {
    method: 'POST',
    body: { id, limit: 1 },
  });
  if (Array.isArray(result)) return result.find((item) => item.id === id) || result[0];
  if (result?.id) return result;
  const items = rows(result);
  return items.find((item) => item.id === id) || items[0];
}

async function cleanupStaleSmokeItems() {
  const rows = await queryByText(smokeTag).catch(() => []);
  const staleIds = rows
    .filter((item) => Array.isArray(item.tags) && item.tags.includes(smokeTag))
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
  throw lastError || new Error(`Could not move image smoke item to trash: ${id}`);
}

async function waitForCreated(id, text) {
  for (let i = 0; i < 20; i += 1) {
    const row = await readItemInfo(id).catch(() => undefined);
    lastReadDebug = summarizeItem(row);
    if (row?.annotation?.includes(text)) return row;
    const rows = await queryByText(text).catch(() => []);
    const match = rows.find((item) => item.id === id || item.annotation?.includes(text));
    if (match) lastReadDebug = summarizeItem(match);
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

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function summarizeItem(item) {
  if (!item) return undefined;
  return {
    id: item.id,
    name: item.name,
    annotation: item.annotation,
    website: item.website,
    tags: item.tags,
    isDeleted: item.isDeleted,
    keys: Object.keys(item).slice(0, 20),
  };
}
