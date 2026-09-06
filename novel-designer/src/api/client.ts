/* ============================================================
   砚墨 · 前端 — 后端请求客户端
   ------------------------------------------------------------
   统一走 /api（dev 由 Vite 代理到 :8787）。
   后端不可用时抛错，由调用方决定是否回落本地兜底。
   ============================================================ */
import type { ApiResponse } from '../types';

const BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: ApiResponse<T> & { message?: string };
  try {
    json = (await res.json()) as ApiResponse<T> & { message?: string };
  } catch {
    throw new ApiError(`响应不是合法 JSON（HTTP ${res.status}）`, res.status);
  }
  if (!res.ok || json.code !== 0) {
    throw new ApiError(json.message ?? `请求失败（HTTP ${res.status}）`, res.status);
  }
  return json.data;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return parse<T>(res);
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),

  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ---------------- SSE 流式 ---------------- */

export interface SseHandlers {
  onDelta?: (delta: string) => void;
  onDone?: (meta: { source?: string; error?: string | null }) => void;
  signal?: AbortSignal;
}

/** POST + 读取 SSE：逐段回调 onDelta，收到 [DONE] 结束 */
export async function streamPost(path: string, body: unknown, handlers: SseHandlers = {}): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });
  if (!res.ok || !res.body) {
    throw new ApiError(`流式请求失败（HTTP ${res.status}）`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') {
        handlers.onDone?.({});
        return;
      }
      try {
        const json = JSON.parse(payload) as { delta?: string; source?: string; error?: string | null };
        if (typeof json.delta === 'string') handlers.onDelta?.(json.delta);
        else handlers.onDone?.({ source: json.source, error: json.error ?? null });
      } catch {
        /* 忽略心跳行 */
      }
    }
  }
  handlers.onDone?.({});
}
