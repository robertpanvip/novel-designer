/* ============================================================
   砚墨 · 后端 — SQLite 连接 / 建表 / 种子注入
   ------------------------------------------------------------
   使用 Node 内置 node:sqlite（DatabaseSync），零第三方依赖。
   Node 22 需 --experimental-sqlite 启动（见 package.json scripts）。
   ============================================================ */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SeedShape } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** 数据目录：默认 server/data；可用 NOVEL_DATA_DIR 指到别处（测试隔离/多实例） */
const DATA_DIR = process.env.NOVEL_DATA_DIR || join(HERE, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, 'novel.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* ---------------- 建表 ---------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  genre         TEXT,
  tagline       TEXT,
  synopsis      TEXT,
  cover         TEXT,
  word_count    INTEGER NOT NULL DEFAULT 0,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  char_count    INTEGER NOT NULL DEFAULT 0,
  world_count   INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  no          INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  word_count  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT,
  summary     TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);

CREATE TABLE IF NOT EXISTS characters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '',
  appearance  TEXT NOT NULL DEFAULT '',
  seed        INTEGER NOT NULL DEFAULT 0,
  identity    TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  conflicts   TEXT NOT NULL DEFAULT '',
  arc         TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  goals       TEXT NOT NULL DEFAULT '[]',
  relations   TEXT NOT NULL DEFAULT '[]',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

CREATE TABLE IF NOT EXISTS world_sections (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  "desc"     TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS world_items (
  id         TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES world_sections(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  "desc"     TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_world_items_section ON world_items(section_id);

CREATE TABLE IF NOT EXISTS timeline (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  era        TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  "desc"     TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plot_acts (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  phase      TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plot_nodes (
  id         TEXT PRIMARY KEY,
  act_id     TEXT NOT NULL REFERENCES plot_acts(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT '',
  chapter_no INTEGER NOT NULL DEFAULT 0,
  title      TEXT NOT NULL DEFAULT '',
  summary    TEXT NOT NULL DEFAULT '',
  conflict   TEXT NOT NULL DEFAULT '',
  pov        TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plot_nodes_act ON plot_nodes(act_id);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS usage_events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT '',
  tokens INTEGER NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_events(ts);
`);

/* ---------------- 工具 ---------------- */

/** 与前端保持一致的展示时间：2026-9-6 09:12:33 */
export function displayNow(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function tx(fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/* ---------------- 种子注入 ---------------- */

function readSeed(): SeedShape {
  return JSON.parse(readFileSync(join(ROOT, 'shared', 'seed.json'), 'utf8')) as SeedShape;
}

function insertProject(s: SeedShape['project']): void {
  db.prepare(
    `INSERT INTO projects (id,title,genre,tagline,synopsis,cover,word_count,chapter_count,
                           char_count,world_count,streak,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    s.id, s.title, s.genre, s.tagline, s.synopsis, s.cover,
    s.wordCount, s.chapterCount, s.charCount, s.worldCount, s.streak,
    s.createdAt, s.updatedAt,
  );
}

function insertChapters(pid: string, chapters: SeedShape['chapters']): void {
  const st = db.prepare(
    `INSERT INTO chapters (id,project_id,no,title,status,word_count,updated_at,summary,content,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  chapters.forEach((c, i) =>
    st.run(c.id, pid, c.no, c.title, c.status, c.wordCount, c.updatedAt, c.summary, c.content, i),
  );
}

function insertCharacters(pid: string, characters: SeedShape['characters']): void {
  const st = db.prepare(
    `INSERT INTO characters (id,project_id,name,title,color,appearance,seed,identity,personality,
                             conflicts,arc,note,tags,goals,relations,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  characters.forEach((c, i) =>
    st.run(
      c.id, pid, c.name, c.title, c.color, c.appearance, c.seed,
      c.identity, c.personality, c.conflicts, c.arc, c.note,
      JSON.stringify(c.tags ?? []), JSON.stringify(c.goals ?? []), JSON.stringify(c.relations ?? []),
      i,
    ),
  );
}

function insertWorld(pid: string, world: SeedShape['world']): void {
  const secSt = db.prepare(
    `INSERT INTO world_sections (id,project_id,type,title,"desc",sort_order) VALUES (?,?,?,?,?,?)`,
  );
  const itemSt = db.prepare(
    `INSERT INTO world_items (id,section_id,title,"desc",sort_order) VALUES (?,?,?,?,?)`,
  );
  const tlSt = db.prepare(
    `INSERT INTO timeline (id,project_id,era,title,"desc",color,sort_order) VALUES (?,?,?,?,?,?,?)`,
  );
  world.sections.forEach((s, i) => {
    secSt.run(s.id, pid, s.type, s.title, s.desc, i);
    s.items.forEach((it, j) => itemSt.run(it.id, s.id, it.title, it.desc, j));
  });
  world.timeline.forEach((t, i) => tlSt.run(t.id, pid, t.era, t.title, t.desc, t.color, i));
}

function insertPlot(pid: string, plot: SeedShape['plot']): void {
  const actSt = db.prepare(
    `INSERT INTO plot_acts (id,project_id,name,phase,color,sort_order) VALUES (?,?,?,?,?,?)`,
  );
  const nodeSt = db.prepare(
    `INSERT INTO plot_nodes (id,act_id,type,chapter_no,title,summary,conflict,pov,status,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  plot.acts.forEach((a, i) => {
    actSt.run(a.id, pid, a.name, a.phase, a.color, i);
    a.nodes.forEach((n, j) =>
      nodeSt.run(n.id, a.id, n.type, n.chapterNo, n.title, n.summary ?? '', n.conflict ?? '', n.pov, n.status, j),
    );
  });
}

function insertSettings(seed: SeedShape): void {
  const st = db.prepare(
    `INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
  );
  st.run('llm', JSON.stringify(seed.llm), isoNow());
  st.run('image', JSON.stringify(seed.image), isoNow());
}

/**
 * 用量基线：往过去 30 天写入一批演示事件，让统计面板不至于全 0。
 * 真实调用会继续往 usage_events 累加，统计口径始终是该表的真实聚合。
 */
function seedUsageBaseline(): number {
  const st = db.prepare(`INSERT INTO usage_events (ts,action,tokens,cached) VALUES (?,?,?,?)`);
  const actions = ['continue', 'expand', 'polish', 'rewrite', 'brainstorm', 'consistency'];
  const now = Date.now();
  let n = 0;
  for (let d = 29; d >= 0; d--) {
    const times = d === 0 ? 3 : 2 + ((d * 7) % 5);
    for (let k = 0; k < times; k++) {
      const ts = new Date(now - d * 86400000 - k * 3600000).toISOString();
      st.run(ts, actions[(d + k) % actions.length], 800 + ((d * 137 + k * 53) % 2400), (d + k) % 3 === 0 ? 1 : 0);
      n++;
    }
  }
  return n;
}

/** 库为空时灌种子；返回是否执行了注入 */
export function ensureSeed(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number } | undefined;
  if (row && row.n > 0) return false;
  const seed = readSeed();
  tx(() => {
    insertProject(seed.project);
    insertChapters(seed.project.id, seed.chapters);
    insertCharacters(seed.project.id, seed.characters);
    insertWorld(seed.project.id, seed.world);
    insertPlot(seed.project.id, seed.plot);
    insertSettings(seed);
    seedUsageBaseline();
  });
  return true;
}
