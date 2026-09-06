/* ============================================================
   砚墨 · 小说设计器 — 小说数据 API（对应后端 /api/*）
   ------------------------------------------------------------
   后端以 SQLite 为唯一数据源；前端所有写操作都同步到这里。
   ============================================================ */
import { api } from './client';
import type { Chapter, Character, ImageConfig, LLMConfig, PlotData, Project, ProjectMeta, RenameResult, WorldData, WorldImportResult, WorldImportSection, WorldItem } from '../types';

export interface BootstrapPayload {
  project: Project;
  activeProjectId: string | null;
  projects: ProjectMeta[];
  chapters: Chapter[];
  characters: Character[];
  world: WorldData;
  plot: PlotData;
  llm: LLMConfig;
  img: ImageConfig;
}

/** /api/extract 返回：从正文识别出的人物与势力 */
export interface ExtractPayload {
  ai: boolean;
  characters: { name: string; identity: string }[];
  factions: { name: string; desc: string }[];
  /** ai:false 时的失败原因 */
  message?: string;
}

/** /api/extract/plot 返回的单个提炼节拍（actPhase 对应用户现有幕的 phase） */
export interface ExtractedPlotBeat {
  actPhase: string;
  type: string;
  chapterNo: number;
  title: string;
  summary: string;
  conflict: string;
  pov: string;
}

export const dbApi = {
  /** 一次性拉齐全部数据，减少首屏请求数 */
  bootstrap: () => api.get<BootstrapPayload>('/bootstrap'),

  updateProject: (patch: Partial<Project>) => api.put<Project>('/project', patch),

  /** 新建作品（后端会自动切换为当前作品） */
  createProject: (data: { title: string }) => api.post<Project>('/projects', data),
  /** 切换当前作品 */
  setActiveProject: (id: string) => api.put<{ ok: boolean; activeProjectId: string }>('/projects/active', { id }),
  /** 删除作品（最后一本不可删） */
  removeProject: (id: string) => api.del<{ ok: boolean; activeProjectId: string | null }>(`/projects/${id}`),

  createChapter: (data: Partial<Chapter>) => api.post<Chapter>('/chapters', data),
  updateChapter: (id: string, patch: Partial<Chapter>) => api.patch<Chapter>(`/chapters/${id}`, patch),
  deleteChapter: (id: string) => api.del<{ id: string }>(`/chapters/${id}`),

  createCharacter: (data: Partial<Character>) => api.post<Character>('/characters', data),
  updateCharacter: (id: string, patch: Partial<Character>) => api.patch<Character>(`/characters/${id}`, patch),
  deleteCharacter: (id: string) => api.del<{ id: string }>(`/characters/${id}`),

  /** 一键改名：活动作品内全文替换旧名 → 新名（章节/角色/世界观/情节/时间线） */
  renameGlobally: (from: string, to: string) => api.post<RenameResult>('/rename', { from, to }),

  /** 从正文提取人物/势力（大模型识别；ai:false 表示未配置模型） */
  extractEntities: (text: string) =>
    api.post<ExtractPayload>('/extract', { text }),

  createWorldItem: (sectionId: string, data: Partial<WorldItem>) =>
    api.post<WorldItem>(`/world/sections/${sectionId}/items`, data),
  updateWorldSection: (id: string, patch: { type?: string; title?: string; desc?: string }) =>
    api.put<{ id: string }>(`/world/sections/${id}`, patch),
  updateWorldItem: (id: string, patch: { title?: string; desc?: string }) =>
    api.put<{ id: string }>(`/world/items/${id}`, patch),
  deleteWorldItem: (itemId: string) => api.del<{ id: string }>(`/world/items/${itemId}`),

  /** 从长文本提炼世界观（大模型识别；ai:false 表示未配置模型或解析失败） */
  extractWorld: (text: string) =>
    api.post<{ ai: boolean; sections: WorldImportSection[]; message?: string }>('/extract/world', { text }),
  /** 批量导入提炼结果（后端按分区 type 合并、同名条目去重） */
  importWorld: (sections: WorldImportSection[]) =>
    api.post<WorldImportResult>('/world/import', { sections }),

  /** 从文本提炼情节节拍（大模型识别，已按现有幕结构归幕；ai:false 表示未配置或解析失败） */
  extractPlot: (text: string) =>
    api.post<{ ai: boolean; beats: ExtractedPlotBeat[]; message?: string }>('/extract/plot', { text }),

  createPlotNode: (actId: string, data: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/plot/acts/${actId}/nodes`, data),
  updatePlotNode: (nodeId: string, patch: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>(`/plot/nodes/${nodeId}`, patch),
  deletePlotNode: (nodeId: string) => api.del<{ id: string }>(`/plot/nodes/${nodeId}`),

  saveLLM: (patch: Partial<LLMConfig>) => api.put<LLMConfig>('/settings/llm', patch),
  saveImage: (patch: Partial<ImageConfig>) => api.put<ImageConfig>('/settings/image', patch),
};
