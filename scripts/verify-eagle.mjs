const eagleBase = (process.env.EAGLE_API_BASE || 'http://localhost:41595').replace(/\/$/, '');

const app = await eagleJson('/api/v2/app/info');
const library = await eagleJson('/api/v2/library/info');
const folders = Array.isArray(library?.folders) ? library.folders : [];

console.log(JSON.stringify({
  source: eagleBase,
  app,
  library: {
    rootFolders: folders.length,
    firstRootFolder: folders[0]?.name || folders[0]?.id || null,
  },
}, null, 2));

async function eagleJson(pathname) {
  const response = await fetch(new URL(pathname, eagleBase));
  const json = await response.json();
  if (!response.ok || json?.status === 'error') {
    throw new Error(String(json?.message || response.statusText));
  }
  return json?.data ?? json;
}
