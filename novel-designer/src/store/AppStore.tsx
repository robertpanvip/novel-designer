/* ============================================================
   砚墨 · 小说设计器 — 全局状态（单 Context）
   ------------------------------------------------------------
   所有页面通过 useStore() 读取数据与调用 actions。
   页面禁止直接 import mock/data 修改数据；写操作一律走 actions。
   llm 配置与章节草稿变更持久化到 localStorage。
   ============================================================ */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PROJECT, CHAPTERS, CHARACTERS, WORLD, PLOT, LLM_DEFAULT } from '../mock/data';
import { IMAGE_DEFAULT } from '../api/image';
import type {
  Chapter,
  Character,
  CharacterInput,
  ImageConfig,
  LLMConfig,
  PlotData,
  PlotNodeInput,
  Project,
  StoreValue,
  Toast,
  ToastType,
  WorldData,
  WorldItemInput,
} from '../types';

const StoreCtx = createContext<StoreValue | null>(null);

const LS_LLM = 'yanmo-llm';
const LS_CHAPTERS = 'yanmo-chapters';
const LS_IMG = 'yanmo-img';

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [project] = useState<Project>(PROJECT);
  const [chapters, setChapters] = useState<Chapter[]>(() => loadLS(LS_CHAPTERS, CHAPTERS));
  const [characters, setCharacters] = useState<Character[]>(CHARACTERS);
  const [world, setWorld] = useState<WorldData>(WORLD);
  const [plot, setPlot] = useState<PlotData>(PLOT);
  const [llm, setLlm] = useState<LLMConfig>(() => loadLS(LS_LLM, LLM_DEFAULT));
  const [img, setImgCfg] = useState<ImageConfig>(() => loadLS(LS_IMG, IMAGE_DEFAULT));
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LLM, JSON.stringify(llm));
    } catch {
      /* ignore */
    }
  }, [llm]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAPTERS, JSON.stringify(chapters));
    } catch {
      /* ignore */
    }
  }, [chapters]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_IMG, JSON.stringify(img));
    } catch {
      /* ignore */
    }
  }, [img]);

  const toast = (msg: string, type: ToastType = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /* ---------- chapters ---------- */
  const updateChapter = (id: string, patch: Partial<Chapter>) =>
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const insertChapter = (patch: Partial<Chapter>) =>
    setChapters((cs) => [
      ...cs,
      {
        id: `ch-${Date.now()}`,
        no: cs.length + 1,
        title: '未命名章节',
        status: 'draft',
        wordCount: 0,
        updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
        summary: '',
        content: '',
        ...patch,
      },
    ]);

  const removeChapter = (id: string) => setChapters((cs) => cs.filter((c) => c.id !== id));

  /* ---------- characters ---------- */
  const addCharacter = (data: CharacterInput) =>
    setCharacters((cs) => [{ id: `c-${Date.now()}`, seed: 100 + cs.length, conflicts: '', ...data }, ...cs]);

  const updateCharacter = (id: string, patch: Partial<Character>) =>
    setCharacters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeCharacter = (id: string) => setCharacters((cs) => cs.filter((c) => c.id !== id));

  /* ---------- world ---------- */
  const addWorldItem = (sectionId: string, item: WorldItemInput) =>
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: [...s.items, { id: `wi-${Date.now()}`, ...item }] }
          : s,
      ),
    }));

  const removeWorldItem = (sectionId: string, itemId: string) =>
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    }));

  /* ---------- plot ---------- */
  const addPlotNode = (actId: string, node: PlotNodeInput) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId
          ? { ...a, nodes: [...a.nodes, { id: `pn-${Date.now()}`, status: 'draft', ...node }] }
          : a,
      ),
    }));

  const updatePlotNode = (actId: string, nodeId: string, patch: Partial<PlotNodeInput>) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId
          ? { ...a, nodes: a.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }
          : a,
      ),
    }));

  const removePlotNode = (actId: string, nodeId: string) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId ? { ...a, nodes: a.nodes.filter((n) => n.id !== nodeId) } : a,
      ),
    }));

  /* ---------- llm ---------- */
  const setLLM = (patch: Partial<LLMConfig>) => setLlm((l) => ({ ...l, ...patch }));
  const saveLLM = (patch: Partial<LLMConfig>) => {
    setLlm((l) => ({ ...l, ...patch }));
    toast('配置已保存', 'success');
  };

  /* ---------- img (场景/人物配图) ---------- */
  const setImg = (patch: Partial<ImageConfig>) => setImgCfg((l) => ({ ...l, ...patch }));
  const saveImg = (patch: Partial<ImageConfig>) => {
    setImgCfg((l) => ({ ...l, ...patch }));
    toast('配图配置已保存', 'success');
  };

  const value = useMemo<StoreValue>(
    () => ({
      project,
      chapters,
      characters,
      world,
      plot,
      llm,
      img,
      toasts,
      actions: {
        toast,
        updateChapter,
        insertChapter,
        removeChapter,
        addCharacter,
        updateCharacter,
        removeCharacter,
        addWorldItem,
        removeWorldItem,
        addPlotNode,
        updatePlotNode,
        removePlotNode,
        setLLM,
        saveLLM,
        setImg,
        saveImg,
      },
    }),
    [project, chapters, characters, world, plot, llm, img, toasts],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
