const eagleBase = (process.env.EAGLE_API_BASE || 'http://localhost:41595').replace(/\/$/, '');
const smokeTag = 'eagle-looms-smoke';
const smokeWebsitePrefix = 'https://eagle-looms.local/smoke/';
const smokeSchema = 'eagle-looms/smoke/v1';
const runId = `write-smoke-${Date.now()}`;
let createdId = '';

try {
  const preCleanedSmokeIds = await cleanupStaleSmokeItems();
  createdId = await addSmokeBookmark(runId);
  if (!createdId) throw new Error('item/add did not return an item id.');
  const readBack = await waitForCreated(createdId, runId);
  if (!readBack || readBack.isDeleted || !readBack.annotation?.includes(runId)) {
    throw new Error('Created smoke item did not round-trip through item/info.');
  }
  if (!Array.isArray(readBack.folders) || readBack.folders.length > 0) {
    throw new Error('Created smoke item should remain unfiled.');
  }
  await trashItemWithRetry(createdId);
  const trashed = await waitForTrash(createdId);
  if (!trashed) throw new Error(`Smoke item was not moved to trash: ${createdId}`);

  console.log(JSON.stringify({
    source: eagleBase,
    storage: 'unfiled',
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

async function addSmokeBookmark(id) {
  const smokeUrl = `${smokeWebsitePrefix}${id}`;
  const result = await eagleJson('/api/v2/item/add', {
    method: 'POST',
    body: {
      name: `Eagle Looms Write Smoke ${id}`,
      bookmarkURL: smokeUrl,
      website: smokeUrl,
      tags: [smokeTag],
      annotation: JSON.stringify({
        schema: smokeSchema,
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
  const rows = await queryByRunId(smokeTag).catch(() => []);
  const staleIds = [];
  for (const item of rows) {
    const hydrated = item?.id ? await readItemInfo(item.id).catch(() => item) : item;
    const id = hydrated?.id || item?.id;
    if (id && isManagedSmokeItem(hydrated) && !hydrated.isDeleted) {
      staleIds.push(id);
    }
  }
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

function isManagedSmokeItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (!Array.isArray(item.tags) || !item.tags.includes(smokeTag)) return false;
  if (typeof item.website !== 'string' || !item.website.startsWith(smokeWebsitePrefix)) return false;
  const annotation = parseJsonAnnotation(item.annotation);
  return annotation?.schema === smokeSchema && typeof annotation.id === 'string';
}

function parseJsonAnnotation(annotation) {
  if (typeof annotation !== 'string') return undefined;
  try {
    const parsed = JSON.parse(annotation);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
