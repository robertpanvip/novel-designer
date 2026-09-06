/* ============================================================
   砚墨 · 后端 — 极简 HTTP 工具（零依赖）
   ------------------------------------------------------------
   只做三件事：JSON 收发、:param 路由、SSE 推送。
   想换 Express 时只需替换本文件与 index.ts 的装配部分。
   ============================================================ */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URLSearchParams } from 'node:url';

const MAX_BODY = 4 * 1024 * 1024; // 4MB，正文可能很长

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
}

export type Handler = (ctx: RouteContext) => void | Promise<void>;

export interface Route {
  method: string;
  path: string;
  handler: Handler;
}

export interface Router {
  get(path: string, handler: Handler): void;
  post(path: string, handler: Handler): void;
  put(path: string, handler: Handler): void;
  patch(path: string, handler: Handler): void;
  delete(path: string, handler: Handler): void;
  dispatch(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}

export function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify({ code: 0, data });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(res: ServerResponse, message: string, status = 400): void {
  const body = JSON.stringify({ code: status, data: null, message });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/* ---------------- 路由 ---------------- */

export function createRouter(): Router {
  const routes: Route[] = [];

  const add = (method: string, path: string, handler: Handler): void => {
    routes.push({ method, path, handler });
  };

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),

    async dispatch(req, res) {
      const url = new URL(req.url ?? '', 'http://localhost');
      const segs = url.pathname.split('/').filter(Boolean);

      for (const r of routes) {
        if (r.method !== req.method) continue;
        const pat = r.path.split('/').filter(Boolean);
        if (pat.length !== segs.length) continue;

        const params: Record<string, string> = {};
        let ok = true;
        for (let i = 0; i < pat.length; i++) {
          if (pat[i].startsWith(':')) {
            params[pat[i].slice(1)] = decodeURIComponent(segs[i]);
          } else if (pat[i] !== segs[i]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        try {
          await r.handler({ req, res, params, query: url.searchParams });
        } catch (e) {
          sendError(res, e instanceof Error ? e.message : String(e), 500);
        }
        return true;
      }
      return false;
    },
  };
}

/* ---------------- SSE ---------------- */

export function sseHead(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

export function sseSend(res: ServerResponse, obj: unknown): void {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

export function sseEnd(res: ServerResponse): void {
  res.write('data: [DONE]\n\n');
  res.end();
}
