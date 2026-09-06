/* ============================================================
   砚墨 · 后端 — 数据访问层（SQLite ↔ JS 对象映射）
   ------------------------------------------------------------
   DB 用 snake_case，对外一律 camelCase。所有 patch 更新走字段白名单，
   杜绝把任意 key 拼进 SQL。动态行以 unknown 进入，经 str/num 收窄。
   ============================================================ */
import { db, displayNow, isoNow, tx } from './db.ts';
import {
  num,
  optNum,
  optStr,
  parseArr,
  str,
  toJsonText,
  type Character,
  type Chapter,
  type Plot,
  type PlotNode,
  type Project,
  type Row,
  type SqlValue,
  type TimelineEntry,
  type UsageStats,
  type World,
  type WorldItem,
} from './types.ts';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 取客户端给的 id（若为空或已占用则重新生成） */
function pickId(table: string, want: unknown, prefix: string): string {
  if (typeof want === 'string' && want.trim()) {
    const hit = db.prepare(`SELECT 1 AS x FROM ${table} WHERE id = ?`).get(want);
    if (!hit) return want;
  }
  return newId(prefix);
}

/** 把 patch 中出现的白名单字段拼成 SET 子句 */
function buildSet(
  allowed: Record<string, string>,
  patch: Record<string, unknown>,
): { clause: string; vals: SqlValue[] } {
  const cols: string[] = [];
  const vals: SqlValue[] = [];
  for (const key of Object.keys(patch)) {
    const col = allowed[key];
    if (!col) continue;
    cols.push(`${col} = ?`);
    vals.push(patch[key] as SqlValue);
  }
  return { clause: cols.join(', '), vals };
}

/* ---------------- project ---------------- */

const PROJECT_COLS: Record<string, string> = {
  title: 'title', genre: 'genre', tagline: 'tagline', synopsis: 'synopsis', cover: 'cover',
  wordCount: 'word_count', chapterCount: 'chapter_count', charCount: 'char_count',
  worldCount: 'world_count', streak: 'streak',
};

/** 当前活动作品 id：settings 里存的活动 id，缺省回落到最早创建的作品 */
export function getActiveProjectId(): string | null {
  const r = db.prepare(`SELECT value FROM settings WHERE key = 'active_project_id'`).get() as Row | undefined;
  const saved = r ? str(r.value) : '';
  if (saved) return saved;
  const first = db.prepare('SELECT id FROM projects ORDER BY created_at, rowid LIMIT 1').get() as Row | undefined;
  return first ? str(first.id) : null;
}

/** 切换活动作品；id 不存在时返回 false */
export function setActiveProjectId(id: string): boolean {
  const hit = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!hit) return false;
  db.prepare(
    `INSERT INTO settings (key,value,updated_at) VALUES ('active_project_id',?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(id, isoNow());
  return true;
}

export function getProject(): Project | null {
  const pid = getActiveProjectId();
  if (!pid) return null;
  const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid) as Row | undefined;
  if (!r) return null;
  return {
    id: str(r.id), title: str(r.title), genre: str(r.genre) || null, tagline: str(r.tagline),
    synopsis: str(r.synopsis), cover: str(r.cover), wordCount: num(r.word_count),
    chapterCount: num(r.chapter_count), charCount: num(r.char_count), worldCount: num(r.world_count),
    streak: num(r.streak), createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}

export function updateProject(patch: Record<string, unknown>): Project | null {
  const p = getProject();
  if (!p) return null;
  const { clause, vals } = buildSet(PROJECT_COLS, patch);
  if (!clause) return p;
  db.prepare(`UPDATE projects SET ${clause}, updated_at = ? WHERE id = ?`).run(...vals, displayNow(), p.id);
  return getProject();
}

/* ---------------- 多作品管理 ---------------- */

export interface ProjectMeta {
  id: string;
  title: string;
  genre: string | null;
  cover: string;
  updatedAt: string;
  chapterCount: number;
  charCount: number;
}

export function listProjects(): ProjectMeta[] {
  const rows = db
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM chapters c   WHERE c.project_id  = p.id) AS chapters_n,
              (SELECT COUNT(*) FROM characters ch WHERE ch.project_id = p.id) AS chars_n
       FROM projects p
       ORDER BY p.created_at, p.rowid`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: str(r.id), title: str(r.title), genre: str(r.genre) || null, cover: str(r.cover),
    updatedAt: str(r.updated_at), chapterCount: num(r.chapters_n), charCount: num(r.chars_n),
  }));
}

/** 新建作品：空章节/角色/时间线，自带三幕骨架与四个世界观分区，并立即切换为活动作品 */
export function createProject(patch: Record<string, unknown> = {}): Project {
  const id = newId('p');
  const title = optStr(patch.title, '未命名作品').trim() || '未命名作品';
  const now = displayNow();
  tx(() => {
    db.prepare(
      `INSERT INTO projects (id,title,genre,tagline,synopsis,cover,word_count,chapter_count,
                             char_count,world_count,streak,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(id, title, optStr(patch.genre, ''), optStr(patch.tagline, ''), optStr(patch.synopsis, ''),
      optStr(patch.cover, ''), 0, 0, 0, 0, 0, now, now);

    const actSt = db.prepare(
      `INSERT INTO plot_acts (id,project_id,name,phase,color,sort_order) VALUES (?,?,?,?,?,?)`,
    );
    [
      { name: '第一幕 · 开端', phase: '起', color: '#4C6AA0' },
      { name: '第二幕 · 发展', phase: '承', color: '#B58EC2' },
      { name: '第三幕 · 高潮与收束', phase: '转 · 合', color: '#E5533D' },
    ].forEach((a, i) => actSt.run(newId('act'), id, a.name, a.phase, a.color, i));

    const secSt = db.prepare(
      `INSERT INTO world_sections (id,project_id,type,title,"desc",sort_order) VALUES (?,?,?,?,?,?)`,
    );
    [
      { type: '地理', title: '地理与地标' },
      { type: '历史', title: '历史沿革' },
      { type: '势力', title: '组织与势力' },
      { type: '规则', title: '规则与禁忌' },
    ].forEach((s, i) => secSt.run(newId('ws'), id, s.type, s.title, '', i));

    setActiveProjectId(id);
  });
  const p = getProject();
  if (!p) throw new Error('创建作品失败');
  return p;
}

/** 删除作品及其全部数据；最后一本不可删；删的是活动作品时自动切到剩余最早一本 */
export function deleteProject(id: string): { ok: boolean; message?: string } {
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number };
  if (cnt.n <= 1) return { ok: false, message: '至少保留一本作品，无法删除' };
  const hit = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!hit) return { ok: false, message: '作品不存在' };
  tx(() => {
    // PRAGMA foreign_keys = ON：子表(章节/角色/世界/情节)随外键级联删除
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    if (getActiveProjectId() === id || !getActiveProjectId()) {
      const first = db.prepare('SELECT id FROM projects ORDER BY created_at, rowid LIMIT 1').get() as Row | undefined;
      if (first) setActiveProjectId(str(first.id));
    }
  });
  return { ok: true };
}

/* ---------------- chapters ---------------- */

const CHAPTER_COLS: Record<string, string> = {
  no: 'no', title: 'title', status: 'status', wordCount: 'word_count',
  updatedAt: 'updated_at', summary: 'summary', content: 'content',
};

function mapChapter(r: Row): Chapter {
  return {
    id: str(r.id), no: num(r.no), title: str(r.title), status: str(r.status),
    wordCount: num(r.word_count), updatedAt: str(r.updated_at),
    summary: str(r.summary), content: str(r.content),
  };
}

export function listChapters(): Chapter[] {
  const pid = getActiveProjectId();
  if (!pid) return [];
  return db
    .prepare('SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order, no')
    .all(pid)
    .map((r) => mapChapter(r as Row));
}

export function createChapter(patch: Record<string, unknown> = {}): Chapter | null {
  const project = getProject();
  if (!project) return null;
  const id = pickId('chapters', patch.id, 'ch');
  const { maxNo } = db
    .prepare('SELECT COALESCE(MAX(no),0) AS maxNo FROM chapters WHERE project_id = ?')
    .get(project.id) as { maxNo: number };
  const { maxSort } = db
    .prepare('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM chapters WHERE project_id = ?')
    .get(project.id) as { maxSort: number };
  db.prepare(
    `INSERT INTO chapters (id,project_id,no,title,status,word_count,updated_at,summary,content,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, project.id,
    optNum(patch.no, maxNo + 1),
    optStr(patch.title, '未命名章节'),
    optStr(patch.status, 'draft'),
    optNum(patch.wordCount, 0),
    optStr(patch.updatedAt, displayNow()),
    optStr(patch.summary, ''),
    optStr(patch.content, ''),
    maxSort + 1,
  );
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Row | undefined;
  return row ? mapChapter(row) : null;
}

export function updateChapter(id: string, patch: Record<string, unknown>): Chapter | null {
  const { clause, vals } = buildSet(CHAPTER_COLS, patch);
  if (!clause) return null;
  db.prepare(`UPDATE chapters SET ${clause} WHERE id = ?`).run(...vals, id);
  const r = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Row | undefined;
  return r ? mapChapter(r) : null;
}

export function deleteChapter(id: string): boolean {
  return db.prepare('DELETE FROM chapters WHERE id = ?').run(id).changes > 0;
}

/* ---------------- characters ---------------- */

const CHARACTER_COLS: Record<string, string> = {
  name: 'name', title: 'title', color: 'color', appearance: 'appearance', seed: 'seed',
  identity: 'identity', personality: 'personality', conflicts: 'conflicts', arc: 'arc', note: 'note',
};

function mapCharacter(r: Row): Character {
  return {
    id: str(r.id), name: str(r.name), title: str(r.title), color: str(r.color), tags: parseArr(r.tags),
    appearance: str(r.appearance), seed: num(r.seed), identity: str(r.identity), personality: str(r.personality),
    goals: parseArr(r.goals), conflicts: str(r.conflicts), arc: str(r.arc), note: str(r.note),
    relations: parseArr(r.relations),
  };
}

export function listCharacters(): Character[] {
  const pid = getActiveProjectId();
  if (!pid) return [];
  return db
    .prepare('SELECT * FROM characters WHERE project_id = ? ORDER BY sort_order')
    .all(pid)
    .map((r) => mapCharacter(r as Row));
}

export function createCharacter(data: Record<string, unknown> = {}): Character | null {
  const project = getProject();
  if (!project) return null;
  const id = pickId('characters', data.id, 'c');
  const { maxSeed } = db
    .prepare('SELECT COALESCE(MAX(seed),99) AS maxSeed FROM characters WHERE project_id = ?')
    .get(project.id) as { maxSeed: number };
  db.prepare(
    `INSERT INTO characters (id,project_id,name,title,color,appearance,seed,identity,personality,
                             conflicts,arc,note,tags,goals,relations,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, project.id,
    optStr(data.name, '未命名角色'), optStr(data.title, ''), optStr(data.color, ''), optStr(data.appearance, ''),
    optNum(data.seed, maxSeed + 1),
    optStr(data.identity, ''), optStr(data.personality, ''), optStr(data.conflicts, ''), optStr(data.arc, ''), optStr(data.note, ''),
    toJsonText(data.tags), toJsonText(data.goals), toJsonText(data.relations),
    0,
  );
  db.prepare('UPDATE characters SET sort_order = sort_order + 1 WHERE project_id = ?').run(project.id);
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Row | undefined;
  return row ? mapCharacter(row) : null;
}

export function updateCharacter(id: string, patch: Record<string, unknown>): Character | null {
  const sets: string[] = [];
  const vals: SqlValue[] = [];
  for (const key of Object.keys(CHARACTER_COLS)) {
    if (patch[key] !== undefined) {
      sets.push(`${CHARACTER_COLS[key]} = ?`);
      vals.push(patch[key] as SqlValue);
    }
  }
  if (Array.isArray(patch.tags)) { sets.push('tags = ?'); vals.push(toJsonText(patch.tags)); }
  if (Array.isArray(patch.goals)) { sets.push('goals = ?'); vals.push(toJsonText(patch.goals)); }
  if (Array.isArray(patch.relations)) { sets.push('relations = ?'); vals.push(toJsonText(patch.relations)); }
  if (!sets.length) return null;
  db.prepare(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  const r = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Row | undefined;
  return r ? mapCharacter(r) : null;
}

export function deleteCharacter(id: string): boolean {
  return db.prepare('DELETE FROM characters WHERE id = ?').run(id).changes > 0;
}

/* ---------------- world ---------------- */

export function getWorld(): World {
  const pid = getActiveProjectId();
  if (!pid) return { sections: [], timeline: [] };
  const sections = db
    .prepare('SELECT * FROM world_sections WHERE project_id = ? ORDER BY sort_order')
    .all(pid)
    .map((s) => {
      const row = s as Row;
      const items: WorldItem[] = db
        .prepare('SELECT * FROM world_items WHERE section_id = ? ORDER BY sort_order')
        .all(str(row.id))
        .map((i) => {
          const ir = i as Row;
          return { id: str(ir.id), title: str(ir.title), desc: str(ir.desc) };
        });
      return { id: str(row.id), type: str(row.type), title: str(row.title), desc: str(row.desc), items };
    });
  const timeline: TimelineEntry[] = db
    .prepare('SELECT * FROM timeline WHERE project_id = ? ORDER BY sort_order')
    .all(pid)
    .map((t) => {
      const row = t as Row;
      return { id: str(row.id), era: str(row.era), title: str(row.title), desc: str(row.desc), color: str(row.color) };
    });
  return { sections, timeline };
}

export function createWorldItem(sectionId: string, data: Record<string, unknown> = {}): WorldItem | null {
  const sec = db.prepare('SELECT id FROM world_sections WHERE id = ?').get(sectionId);
  if (!sec) return null;
  const id = pickId('world_items', data.id, 'wi');
  const { maxSort } = db
    .prepare('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM world_items WHERE section_id = ?')
    .get(sectionId) as { maxSort: number };
  db.prepare('INSERT INTO world_items (id,section_id,title,"desc",sort_order) VALUES (?,?,?,?,?)')
    .run(id, sectionId, optStr(data.title, ''), optStr(data.desc, ''), maxSort + 1);
  return { id, title: optStr(data.title, ''), desc: optStr(data.desc, '') };
}

export function deleteWorldItem(itemId: string): boolean {
  return db.prepare('DELETE FROM world_items WHERE id = ?').run(itemId).changes > 0;
}

/* ---------------- plot ---------------- */

const PLOT_NODE_COLS: Record<string, string> = {
  type: 'type', chapterNo: 'chapter_no', title: 'title', summary: 'summary',
  conflict: 'conflict', pov: 'pov', status: 'status',
};

function mapPlotNode(r: Row): PlotNode {
  return {
    id: str(r.id), type: str(r.type), chapterNo: num(r.chapter_no), title: str(r.title),
    summary: str(r.summary), conflict: str(r.conflict), pov: str(r.pov), status: str(r.status),
  };
}

export function getPlot(): Plot {
  const pid = getActiveProjectId();
  if (!pid) return { acts: [] };
  const acts = db
    .prepare('SELECT * FROM plot_acts WHERE project_id = ? ORDER BY sort_order')
    .all(pid)
    .map((a) => {
      const row = a as Row;
      const nodes: PlotNode[] = db
        .prepare('SELECT * FROM plot_nodes WHERE act_id = ? ORDER BY sort_order')
        .all(str(row.id))
        .map((n) => mapPlotNode(n as Row));
      return { id: str(row.id), name: str(row.name), phase: str(row.phase), color: str(row.color), nodes };
    });
  return { acts };
}

export function createPlotNode(actId: string, data: Record<string, unknown> = {}): PlotNode | null {
  const act = db.prepare('SELECT id FROM plot_acts WHERE id = ?').get(actId);
  if (!act) return null;
  const id = pickId('plot_nodes', data.id, 'pn');
  const { maxSort } = db
    .prepare('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM plot_nodes WHERE act_id = ?')
    .get(actId) as { maxSort: number };
  db.prepare(
    `INSERT INTO plot_nodes (id,act_id,type,chapter_no,title,summary,conflict,pov,status,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, actId, optStr(data.type, ''), optNum(data.chapterNo, 0), optStr(data.title, ''),
    optStr(data.summary, ''), optStr(data.conflict, ''), optStr(data.pov, ''), optStr(data.status, 'draft'), maxSort + 1,
  );
  const row = db.prepare('SELECT * FROM plot_nodes WHERE id = ?').get(id) as Row | undefined;
  return row ? mapPlotNode(row) : null;
}

export function updatePlotNode(nodeId: string, patch: Record<string, unknown>): PlotNode | null {
  const sets: string[] = [];
  const vals: SqlValue[] = [];
  /* 跨幕移动：patch.actId 与节点当前所在幕不同时，更新 act_id 并排到目标幕末尾 */
  if (typeof patch.actId === 'string' && patch.actId) {
    const cur = db.prepare('SELECT act_id FROM plot_nodes WHERE id = ?').get(nodeId) as Row | undefined;
    if (cur && str(cur.act_id) !== patch.actId) {
      const act = db.prepare('SELECT id FROM plot_acts WHERE id = ?').get(patch.actId);
      if (act) {
        const { maxSort } = db
          .prepare('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM plot_nodes WHERE act_id = ?')
          .get(patch.actId) as { maxSort: number };
        sets.push('act_id = ?', 'sort_order = ?');
        vals.push(patch.actId, maxSort + 1);
      }
    }
  }
  const { clause, vals: rest } = buildSet(PLOT_NODE_COLS, patch);
  if (clause) {
    sets.push(clause);
    vals.push(...rest);
  }
  if (!sets.length) return null;
  db.prepare(`UPDATE plot_nodes SET ${sets.join(', ')} WHERE id = ?`).run(...vals, nodeId);
  const r = db.prepare('SELECT * FROM plot_nodes WHERE id = ?').get(nodeId) as Row | undefined;
  if (!r) return null;
  return mapPlotNode(r);
}

export function deletePlotNode(nodeId: string): boolean {
  return db.prepare('DELETE FROM plot_nodes WHERE id = ?').run(nodeId).changes > 0;
}

/* ---------------- settings ---------------- */

export function getSetting(key: string, fallback: unknown = null): unknown {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined;
  if (!r) return fallback;
  try {
    return { ...(fallback ?? {}), ...JSON.parse(String(r.value)) };
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): unknown {
  db.prepare(
    `INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), isoNow());
  return getSetting(key, value);
}

/* ---------------- usage ---------------- */

export function recordUsage(action: string, tokens: number, cached = 0): void {
  db.prepare('INSERT INTO usage_events (ts,action,tokens,cached) VALUES (?,?,?,?)')
    .run(isoNow(), action, tokens, cached ? 1 : 0);
}

export function getUsage(): UsageStats {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const q = (from: string): { calls: number; tokens: number; cached: number } =>
    db
      .prepare(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(tokens),0) AS tokens,
                COALESCE(SUM(cached),0) AS cached FROM usage_events WHERE ts >= ?`,
      )
      .get(from) as { calls: number; tokens: number; cached: number };
  const d = q(dayStart);
  const m = q(monthStart);
  return {
    monthCalls: m.calls,
    monthTokens: m.tokens,
    dayCalls: d.calls,
    dayTokens: d.tokens,
    cached: m.calls ? Number((m.cached / m.calls).toFixed(2)) : 0,
  };
}

/* ---------------- 一键改名：活动作品内全文替换 ---------------- */

export interface RenameResult {
  chapters: number;
  characters: number;
  world: number;
  plot: number;
  timeline: number;
}

/**
 * 把活动作品里所有文本字段中的旧名替换为新名：
 * 章节（标题/摘要/正文）、角色卡（含其它角色描述里的提及）、世界观、情节、时间线。
 * SQLite REPLACE 为纯字符串替换；LIKE 带 % 通配，特殊字符（%/_）按字面量需 ESCAPE，人名场景可忽略。
 */
export function renameGlobally(from: string, to: string): RenameResult {
  const p = getProject();
  if (!p || !from || from === to) {
    return { chapters: 0, characters: 0, world: 0, plot: 0, timeline: 0 };
  }
  const like = `%${from}%`;
  const now = displayNow();

  const chapterRes = db
    .prepare(
      `UPDATE chapters SET
         title   = REPLACE(title,   ?, ?),
         summary = REPLACE(summary, ?, ?),
         content = REPLACE(content, ?, ?),
         updated_at = ?
       WHERE project_id = ? AND (title LIKE ? OR summary LIKE ? OR content LIKE ?)`,
    )
    .run(from, to, from, to, from, to, now, p.id, like, like, like);

  const charRes = db
    .prepare(
      `UPDATE characters SET
         name        = CASE WHEN name = ? THEN ? ELSE REPLACE(name, ?, ?) END,
         title       = REPLACE(title,       ?, ?),
         appearance  = REPLACE(appearance,  ?, ?),
         identity    = REPLACE(identity,    ?, ?),
         personality = REPLACE(personality, ?, ?),
         conflicts   = REPLACE(conflicts,   ?, ?),
         arc         = REPLACE(arc,         ?, ?),
         note        = REPLACE(note,        ?, ?),
         tags        = REPLACE(tags,        ?, ?),
         goals       = REPLACE(goals,       ?, ?)
       WHERE project_id = ? AND (name LIKE ? OR title LIKE ? OR appearance LIKE ? OR identity LIKE ?
         OR personality LIKE ? OR conflicts LIKE ? OR arc LIKE ? OR note LIKE ? OR tags LIKE ? OR goals LIKE ?)`,
    )
    .run(
      from, to, from, to,
      from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to, from, to,
      p.id, like, like, like, like, like, like, like, like, like, like,
    );

  const worldRes = db
    .prepare(
      `UPDATE world_items SET "desc" = REPLACE("desc", ?, ?)
       WHERE section_id IN (SELECT id FROM world_sections WHERE project_id = ?) AND "desc" LIKE ?`,
    )
    .run(from, to, p.id, like);

  const plotRes = db
    .prepare(
      `UPDATE plot_nodes SET
         title   = REPLACE(title,   ?, ?),
         summary = REPLACE(summary, ?, ?),
         conflict = REPLACE(conflict, ?, ?),
         pov     = REPLACE(pov,     ?, ?)
       WHERE act_id IN (SELECT id FROM plot_acts WHERE project_id = ?)
         AND (title LIKE ? OR summary LIKE ? OR conflict LIKE ? OR pov LIKE ?)`,
    )
    .run(from, to, from, to, from, to, from, to, p.id, like, like, like, like);

  const tlRes = db
    .prepare(
      `UPDATE timeline SET
         title = REPLACE(title, ?, ?),
         "desc" = REPLACE("desc", ?, ?)
       WHERE project_id = ? AND (title LIKE ? OR "desc" LIKE ?)`,
    )
    .run(from, to, from, to, p.id, like, like);

  return {
    chapters: Number(chapterRes.changes),
    characters: Number(charRes.changes),
    world: Number(worldRes.changes),
    plot: Number(plotRes.changes),
    timeline: Number(tlRes.changes),
  };
}

/* ---------------- 世界观导入（AI 提炼结果落库） ---------------- */

export interface WorldImportSection {
  type: string;
  title?: string;
  desc?: string;
  items: { title: string; desc?: string }[];
}

export interface WorldImportResult {
  sectionsCreated: number;
  itemsAdded: number;
  itemsSkipped: number;
}

/**
 * 把 AI 提炼出的世界观分区写入活动作品：
 * - 与现有分区「type」相同 → 追加条目到该分区（同名条目跳过）
 * - 全新 type → 新建分区再放条目
 */
export function importWorldSections(sections: WorldImportSection[]): WorldImportResult {
  const p = getProject();
  if (!p) return { sectionsCreated: 0, itemsAdded: 0, itemsSkipped: 0 };
  const result: WorldImportResult = { sectionsCreated: 0, itemsAdded: 0, itemsSkipped: 0 };

  tx(() => {
    const { maxSort } = db
      .prepare('SELECT COALESCE(MAX(sort_order),-1) AS maxSort FROM world_sections WHERE project_id = ?')
      .get(p.id) as { maxSort: number };

    for (const sec of sections) {
      const type = typeof sec?.type === 'string' ? sec.type.trim().slice(0, 20) : '';
      if (!type || !Array.isArray(sec.items)) continue;

      let target = db
        .prepare('SELECT id FROM world_sections WHERE project_id = ? AND type = ? LIMIT 1')
        .get(p.id, type) as { id: string } | undefined;
      if (!target) {
        const sid = newId('ws');
        db.prepare(
          `INSERT INTO world_sections (id,project_id,type,title,"desc",sort_order) VALUES (?,?,?,?,?,?)`,
        ).run(sid, p.id, type, (sec.title || type).slice(0, 40), (sec.desc || '').slice(0, 200), maxSort + 1 + result.sectionsCreated);
        target = { id: sid };
        result.sectionsCreated += 1;
      }

      const { maxItem } = db
        .prepare('SELECT COALESCE(MAX(sort_order),-1) AS maxItem FROM world_items WHERE section_id = ?')
        .get(target.id) as { maxItem: number };
      const existing = new Set(
        (db.prepare('SELECT title FROM world_items WHERE section_id = ?').all(target.id) as Row[]).map((r) => str(r.title)),
      );

      let sort = maxItem;
      for (const it of sec.items) {
        const t = typeof it?.title === 'string' ? it.title.trim().slice(0, 60) : '';
        if (!t) continue;
        if (existing.has(t)) {
          result.itemsSkipped += 1;
          continue;
        }
        sort += 1;
        db.prepare('INSERT INTO world_items (id,section_id,title,"desc",sort_order) VALUES (?,?,?,?,?)')
          .run(newId('wi'), target.id, t, (typeof it?.desc === 'string' ? it.desc.trim() : '').slice(0, 500), sort);
        existing.add(t);
        result.itemsAdded += 1;
      }
    }
  });
  return result;
}

/* ---------------- 世界观编辑 ---------------- */

/** 编辑分区（type/title/desc；type 改名时其下条目自动跟随，因为条目挂在分区 id 上） */
export function updateWorldSection(sectionId: string, patch: Record<string, unknown>): boolean {
  const sets: string[] = [];
  const vals: string[] = [];
  if (typeof patch.type === 'string' && patch.type.trim()) {
    sets.push('type = ?');
    vals.push(patch.type.trim().slice(0, 20));
  }
  if (typeof patch.title === 'string' && patch.title.trim()) {
    sets.push('title = ?');
    vals.push(patch.title.trim().slice(0, 40));
  }
  if (typeof patch.desc === 'string') {
    sets.push('"desc" = ?');
    vals.push(patch.desc.trim().slice(0, 200));
  }
  if (!sets.length) {
    return db.prepare('SELECT 1 FROM world_sections WHERE id = ?').get(sectionId) !== undefined;
  }
  vals.push(sectionId);
  return db
    .prepare(`UPDATE world_sections SET ${sets.join(', ')} WHERE id = ?`)
    .run(...vals).changes > 0;
}

/** 编辑条目（title/desc） */
export function updateWorldItem(itemId: string, patch: Record<string, unknown>): boolean {
  const sets: string[] = [];
  const vals: string[] = [];
  if (typeof patch.title === 'string' && patch.title.trim()) {
    sets.push('title = ?');
    vals.push(patch.title.trim().slice(0, 60));
  }
  if (typeof patch.desc === 'string') {
    sets.push('"desc" = ?');
    vals.push(patch.desc.trim().slice(0, 500));
  }
  if (!sets.length) {
    return db.prepare('SELECT 1 FROM world_items WHERE id = ?').get(itemId) !== undefined;
  }
  vals.push(itemId);
  return db
    .prepare(`UPDATE world_items SET ${sets.join(', ')} WHERE id = ?`)
    .run(...vals).changes > 0;
}
