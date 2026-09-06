/* ============================================================
   砚墨 · 小说设计器 — 后端服务（SQLite）
   ------------------------------------------------------------
   零第三方依赖：node:http + node:sqlite。
   启动：npm run server      （Node 22 需 --experimental-sqlite）
   数据文件：server/data/novel.db（首次启动自动建表 + 灌种子）
   ============================================================ */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { db, DB_PATH, ensureSeed } from './db.ts';
import * as repo from './repo.ts';
import { getLLMConfig, listModels, runAI, testConnection, extractEntities, extractWorld, extractPlot, PROVIDERS } from './llm.ts';
import {
  applyCors,
  createRouter,
  readJson,
  sendError,
  sendJson,
  sseEnd,
  sseHead,
  sseSend,
} from './http.ts';
import type { AIAction, ChatBody, ConnInput } from './types.ts';

const PORT = Number(process.env.PORT ?? 8787);

ensureSeed();

const router = createRouter();

/* ---------------- 健康检查 / 一次性引导 ---------------- */

router.get('/api/health', ({ res }) => {
  sendJson(res, { ok: true, db: DB_PATH, ts: new Date().toISOString() });
});

router.get('/api/bootstrap', ({ res }) => {
  sendJson(res, {
    project: repo.getProject(),
    activeProjectId: repo.getActiveProjectId(),
    projects: repo.listProjects(),
    chapters: repo.listChapters(),
    characters: repo.listCharacters(),
    world: repo.getWorld(),
    plot: repo.getPlot(),
    llm: getLLMConfig(),
    img: repo.getSetting('image'),
  });
});

/* ---------------- 作品（多书） ---------------- */

/** 新建作品（自动切换为当前作品） */
router.post('/api/projects', async ({ req, res }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const p = repo.createProject(body ?? {});
  sendJson(res, p, 201);
});

/** 切换当前作品 */
router.put('/api/projects/active', async ({ req, res }) => {
  const body = (await readJson(req)) as { id?: string };
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id || !repo.setActiveProjectId(id)) {
    sendError(res, '作品不存在', 404);
    return;
  }
  sendJson(res, { ok: true, activeProjectId: id });
});

/** 删除作品（级联删除其章节数据；最后一本不可删） */
router.delete('/api/projects/:id', ({ res, params }) => {
  const r = repo.deleteProject(params.id);
  if (r.ok) {
    sendJson(res, { ok: true, activeProjectId: repo.getActiveProjectId() });
  } else {
    sendError(res, r.message ?? '删除失败', 400);
  }
});

/* ---------------- 项目 ---------------- */

router.get('/api/project', ({ res }) => {
  const p = repo.getProject();
  if (p) {
    sendJson(res, p);
  } else {
    sendError(res, '项目不存在', 404);
  }
});

router.put('/api/project', async ({ req, res }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const p = repo.updateProject(patch ?? {});
  if (p) {
    sendJson(res, p);
  } else {
    sendError(res, '项目不存在', 404);
  }
});

/* ---------------- 章节 ---------------- */

router.get('/api/chapters', ({ res }) => sendJson(res, repo.listChapters()));

router.post('/api/chapters', async ({ req, res }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const c = repo.createChapter(body ?? {});
  if (c) {
    sendJson(res, c, 201);
  } else {
    sendError(res, '项目不存在', 404);
  }
});

router.patch('/api/chapters/:id', async ({ req, res, params }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const c = repo.updateChapter(params.id, patch ?? {});
  if (c) {
    sendJson(res, c);
  } else {
    sendError(res, '章节不存在', 404);
  }
});

router.delete('/api/chapters/:id', ({ res, params }) => {
  if (repo.deleteChapter(params.id)) {
    sendJson(res, { id: params.id });
  } else {
    sendError(res, '章节不存在', 404);
  }
});

/* ---------------- 角色 ---------------- */

router.get('/api/characters', ({ res }) => sendJson(res, repo.listCharacters()));

router.post('/api/characters', async ({ req, res }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const c = repo.createCharacter(body ?? {});
  if (c) {
    sendJson(res, c, 201);
  } else {
    sendError(res, '项目不存在', 404);
  }
});

router.patch('/api/characters/:id', async ({ req, res, params }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const c = repo.updateCharacter(params.id, patch ?? {});
  if (c) {
    sendJson(res, c);
  } else {
    sendError(res, '角色不存在', 404);
  }
});

router.delete('/api/characters/:id', ({ res, params }) => {
  if (repo.deleteCharacter(params.id)) {
    sendJson(res, { id: params.id });
  } else {
    sendError(res, '角色不存在', 404);
  }
});

/* 一键改名：活动作品内全文替换旧名 → 新名 */
router.post('/api/rename', async ({ req, res }) => {
  const body = (await readJson(req)) as { from?: unknown; to?: unknown };
  const from = typeof body?.from === 'string' ? body.from.trim() : '';
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  if (!from || !to || from === to) {
    sendError(res, '需要提供不同的旧名与新名', 400);
    return;
  }
  sendJson(res, repo.renameGlobally(from, to));
});

/* 从正文提取人物/势力（大模型；未配置时返回 ai:false） */
router.post('/api/extract', async ({ req, res }) => {
  const body = (await readJson(req)) as { text?: unknown };
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    sendJson(res, { ai: false, characters: [], factions: [], message: '正文为空' });
    return;
  }
  const found = await extractEntities(text);
  if (found.characters.length || found.factions.length) {
    sendJson(res, { ai: true, characters: found.characters, factions: found.factions });
  } else {
    sendJson(res, { ai: false, characters: [], factions: [], message: found.error ?? '未能识别出人物/势力' });
  }
});

/* 从长文本提炼世界观（仅解析返回，不落库；导入走 /api/world/import） */
router.post('/api/extract/world', async ({ req, res }) => {
  const body = (await readJson(req)) as { text?: unknown };
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    sendJson(res, { ai: false, sections: [], message: '文本为空' });
    return;
  }
  const r = await extractWorld(text);
  if (r.sections.length) {
    sendJson(res, { ai: true, sections: r.sections });
  } else {
    sendJson(res, { ai: false, sections: [], message: r.error ?? '提炼失败' });
  }
});

/* 从文本提炼情节节拍（仅解析返回，不落库；导入复用现有新增节拍链路） */
router.post('/api/extract/plot', async ({ req, res }) => {
  const body = (await readJson(req)) as { text?: unknown };
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    sendJson(res, { ai: false, beats: [], message: '文本为空' });
    return;
  }
  const acts = repo.getPlot().acts.map((a) => ({ name: a.name, phase: a.phase }));
  const r = await extractPlot(text, acts);
  if (r.beats.length) {
    sendJson(res, { ai: true, beats: r.beats });
  } else {
    sendJson(res, { ai: false, beats: [], message: r.error ?? '提炼失败' });
  }
});

/* ---------------- 世界观 ---------------- */

router.get('/api/world', ({ res }) => sendJson(res, repo.getWorld()));

router.post('/api/world/sections/:sectionId/items', async ({ req, res, params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const item = repo.createWorldItem(params.sectionId, body ?? {});
  if (item) {
    sendJson(res, item, 201);
  } else {
    sendError(res, '世界观分区不存在', 404);
  }
});

/* 编辑分区（分类名/标题/概述） */
router.put('/api/world/sections/:id', async ({ req, res, params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  if (repo.updateWorldSection(params.id, body ?? {})) {
    sendJson(res, { id: params.id });
  } else {
    sendError(res, '世界观分区不存在', 404);
  }
});

/* 编辑条目（标题/描述） */
router.put('/api/world/items/:id', async ({ req, res, params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  if (repo.updateWorldItem(params.id, body ?? {})) {
    sendJson(res, { id: params.id });
  } else {
    sendError(res, '条目不存在', 404);
  }
});

router.delete('/api/world/items/:itemId', ({ res, params }) => {
  if (repo.deleteWorldItem(params.itemId)) {
    sendJson(res, { id: params.itemId });
  } else {
    sendError(res, '条目不存在', 404);
  }
});

/* 批量导入世界观分区/条目（AI 提炼结果落库；按 type 合并、同名去重） */
router.post('/api/world/import', async ({ req, res }) => {
  const body = (await readJson(req)) as { sections?: unknown };
  const raw = Array.isArray(body?.sections) ? body.sections : [];
  const sections = raw as repo.WorldImportSection[];
  if (!sections.length) {
    sendError(res, '没有可导入的分区', 400);
    return;
  }
  sendJson(res, repo.importWorldSections(sections));
});

/* ---------------- 情节 ---------------- */

router.get('/api/plot', ({ res }) => sendJson(res, repo.getPlot()));

router.post('/api/plot/acts/:actId/nodes', async ({ req, res, params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const node = repo.createPlotNode(params.actId, body ?? {});
  if (node) {
    sendJson(res, node, 201);
  } else {
    sendError(res, '幕不存在', 404);
  }
});

router.patch('/api/plot/nodes/:nodeId', async ({ req, res, params }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const n = repo.updatePlotNode(params.nodeId, patch ?? {});
  if (n) {
    sendJson(res, n);
  } else {
    sendError(res, '节拍不存在', 404);
  }
});

router.delete('/api/plot/nodes/:nodeId', ({ res, params }) => {
  if (repo.deletePlotNode(params.nodeId)) {
    sendJson(res, { id: params.nodeId });
  } else {
    sendError(res, '节拍不存在', 404);
  }
});

/* ---------------- 设置 ---------------- */

router.get('/api/settings/llm', ({ res }) => sendJson(res, getLLMConfig()));

router.put('/api/settings/llm', async ({ req, res }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const next = repo.setSetting('llm', { ...getLLMConfig(), ...(patch ?? {}) });
  sendJson(res, next);
});

router.get('/api/settings/image', ({ res }) => sendJson(res, repo.getSetting('image')));

router.put('/api/settings/image', async ({ req, res }) => {
  const patch = (await readJson(req)) as Record<string, unknown>;
  const current = repo.getSetting('image') as Record<string, unknown> | null;
  const next = repo.setSetting('image', { ...(current ?? {}), ...(patch ?? {}) });
  sendJson(res, next);
});

/* ---------------- 大模型 ---------------- */

router.get('/api/llm/providers', ({ res }) => sendJson(res, PROVIDERS));

router.get('/api/llm/models', async ({ res, query }) => {
  sendJson(res, await listModels(query.get('provider') ?? ''));
});

router.post('/api/llm/test', async ({ req, res }) => {
  const body = (await readJson(req)) as ConnInput;
  sendJson(res, await testConnection(body ?? {}));
});

/** 流式创作：SSE，逐段推 {delta}，结束推 [DONE] */
router.post('/api/llm/chat', async ({ req, res }) => {
  let body: ChatBody;
  try {
    body = (await readJson(req)) as ChatBody;
  } catch (e) {
    return sendError(res, e instanceof Error ? e.message : String(e), 400);
  }

  const action = (body?.action ?? 'continue') as AIAction;
  const ctx = body?.context ?? {};

  sseHead(res);
  try {
    const { source, error } = await runAI(action, ctx, (delta) => sseSend(res, { delta }));
    sseSend(res, { source, error: error ?? null });
    sseEnd(res);
  } catch (e) {
    sseSend(res, { error: e instanceof Error ? e.message : String(e) });
    sseEnd(res);
  }
});

router.get('/api/llm/usage', ({ res }) => sendJson(res, repo.getUsage()));

/* ---------------- 文生图（免费端点 Pollinations + 本机后端代理，同源无跨域） ---------------- */

const IMG_SIZE_MAP: Record<string, [number, number]> = {
  square_hd: [1024, 1024],
  square: [512, 512],
  portrait_4_3: [768, 1024],
  portrait_16_9: [576, 1024],
  landscape_4_3: [1024, 768],
  landscape_16_9: [1024, 576],
};

function pollinationsUrl(prompt: string, size: string, seed: number): string {
  const [w, h] = IMG_SIZE_MAP[size] ?? [1024, 1024];
  const p = encodeURIComponent(prompt.slice(0, 1800));
  return `https://image.pollinations.ai/prompt/${p}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
}

router.get('/api/image', async ({ res, query }) => {
  const prompt = (query.get('prompt') ?? '').trim();
  if (!prompt) {
    sendError(res, '缺少 prompt 参数', 400);
    return;
  }
  const size = query.get('size') ?? 'square_hd';
  const seed = Number(query.get('seed')) || 7;
  try {
    const t0 = Date.now();
    const up = await fetch(pollinationsUrl(prompt, size, seed), {
      signal: AbortSignal.timeout(90_000),
    });
    const ctype = up.headers.get('content-type') ?? '';
    if (!up.ok || !ctype.startsWith('image/')) {
      sendError(res, `上游图片服务异常（HTTP ${up.status}）`, 502);
      return;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': ctype,
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(buf);
    console.log(`[砚墨] 文生图    ${size} · ${Date.now() - t0}ms · ${buf.byteLength}B`);
  } catch (e) {
    sendError(res, `文生图失败：${e instanceof Error ? e.message : String(e)}`, 502);
  }
});

router.post('/api/image/test', async ({ res }) => {
  try {
    const t0 = Date.now();
    const up = await fetch(pollinationsUrl('ink connection test', 'square', 7), {
      signal: AbortSignal.timeout(30_000),
    });
    const ok = up.ok && (up.headers.get('content-type') ?? '').startsWith('image/');
    if (ok) {
      sendJson(res, {
        ok: true,
        latency: Date.now() - t0,
        message: '文生图服务可用（Pollinations 免费端点，经本机后端代理）',
      });
    } else {
      sendJson(res, { ok: false, message: `文生图服务异常（HTTP ${up.status}）` });
    }
  } catch (e) {
    sendJson(res, { ok: false, message: `文生图服务不可达：${e instanceof Error ? e.message : String(e)}` });
  }
});

/* ---------------- 启动 ---------------- */

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (applyCors(req, res)) return;
  if (await router.dispatch(req, res)) return;
  sendError(res, `未找到路由：${req.method ?? ''} ${req.url ?? ''}`, 404);
});

server.listen(PORT, () => {
  const countOf = (table: string): number =>
    Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() ?? { n: 0 }).n);
  const counts = {
    chapters: countOf('chapters'),
    characters: countOf('characters'),
    worlds: countOf('world_items'),
    nodes: countOf('plot_nodes'),
  };
  console.log(`[砚墨] 后端已启动  http://localhost:${PORT}`);
  console.log(`[砚墨] SQLite     ${DB_PATH}`);
  console.log(
    `[砚墨] 数据       章节 ${counts.chapters} · 角色 ${counts.characters} · 世界观条目 ${counts.worlds} · 情节节拍 ${counts.nodes}`,
  );
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
