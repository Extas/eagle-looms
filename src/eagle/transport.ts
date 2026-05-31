export interface JsonRequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export async function requestJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const text = await requestText(url, {
    method: options.method || (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    timeoutMs: options.timeoutMs,
  });
  return JSON.parse(text) as T;
}

export async function requestText(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
} = {}): Promise<string> {
  if (hasGmXhr()) {
    return gmRequest<string>(url, {
      method: options.method || 'GET',
      headers: options.headers,
      data: options.body,
      responseType: 'text',
      timeout: options.timeoutMs || 45000,
    });
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

export async function requestArrayBuffer(url: string, headers: Record<string, string> = {}): Promise<ArrayBuffer> {
  if (hasGmXhr()) {
    return gmRequest<ArrayBuffer>(url, {
      method: 'GET',
      headers,
      responseType: 'arraybuffer',
      timeout: 90000,
    });
  }
  const response = await fetch(url, { credentials: 'include', headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function hasGmXhr(): boolean {
  return typeof GM_xmlhttpRequest === 'function';
}

function gmRequest<T>(url: string, details: {
  method: string;
  headers?: Record<string, string>;
  data?: string;
  responseType: 'text' | 'arraybuffer';
  timeout: number;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: details.method,
      url,
      headers: details.headers,
      data: details.data,
      responseType: details.responseType,
      timeout: details.timeout,
      onload: (response) => {
        if (response.status < 200 || response.status >= 300) {
          reject(new Error(`${response.status} ${response.statusText || 'request failed'}`));
          return;
        }
        resolve((details.responseType === 'arraybuffer' ? response.response : response.responseText) as T);
      },
      onerror: (response) => reject(new Error(`${response.status || 0} ${response.statusText || 'network error'}`)),
      ontimeout: () => reject(new Error('request timed out')),
      onabort: () => reject(new Error('request aborted')),
    });
  });
}

