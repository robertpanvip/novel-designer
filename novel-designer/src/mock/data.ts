/* ============================================================
   砚墨 · 小说设计器 — 前端 mock / 兜底数据
   ------------------------------------------------------------
   数据本体在 shared/seed.json，与后端共用同一份（后端首次启动
   时用它给 SQLite 灌种子）。这里只做类型包装，作为后端不可用时的兜底。
   改数据请改 shared/seed.json，不要在这里写死。
   ============================================================ */
import seed from '../../shared/seed.json';
import type { Character, Chapter, LLMConfig, PlotData, Project, WorldData } from '../types';

/* JSON 的字面量类型会被放宽（如 status: string），统一在此收口断言 */
export const PROJECT = seed.project as Project;
export const CHAPTERS = seed.chapters as unknown as Chapter[];
export const CHARACTERS = seed.characters as unknown as Character[];
export const WORLD = seed.world as unknown as WorldData;
export const PLOT = seed.plot as unknown as PlotData;
export const LLM_DEFAULT = seed.llm as unknown as LLMConfig;
