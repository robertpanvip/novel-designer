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

/** 六种 AI 创作能力 */
export type AIActionKey =
  | 'continue'
  | 'expand'
  | 'polish'
  | 'rewrite'
  | 'brainstorm'
  | 'consistency';

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
  updateChapter: (id: string, patch: Partial<Chapter>) => void;
  insertChapter: (patch: Partial<Chapter>) => void;
  removeChapter: (id: string) => void;
  addCharacter: (data: CharacterInput) => void;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  addWorldItem: (sectionId: string, item: WorldItemInput) => void;
  removeWorldItem: (sectionId: string, itemId: string) => void;
  addPlotNode: (actId: string, node: PlotNodeInput) => void;
  updatePlotNode: (actId: string, nodeId: string, patch: Partial<PlotNode>) => void;
  removePlotNode: (actId: string, nodeId: string) => void;
  setLLM: (patch: Partial<LLMConfig>) => void;
  saveLLM: (patch: Partial<LLMConfig>) => void;
  setImg: (patch: Partial<ImageConfig>) => void;
  saveImg: (patch: Partial<ImageConfig>) => void;
}

export interface StoreValue {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  world: WorldData;
  plot: PlotData;
  llm: LLMConfig;
  img: ImageConfig;
  toasts: Toast[];
  actions: StoreActions;
}
