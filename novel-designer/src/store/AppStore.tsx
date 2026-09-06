/* ============================================================
   砚墨 · 小说设计器 — 全局状态（单 Context）
   ------------------------------------------------------------
   所有页面通过 useStore() 读取数据与调用 actions。
   页面禁止直接 import mock/data 修改数据；写操作一律走 actions。
   数据源优先级：后端 SQLite > localStorage > mock 兜底。
   启动时拉 /api/bootstrap；后端不可用则静默回落本地，功能不塌。
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PROJECT, CHAPTERS, CHARACTERS, WORLD, PLOT, LLM_DEFAULT } from '../mock/data';
import { IMAGE_DEFAULT } from '../api/image';
import { dbApi } from '../api/db';
import { saveLLMConfig } from '../api/llm';
import type {
  Chapter,
  Character,
  CharacterInput,
  ImageConfig,
  LLMConfig,
  PlotData,
  PlotNode,
  PlotNodeInput,
  Project,
  ProjectMeta,
  StoreValue,
  Toast,
  ToastType,
  WorldData,
  WorldImportSection,
  WorldItemInput,
} from '../types';

/** 字符串全文替换（等价后端 SQLite REPLACE 语义） */
const replaceAll = (s: string, from: string, to: string): string =>
  s && from ? s.split(from).join(to) : s;

const StoreCtx = createContext<StoreValue | null>(null);

const LS_LLM = 'yanmo-llm';
const LS_CHAPTERS = 'yanmo-chapters';
const LS_IMG = 'yanmo-img';

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    // 数组类型（如 chapters）不能对象展开，否则会变成普通对象，导致 .filter/.map 失效
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

const nowText = () =>
  new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const [project, setProject] = useState<Project>(PROJECT);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>(() => loadLS(LS_CHAPTERS, CHAPTERS));
  const [characters, setCharacters] = useState<Character[]>(CHARACTERS);
  const [world, setWorld] = useState<WorldData>(WORLD);
  const [plot, setPlot] = useState<PlotData>(PLOT);
  const [llm, setLlm] = useState<LLMConfig>(() => loadLS(LS_LLM, LLM_DEFAULT));
  const [img, setImgCfg] = useState<ImageConfig>(() => loadLS(LS_IMG, IMAGE_DEFAULT));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (msg: string, type: ToastType = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /* ---------------- 后端同步基建 ---------------- */

  const patchBuf = useRef<Record<string, Record<string, unknown>>>({});
  const flushTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const warned = useRef(false);

  /** 写后端失败只提示一次，避免刷屏 */
  const guard = async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (e) {
      if (!warned.current) {
        warned.current = true;
        toast(`后端同步失败，已暂存本地：${e instanceof Error ? e.message : String(e)}`, 'warning');
      }
    }
  };

  /** 同一 key 的多次 patch 合并后延迟发送（标题/正文分开改也不会丢） */
  const syncPatch = (
    key: string,
    patch: Record<string, unknown>,
    send: (merged: Record<string, unknown>) => Promise<unknown>,
    ms = 500,
  ) => {
    if (!apiOnline) return;
    patchBuf.current[key] = { ...(patchBuf.current[key] ?? {}), ...patch };
    clearTimeout(flushTimer.current[key]);
    flushTimer.current[key] = setTimeout(() => {
      const merged = patchBuf.current[key];
      delete patchBuf.current[key];
      if (merged) void guard(() => send(merged));
    }, ms);
  };

  const sync = (task: () => Promise<unknown>) => {
    if (apiOnline) void guard(task);
  };

  /**
   * 拉取 /api/bootstrap 并整体覆盖本地状态。
   * 启动与切换/新建/删除作品共用。注意：chapters/characters 无条件覆盖
   * （切到空作品时必须清空，不能沿用上一本的列表）。
   */
  const applyBootstrap = useCallback(async (): Promise<boolean> => {
    try {
      const data = await dbApi.bootstrap();
      if (data.project) setProject(data.project);
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setChapters(Array.isArray(data.chapters) ? data.chapters : []);
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
      if (data.world) setWorld(data.world);
      if (data.plot) setPlot(data.plot);
      if (data.llm) {
        setLlm((l) => {
          const dbLlm = data.llm;
          // 自愈：后端 Key 为空而本地留有 Key（离线时保存过 / 后端配置被重置）→ 保留本地 Key 并回传后端
          if (!dbLlm.apiKey && l.apiKey) {
            void dbApi.saveLLM({ apiKey: l.apiKey, baseUrl: dbLlm.baseUrl, model: dbLlm.model }).catch(() => {});
            return { ...l, ...dbLlm, apiKey: l.apiKey };
          }
          return { ...l, ...dbLlm };
        });
      }
      if (data.img) setImgCfg((i) => ({ ...i, ...data.img }));
      setApiOnline(true);
      return true;
    } catch {
      setApiOnline(false);
      return false;
    }
  }, []);

  /* 启动：拉齐后端数据，失败则继续用 localStorage / mock */
  useEffect(() => {
    let alive = true;
    void applyBootstrap().then((ok) => {
      if (alive && !ok) toast('后端未连接，已启用本地数据（启动：npm run server）', 'warning');
    });
    return () => {
      alive = false;
    };
  }, [applyBootstrap]);

  useEffect(
    () => () => {
      Object.values(flushTimer.current).forEach(clearTimeout);
    },
    [],
  );

  /* 本地兜底：后端不可用时仍能正常用 */
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

  /* ---------- project ---------- */
  const updateProject = (patch: Partial<Project>) => {
    setProject((p) => ({ ...p, ...patch, updatedAt: nowText() }));
    syncPatch('project', patch, (m) => dbApi.updateProject(m));
  };

  /* ---------- 多作品：新建 / 切换 / 删除 ---------- */
  const bookErr = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const createBook = async (title: string) => {
    const name = title.trim() || '未命名作品';
    try {
      await dbApi.createProject({ title: name });
      const ok = await applyBootstrap();
      if (ok) toast(`已创建《${name}》并切换`, 'success');
      else toast('已创建，但刷新数据失败，请手动刷新页面', 'warning');
    } catch (e) {
      toast(`创建作品失败：${bookErr(e)}`, 'danger');
    }
  };

  const switchBook = async (id: string) => {
    try {
      await dbApi.setActiveProject(id);
      const ok = await applyBootstrap();
      if (!ok) toast('已切换，但刷新数据失败，请手动刷新页面', 'warning');
    } catch (e) {
      toast(`切换作品失败：${bookErr(e)}`, 'danger');
    }
  };

  const removeBook = async (id: string) => {
    try {
      await dbApi.removeProject(id);
      const ok = await applyBootstrap();
      if (ok) toast('作品已删除', 'success');
      else toast('已删除，但刷新数据失败，请手动刷新页面', 'warning');
    } catch (e) {
      toast(`删除作品失败：${bookErr(e)}`, 'danger');
    }
  };

  /* ---------- chapters ---------- */
  const updateChapter = (id: string, patch: Partial<Chapter>) => {
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    syncPatch(`chapter:${id}`, patch, (m) => dbApi.updateChapter(id, m));
  };

  const insertChapter = (patch: Partial<Chapter>) => {
    const next: Chapter = {
      id: `ch-${Date.now()}`,
      no: chapters.length + 1,
      title: '未命名章节',
      status: 'draft',
      wordCount: 0,
      updatedAt: nowText(),
      summary: '',
      content: '',
      ...patch,
    };
    setChapters((cs) => [...cs, next]);
    sync(() => dbApi.createChapter(next));
  };

  const removeChapter = (id: string) => {
    /* 删除后章节号连续重排（1..n），变化项同步后端 */
    const remaining = chapters.filter((c) => c.id !== id);
    setChapters(remaining.map((c, i) => (c.no === i + 1 ? c : { ...c, no: i + 1 })));
    sync(() => dbApi.deleteChapter(id));
    remaining.forEach((c, i) => {
      if (c.no !== i + 1) sync(() => dbApi.updateChapter(c.id, { no: i + 1 }));
    });
  };

  /* ---------- characters ---------- */
  const addCharacter = (data: CharacterInput) => {
    const next: Character = { id: `c-${Date.now()}`, seed: 100 + characters.length, conflicts: '', ...data };
    setCharacters((cs) => [next, ...cs]);
    sync(() => dbApi.createCharacter(next));
  };

  const updateCharacter = (id: string, patch: Partial<Character>) => {
    setCharacters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    syncPatch(`char:${id}`, patch, (m) => dbApi.updateCharacter(id, m));
  };

  const removeCharacter = (id: string) => {
    setCharacters((cs) => cs.filter((c) => c.id !== id));
    sync(() => dbApi.deleteCharacter(id));
  };

  /* ---------- 一键改名（全文替换人名） ---------- */
  const renameCharacter = async (from: string, to: string): Promise<boolean> => {
    const oldName = from.trim();
    const newName = to.trim();
    if (!oldName || !newName || oldName === newName) return false;

    if (apiOnline) {
      try {
        const r = await dbApi.renameGlobally(oldName, newName);
        await applyBootstrap();
        const total = r.chapters + r.characters + r.world + r.plot + r.timeline;
        toast(
          total > 0
            ? `已改名：${r.chapters} 章、${r.characters} 处角色卡、${r.world} 条世界观、${r.plot} 个情节节拍、${r.timeline} 条时间线`
            : '没有找到包含该名字的内容',
          total > 0 ? 'success' : 'default',
        );
        return true;
      } catch (e) {
        toast(`改名失败：${bookErr(e)}`, 'danger');
        return false;
      }
    }

    /* 离线兜底：直接改本地状态 */
    setChapters((cs) =>
      cs.map((c) => ({
        ...c,
        title: replaceAll(c.title, oldName, newName),
        summary: replaceAll(c.summary, oldName, newName),
        content: replaceAll(c.content, oldName, newName),
      })),
    );
    setCharacters((cs) =>
      cs.map((c) => ({
        ...c,
        name: c.name === oldName ? newName : replaceAll(c.name, oldName, newName),
        title: replaceAll(c.title, oldName, newName),
        appearance: replaceAll(c.appearance, oldName, newName),
        identity: replaceAll(c.identity, oldName, newName),
        personality: replaceAll(c.personality, oldName, newName),
        conflicts: replaceAll(c.conflicts, oldName, newName),
        arc: replaceAll(c.arc, oldName, newName),
        note: replaceAll(c.note, oldName, newName),
        tags: c.tags.map((t) => replaceAll(t, oldName, newName)),
        goals: c.goals.map((g) => replaceAll(g, oldName, newName)),
      })),
    );
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) => ({
        ...s,
        title: replaceAll(s.title, oldName, newName),
        desc: replaceAll(s.desc, oldName, newName),
        items: s.items.map((i) => ({
          ...i,
          title: replaceAll(i.title, oldName, newName),
          desc: replaceAll(i.desc, oldName, newName),
        })),
      })),
      timeline: w.timeline.map((t) => ({
        ...t,
        title: replaceAll(t.title, oldName, newName),
        desc: replaceAll(t.desc, oldName, newName),
      })),
    }));
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) => ({
        ...a,
        nodes: a.nodes.map((n) => ({
          ...n,
          title: replaceAll(n.title, oldName, newName),
          summary: replaceAll(n.summary ?? '', oldName, newName),
        })),
      })),
    }));
    toast('已本地改名（后端未连接）', 'success');
    return true;
  };

  /* ---------- world ---------- */
  const addWorldItem = (sectionId: string, item: WorldItemInput) => {
    const next = { id: `wi-${Date.now()}`, ...item };
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, next] } : s)),
    }));
    sync(() => dbApi.createWorldItem(sectionId, next));
  };

  const removeWorldItem = (sectionId: string, itemId: string) => {
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    }));
    sync(() => dbApi.deleteWorldItem(itemId));
  };

  const updateWorldSection = (sectionId: string, patch: { type?: string; title?: string; desc?: string }) => {
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
    sync(() => dbApi.updateWorldSection(sectionId, patch));
  };

  const updateWorldItem = (sectionId: string, itemId: string, patch: { title?: string; desc?: string }) => {
    setWorld((w) => ({
      ...w,
      sections: w.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : s,
      ),
    }));
    sync(() => dbApi.updateWorldItem(itemId, patch));
  };

  /** 批量导入 AI 提炼的世界观分区：在线走后端（按 type 合并、同名去重），离线本地合并 */
  const importWorld = async (sections: WorldImportSection[]) => {
    const valid = sections.filter((s) => s.type && s.items.length > 0);
    if (!valid.length) {
      toast('没有可导入的内容', 'warning');
      return;
    }
    if (apiOnline) {
      const r = await dbApi.importWorld(valid);
      await applyBootstrap();
      toast(
        `已导入世界观：新建 ${r.sectionsCreated} 个分区、新增 ${r.itemsAdded} 条条目${r.itemsSkipped ? `，跳过重复 ${r.itemsSkipped} 条` : ''}`,
        'success',
      );
      return;
    }
    /* 离线兜底：本地合并进 world state */
    let added = 0;
    setWorld((w) => {
      const secs = [...w.sections];
      for (const sec of valid) {
        const idx = secs.findIndex((s) => s.type === sec.type);
        const mkId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (idx >= 0) {
          const existing = new Set(secs[idx].items.map((i) => i.title));
          const items = sec.items
            .filter((it) => !existing.has(it.title))
            .map((it) => ({ id: mkId('wi'), title: it.title, desc: it.desc }));
          added += items.length;
          secs[idx] = { ...secs[idx], items: [...secs[idx].items, ...items] };
        } else {
          secs.push({
            id: mkId('ws'),
            type: sec.type,
            title: sec.title || sec.type,
            desc: sec.desc,
            items: sec.items.map((it) => ({ id: mkId('wi'), title: it.title, desc: it.desc })),
          });
          added += sec.items.length;
        }
      }
      return { ...w, sections: secs };
    });
    toast(`已本地导入 ${added} 条世界观条目（后端未连接）`, 'success');
  };

  /* ---------- plot ---------- */
  const addPlotNode = (actId: string, node: PlotNodeInput) => {
    /* id 加随机后缀：批量导入多个节拍时避免同一毫秒内 id 碰撞 */
    const next = { id: `pn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: 'draft' as const, ...node };
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) => (a.id === actId ? { ...a, nodes: [...a.nodes, next] } : a)),
    }));
    sync(() => dbApi.createPlotNode(actId, next));
  };

  const updatePlotNode = (actId: string, nodeId: string, patch: Partial<PlotNodeInput> & { actId?: string }) => {
    /* 跨幕移动：从旧幕移除，追加到新幕末尾（后端同步更新 act_id 与 sort_order） */
    const nextActId = patch.actId;
    if (nextActId && nextActId !== actId) {
      const { actId: _omit, ...fields } = patch;
      setPlot((p) => {
        const src = p.acts.find((a) => a.id === actId);
        const found = src?.nodes.find((n) => n.id === nodeId);
        if (!src || !found) return p;
        const movedNode: PlotNode = { ...found, ...fields };
        return {
          ...p,
          acts: p.acts.map((a) => {
            if (a.id === actId) return { ...a, nodes: a.nodes.filter((n) => n.id !== nodeId) };
            if (a.id === nextActId) return { ...a, nodes: [...a.nodes, movedNode] };
            return a;
          }),
        };
      });
      sync(() => dbApi.updatePlotNode(nodeId, { ...patch }));
      return;
    }
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id === actId ? { ...a, nodes: a.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) } : a,
      ),
    }));
    syncPatch(`node:${nodeId}`, patch, (m) => dbApi.updatePlotNode(nodeId, m));
  };

  const removePlotNode = (actId: string, nodeId: string) => {
    setPlot((p) => ({
      ...p,
      acts: p.acts.map((a) => (a.id === actId ? { ...a, nodes: a.nodes.filter((n) => n.id !== nodeId) } : a)),
    }));
    sync(() => dbApi.deletePlotNode(nodeId));
  };

  /* ---------- llm ---------- */
  const setLLM = (patch: Partial<LLMConfig>) => setLlm((l) => ({ ...l, ...patch }));

  const saveLLM = (patch: Partial<LLMConfig>) => {
    setLlm((l) => ({ ...l, ...patch }));
    sync(() => saveLLMConfig(patch));
    toast('配置已保存', 'success');
  };

  /* ---------- img (场景/人物配图) ---------- */
  const setImg = (patch: Partial<ImageConfig>) => setImgCfg((l) => ({ ...l, ...patch }));

  const saveImg = (patch: Partial<ImageConfig>) => {
    setImgCfg((l) => ({ ...l, ...patch }));
    sync(() => dbApi.saveImage(patch));
    toast('配图配置已保存', 'success');
  };

  const value = useMemo<StoreValue>(
    () => ({
      apiOnline,
      project,
      projects,
      chapters,
      characters,
      world,
      plot,
      llm,
      img,
      toasts,
      actions: {
        toast,
        updateProject,
        createBook,
        switchBook,
        removeBook,
        renameCharacter,
        updateChapter,
        insertChapter,
        removeChapter,
        addCharacter,
        updateCharacter,
        removeCharacter,
        addWorldItem,
        removeWorldItem,
        updateWorldSection,
        updateWorldItem,
        importWorld,
        addPlotNode,
        updatePlotNode,
        removePlotNode,
        setLLM,
        saveLLM,
        setImg,
        saveImg,
      },
    }),
    [apiOnline, project, projects, chapters, characters, world, plot, llm, img, toasts],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
