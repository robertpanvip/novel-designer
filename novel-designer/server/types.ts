/* ============================================================
   砚墨 · 后端 — 领域类型与 SQLite 行映射辅助
   ------------------------------------------------------------
   动态数据（HTTP 请求体、SQLite 行）一律以 unknown 进入，
   通过 str/num/optStr/optNum 等辅助做显式收窄，全程禁用 any。
   ============================================================ */

/** SQLite 预处理语句可接受的值类型（与 node:sqlite 的 SQLInputValue 对齐） */
export type SqlValue = string | number | bigint | null;

/** 一行记录：列名 → 未知值，由映射函数收窄 */
export type Row = Record<string, unknown>;

/* ---------------- HTTP 请求体 ---------------- */

export interface ChatBody {
  action?: string;
  context?: Record<string, unknown>;
}

export type AIAction = 'continue' | 'expand' | 'polish' | 'rewrite' | 'brainstorm' | 'consistency' | 'draft';

export interface ConnInput {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface TestResult {
  ok: boolean;
  latency: number;
  model?: string;
  message: string;
}

export interface RunResult {
  reply: string;
  source: 'upstream' | 'canned';
  error?: string;
}

/* ---------------- 配置 ---------------- */

export interface LLMConfig {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  actions?: Record<string, string>;
}

export interface ImageConfig {
  provider?: string;
  style?: string;
  size?: string;
  sceneSize?: string;
  seed?: number;
  baseUrl?: string;
  apiKey?: string;
  connected?: boolean;
  lastTest?: unknown;
  useCount?: number;
}

export interface Provider {
  id: string;
  name: string;
  desc: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  needsKey: boolean;
  badge: string;
}

/* ---------------- 领域对象（对外 camelCase） ---------------- */

export interface Project {
  id: string;
  title: string;
  genre: string | null;
  tagline: string;
  synopsis: string;
  cover: string;
  wordCount: number;
  chapterCount: number;
  charCount: number;
  worldCount: number;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  no: number;
  title: string;
  status: string;
  wordCount: number;
  updatedAt: string;
  summary: string;
  content: string;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  color: string;
  tags: string[];
  appearance: string;
  seed: number;
  identity: string;
  personality: string;
  goals: string[];
  conflicts: string;
  arc: string;
  note: string;
  relations: string[];
}

export interface WorldItem {
  id: string;
  title: string;
  desc: string;
}

export interface WorldSection {
  id: string;
  type: string;
  title: string;
  desc: string;
  items: WorldItem[];
}

export interface TimelineEntry {
  id: string;
  era: string;
  title: string;
  desc: string;
  color: string;
}

export interface World {
  sections: WorldSection[];
  timeline: TimelineEntry[];
}

export interface PlotNode {
  id: string;
  type: string;
  chapterNo: number;
  title: string;
  summary: string;
  conflict: string;
  pov: string;
  status: string;
}

export interface PlotAct {
  id: string;
  name: string;
  phase: string;
  color: string;
  nodes: PlotNode[];
}

export interface Plot {
  acts: PlotAct[];
}

export interface UsageStats {
  monthCalls: number;
  monthTokens: number;
  dayCalls: number;
  dayTokens: number;
  cached: number;
}

/* ---------------- 种子 JSON 形状 ---------------- */

export interface ProjectSeed {
  id: string;
  title: string;
  genre: string;
  tagline: string;
  synopsis: string;
  cover: string;
  wordCount: number;
  chapterCount: number;
  charCount: number;
  worldCount: number;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterSeed {
  id: string;
  no: number;
  title: string;
  status: string;
  wordCount: number;
  updatedAt: string;
  summary: string;
  content: string;
}

export interface CharacterSeed {
  id: string;
  name: string;
  title: string;
  color: string;
  appearance: string;
  seed: number;
  identity: string;
  personality: string;
  conflicts: string;
  arc: string;
  note: string;
  tags: string[];
  goals: string[];
  relations: string[];
}

export interface WorldSeed {
  sections: {
    id: string;
    type: string;
    title: string;
    desc: string;
    items: { id: string; title: string; desc: string }[];
  }[];
  timeline: { id: string; era: string; title: string; desc: string; color: string }[];
}

export interface PlotSeed {
  acts: {
    id: string;
    name: string;
    phase: string;
    color: string;
    nodes: {
      id: string;
      type: string;
      chapterNo: number;
      title: string;
      summary: string;
      conflict: string;
      pov: string;
      status: string;
    }[];
  }[];
}

export interface SeedShape {
  project: ProjectSeed;
  chapters: ChapterSeed[];
  characters: CharacterSeed[];
  world: WorldSeed;
  plot: PlotSeed;
  llm: LLMConfig;
  image: ImageConfig;
}

/* ---------------- 行映射辅助（unknown → 具体类型） ---------------- */

export const str = (v: unknown): string => (v == null ? '' : String(v));
export const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
export const optStr = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
export const optNum = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);

/** 把任意值解析为字符串数组（用于 tags/goals/relations 等 JSON 文本列） */
export function parseArr(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** 把数组序列化为 JSON 文本（写入 SQLite 文本列） */
export const toJsonText = (v: unknown): string => JSON.stringify(Array.isArray(v) ? v : []);
