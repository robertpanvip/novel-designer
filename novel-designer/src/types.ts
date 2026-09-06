/* ============================================================
   砚墨 · 小说设计器 — 全局类型定义（单一类型源）
   页面、store、api 一律从这里导入类型，严格禁止 any。
   ============================================================ */
import type { CSSProperties } from 'react';

/* 允许内联 style 携带 CSS 自定义属性（--d 动效延迟等），无需每处强转 */
declare module 'react' {
  interface CSSProperties {
    '--d'?: string;
  }
}

/* ---------------- 通用 ---------------- */

/** 允许携带 CSS 自定义属性（--d 等）的 style 对象 */
export type CustomCSS = CSSProperties & { '--d'?: string };

export type ToastType = 'default' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

/** 连接/生成测试记录（at + latency 必填，model 可选） */
export interface TestRecord {
  at: string;
  latency: number;
  model?: string;
}

/** API 统一返回包装（code + data） */
export interface ApiResponse<T> {
  code: number;
  data: T;
}

/* ---------------- 项目 ---------------- */

export interface Project {
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

/** 一键改名（全文替换）各数据域的命中行数 */
export interface RenameResult {
  chapters: number;
  characters: number;
  world: number;
  plot: number;
  timeline: number;
}

/** AI 从长文本提炼出的世界观分区（导入前预览） */
export interface WorldImportSection {
  type: string;
  title: string;
  desc: string;
  items: { title: string; desc: string }[];
}

/** 世界观导入结果统计 */
export interface WorldImportResult {
  sectionsCreated: number;
  itemsAdded: number;
  itemsSkipped: number;
}

/** 书籍切换器用的轻量条目 */
export interface ProjectMeta {
  id: string;
  title: string;
  genre: string | null;
  cover: string;
  updatedAt: string;
  chapterCount: number;
  charCount: number;
}

/* ---------------- 章节 ---------------- */

export type ChapterStatus = 'done' | 'revising' | 'draft';

export interface Chapter {
  id: string;
  no: number;
  title: string;
  status: ChapterStatus;
  wordCount: number;
  updatedAt: string;
  summary: string;
  content: string;
}

/* ---------------- 角色 ---------------- */

export interface CharacterRelation {
  name: string;
  type: string;
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
  relations: CharacterRelation[];
}

/** 新增角色输入（id/seed/conflicts 由 store 自动补齐） */
export type CharacterInput = Omit<Character, 'id' | 'seed' | 'conflicts'>;

/* ---------------- 世界观 ---------------- */

export interface WorldItem {
  id: string;
  title: string;
  desc: string;
}

/** 新增世界观条目输入（id 由 store 自动生成） */
export type WorldItemInput = Omit<WorldItem, 'id'>;

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

export interface WorldData {
  sections: WorldSection[];
  timeline: TimelineEntry[];
}

/* ---------------- 情节 ---------------- */

export interface PlotNode {
  id: string;
  type: string;
  chapterNo: number;
  title: string;
  summary?: string;
  conflict?: string;
  pov: string;
  status: ChapterStatus;
}

/** 新增节拍输入（id/status 由 store 自动补齐） */
export type PlotNodeInput = Omit<PlotNode, 'id' | 'status'>;

export interface PlotAct {
  id: string;
  name: string;
  phase: string;
  color: string;
  nodes: PlotNode[];
}

export interface PlotData {
  acts: PlotAct[];
}

/* ---------------- 大模型（LLM） ---------------- */

/** 六种 AI 创作能力 + 一键成稿 */
export type AIActionKey =
  | 'continue'
  | 'expand'
  | 'polish'
  | 'rewrite'
  | 'brainstorm'
  | 'consistency'
  | 'draft';

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

export interface LLMConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  actions: Record<AIActionKey, string>;
  useCount: number;
  connected: boolean;
  lastTest: TestRecord | null;
}

export interface UsageData {
  monthCalls: number;
  monthTokens: number;
  dayCalls: number;
  dayTokens: number;
  cached: number;
}

/** runAI 传入的上下文（允许扩展任意字符串字段） */
export interface RunAIContext {
  [key: string]: string | undefined;
}

export interface ChatReply {
  reply: string;
}

/* ---------------- 图片生成 ---------------- */

export interface ImageProvider {
  id: string;
  name: string;
  desc: string;
  needsKey: boolean;
  defaultBase: string;
}

export interface ImageConfig {
  provider: string;
  style: string;
  size: string;
  sceneSize: string;
  seed: number;
  baseUrl: string;
  apiKey: string;
  connected: boolean;
  lastTest: TestRecord | null;
  useCount: number;
}

export interface GeneratedImage {
  url: string;
  seed: string;
  prompt: string;
}

/* ---------------- Store ---------------- */

export interface StoreActions {
  toast: (msg: string, type?: ToastType) => void;
  updateProject: (patch: Partial<Project>) => void;
  /** 新建作品并切换过去 */
  createBook: (title: string) => Promise<void>;
  /** 切换当前作品 */
  switchBook: (id: string) => Promise<void>;
  /** 删除作品（最后一本不可删） */
  removeBook: (id: string) => Promise<void>;
  /** 一键改名：活动作品内全文替换旧名 → 新名，返回是否成功（统计经 toast 提示） */
  renameCharacter: (from: string, to: string) => Promise<boolean>;
  updateChapter: (id: string, patch: Partial<Chapter>) => void;
  insertChapter: (patch: Partial<Chapter>) => void;
  removeChapter: (id: string) => void;
  addCharacter: (data: CharacterInput) => void;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  addWorldItem: (sectionId: string, item: WorldItemInput) => void;
  removeWorldItem: (sectionId: string, itemId: string) => void;
  /** 编辑分区（分类名/标题/概述） */
  updateWorldSection: (sectionId: string, patch: { type?: string; title?: string; desc?: string }) => void;
  /** 编辑条目（标题/描述） */
  updateWorldItem: (sectionId: string, itemId: string, patch: { title?: string; desc?: string }) => void;
  /** 批量导入 AI 提炼的世界观分区（按 type 合并、同名条目去重） */
  importWorld: (sections: WorldImportSection[]) => Promise<void>;
  addPlotNode: (actId: string, node: PlotNodeInput) => void;
  updatePlotNode: (actId: string, nodeId: string, patch: Partial<PlotNode> & { actId?: string }) => void;
  removePlotNode: (actId: string, nodeId: string) => void;
  setLLM: (patch: Partial<LLMConfig>) => void;
  saveLLM: (patch: Partial<LLMConfig>) => void;
  setImg: (patch: Partial<ImageConfig>) => void;
  saveImg: (patch: Partial<ImageConfig>) => void;
}

export interface StoreValue {
  /** 后端是否可用；false 时写操作仅落 localStorage */
  apiOnline: boolean;
  project: Project;
  /** 全部作品（书籍切换器数据源） */
  projects: ProjectMeta[];
  chapters: Chapter[];
  characters: Character[];
  world: WorldData;
  plot: PlotData;
  llm: LLMConfig;
  img: ImageConfig;
  toasts: Toast[];
  actions: StoreActions;
}
