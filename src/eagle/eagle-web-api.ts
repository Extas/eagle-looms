import { EAGLE_BASE_URL, type EagleFolder, type EagleItem } from '../types';
import { requestJson } from './transport';
import { normalizeEagleBaseUrl } from './options';

interface EagleEnvelope<T> {
  status?: 'success' | 'error';
  message?: string;
  data?: T;
}

interface Paged<T> {
  data?: T[];
  items?: T[];
  total?: number;
  totalCount?: number;
}

export interface AddItemInput {
  id?: string;
  name: string;
  url?: string;
  base64?: string;
  path?: string;
  bookmarkURL?: string;
  tags?: string[];
  folders?: string[];
  annotation?: string;
  website?: string;
}

export class EagleWebApi {
  readonly baseUrl: string;

  constructor(baseUrl = EAGLE_BASE_URL) {
    this.baseUrl = normalizeEagleBaseUrl(baseUrl);
  }

  async probe(): Promise<{ app: unknown; library: unknown }> {
    const [app, library] = await Promise.all([
      this.get('/api/v2/app/info'),
      this.get('/api/v2/library/info'),
    ]);
    return { app, library };
  }

  async libraryInfo(): Promise<{ folders: EagleFolder[] }> {
    const data = await this.get<{ folders?: EagleFolder[] }>('/api/v2/library/info');
    return { folders: data.folders || [] };
  }

  async getFolders(): Promise<EagleFolder[]> {
    const fromLibrary = await this.libraryInfo().catch(() => ({ folders: [] }));
    if (fromLibrary.folders.length) return fromLibrary.folders;
    const data = await this.get<Paged<EagleFolder>>('/api/v2/folder/get?limit=1000');
    return unwrapRows(data);
  }

  async createFolder(name: string, parent?: string): Promise<EagleFolder> {
    return this.post<EagleFolder>('/api/v2/folder/create', {
      name,
      ...(parent ? { parent } : {}),
    });
  }

  async queryItems(query: string, limit = 20): Promise<EagleItem[]> {
    const data = await this.post<Paged<EagleItem>>('/api/v2/item/query', { query, limit, offset: 0 });
    return unwrapRows(data).filter((item) => !item.isDeleted);
  }

  async itemInfo(id: string): Promise<EagleItem> {
    const itemId = id.trim();
    if (!itemId) throw new Error('missing Eagle item id');
    const fields = [
      'id',
      'name',
      'ext',
      'url',
      'website',
      'tags',
      'folders',
      'annotation',
      'fileURL',
      'fileUrl',
      'filePath',
      'thumbnailURL',
      'thumbnailUrl',
      'thumbnailPath',
      'width',
      'height',
      'size',
      'isDeleted',
    ];
    const data = await this.post<Paged<EagleItem> | EagleItem[] | EagleItem>('/api/v2/item/get', {
      id: itemId,
      limit: 1,
      fields,
    });
    const item = firstItem(data, itemId);
    if (!item) throw new Error(`Eagle item not found: ${itemId}`);
    return item;
  }

  async addItem(item: AddItemInput): Promise<string> {
    const data = await this.post<unknown>('/api/v2/item/add', item);
    return extractEagleItemId(data);
  }

  async addItems(items: AddItemInput[]): Promise<string[]> {
    const data = await this.post<unknown>('/api/v2/item/add', { items });
    return extractEagleItemIds(data);
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = eagleApiRequestUrl(this.baseUrl, path);
    const envelope = await requestJson<EagleEnvelope<T> | T>(url, { method, body });
    if (isEnvelope(envelope)) {
      if (envelope.status === 'error') throw new Error(envelope.message || 'Eagle API error');
      return (envelope.data ?? envelope) as T;
    }
    return envelope as T;
  }
}

export function eagleApiRequestUrl(baseUrl: string, path: string): string {
  const base = new URL(normalizeEagleBaseUrl(baseUrl));
  const url = new URL(path, base.origin);
  const token = base.searchParams.get('token');
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function isEnvelope<T>(value: EagleEnvelope<T> | T): value is EagleEnvelope<T> {
  return Boolean(value && typeof value === 'object' && 'status' in value);
}

function unwrapRows<T>(payload: Paged<T> | T[]): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function firstItem(payload: Paged<EagleItem> | EagleItem[] | EagleItem, id: string): EagleItem | undefined {
  if (Array.isArray(payload)) return payload.find((item) => item.id === id) || payload[0];
  if (Array.isArray((payload as Paged<EagleItem>).data)) {
    return (payload as Paged<EagleItem>).data!.find((item) => item.id === id) || (payload as Paged<EagleItem>).data![0];
  }
  if (Array.isArray((payload as Paged<EagleItem>).items)) {
    return (payload as Paged<EagleItem>).items!.find((item) => item.id === id) || (payload as Paged<EagleItem>).items![0];
  }
  if ((payload as EagleItem).id) return payload as EagleItem;
  return undefined;
}

export function extractEagleItemIds(payload: unknown): string[] {
  if (Array.isArray(payload)) return payload.map(extractEagleItemId).filter(Boolean);
  if (Array.isArray((payload as { ids?: unknown[] })?.ids)) {
    return (payload as { ids: unknown[] }).ids.map(String);
  }
  if (Array.isArray((payload as { itemIds?: unknown[] })?.itemIds)) {
    return (payload as { itemIds: unknown[] }).itemIds.map(String);
  }
  if (Array.isArray((payload as { items?: unknown[] })?.items)) {
    return (payload as { items: unknown[] }).items.map(extractEagleItemId).filter(Boolean);
  }
  if ((payload as { data?: unknown })?.data) return extractEagleItemIds((payload as { data: unknown }).data);
  const id = extractEagleItemId(payload);
  return id ? [id] : [];
}

export function extractEagleItemId(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  const item = payload as Record<string, unknown>;
  if (item.id) return String(item.id);
  if (item.itemId) return String(item.itemId);
  if (Array.isArray(item.ids)) return String(item.ids[0] || '');
  if (Array.isArray(item.itemIds)) return String(item.itemIds[0] || '');
  if (Array.isArray(item.data)) return extractEagleItemId(item.data[0]);
  if (Array.isArray(item.items)) return extractEagleItemId(item.items[0]);
  if (item.item) return extractEagleItemId(item.item);
  if (item.data) return extractEagleItemId(item.data);
  return '';
}

export function extractEagleLibraryName(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as { name?: unknown; data?: unknown };
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
  return value.data ? extractEagleLibraryName(value.data) : '';
}
