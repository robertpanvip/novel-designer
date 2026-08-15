/* ============================================================
   砚墨 · 小说设计器 — 全局状态（单 Context）
   ------------------------------------------------------------
   所有页面通过 useStore() 读取数据与调用 actions。
   页面禁止直接 import mock/data 修改数据；写操作一律走 actions。
   llm 配置与章节草稿变更持久化到 localStorage。
   ============================================================ */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PROJECT, CHAPTERS, CHARACTERS, WORLD, PLOT, LLM_DEFAULT } from '../mock/data';

const StoreCtx = createContext(null);

const LS_LLM = 'yanmo-llm';
const LS_CHAPTERS = 'yanmo-chapters';

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }) {
  const [project] = useState(PROJECT);
  const [chapters, setChapters] = useState(() => loadLS(LS_CHAPTERS, CHAPTERS));
  const [characters, setCharacters] = useState(CHARACTERS);
  const [world, setWorld] = useState(WORLD);
  const [plot, setPlot] = useState(PLOT);
  const [llm, setLlm] = useState(() => loadLS(LS_LLM, LLM_DEFAULT));
  const [toasts, setToasts] = useState([]);

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

  const toast = (msg, type = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /* ---------- chapters ---------- */
  const updateChapter = (id, patch) =>
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const insertChapter = (patch) =>
    setChapters((cs) => [
      ...cs,
      {
        id: `ch-${Date.now()}`,
        no: cs.length + 1,
        status: 'draft',
        wordCount: 0,
        updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
        content: '',
        ...patch,
      },
    ]);

  const removeChapter = (id) => setChapters((cs) => cs.filter((c) => c.id !== id));

  /* ---------- characters ---------- */
  const addCharacter = (data) =>
    setCharacters((cs) => [{ id: `c-${Date.now()}`, ...data }, ...cs]);

  const updateCharacter = (id, patch) =>
    setCharacters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeCharacter = (id) => setCharacters((cs) => cs.filter((c) => c.id !== id));

  /* ---------- world ---------- */
  const addWorldItem = (sectionId, item) =>
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: [...s.items, { id: `wi-${Date.now()}`, ...item }] }
          : s,
      ),
    }));

  const removeWorldItem = (sectionId, itemId) =>
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    }));

  /* ---------- plot ---------- */
  const addPlotNode = (actId, node) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId
          ? { ...a, nodes: [...a.nodes, { id: `pn-${Date.now()}`, status: 'draft', ...node }] }
          : a,
      ),
    }));

  const updatePlotNode = (actId, nodeId, patch) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId
          ? { ...a, nodes: a.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }
          : a,
      ),
    }));

  const removePlotNode = (actId, nodeId) =>
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId ? { ...a, nodes: a.nodes.filter((n) => n.id !== nodeId) } : a,
      ),
    }));

  /* ---------- llm ---------- */
  const setLLM = (patch) => setLlm((l) => ({ ...l, ...patch }));
  const saveLLM = (patch) => {
    setLlm((l) => ({ ...l, ...patch }));
    toast('配置已保存', 'success');
  };

  const value = useMemo(
    () => ({
      project,
      chapters,
      characters,
      world,
      plot,
      llm,
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
      },
    }),
    [project, chapters, characters, world, plot, llm, toasts],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
