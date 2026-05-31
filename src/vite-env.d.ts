/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
//// <reference types="vite-plugin-monkey/global" />
declare const _VERSION_: string

declare function GM_xmlhttpRequest<TContext = unknown>(details: GMXmlHttpRequestDetails<TContext>): GMXmlHttpRequestControl;
declare function GM_getValue<T = unknown>(name: string, defaultValue?: T): T | Promise<T>;
declare function GM_setValue<T = unknown>(name: string, value: T): void | Promise<void>;
declare function GM_deleteValue(name: string): void | Promise<void>;

interface GMXmlHttpRequestDetails<TContext = unknown> {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string | FormData | Blob | ArrayBuffer | null;
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text' | 'document';
  timeout?: number;
  context?: TContext;
  onload?: (response: GMXmlHttpResponse<TContext>) => void;
  onerror?: (response: GMXmlHttpResponse<TContext>) => void;
  ontimeout?: (response: GMXmlHttpResponse<TContext>) => void;
  onabort?: (response: GMXmlHttpResponse<TContext>) => void;
}

interface GMXmlHttpResponse<TContext = unknown> {
  finalUrl: string;
  readyState: number;
  responseHeaders: string;
  responseText: string;
  response: unknown;
  status: number;
  statusText: string;
  context?: TContext;
}

interface GMXmlHttpRequestControl {
  abort: () => void;
}
