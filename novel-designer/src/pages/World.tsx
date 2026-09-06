/* ============================================================
   砚墨 · 小说设计器 — 世界观页面
   结构：统计行 → 分类区块（grid-2）→ 城史时间线
   交互：新增条目 Modal（选分类 + 标题 + 描述）、删除需 confirm
   写操作均通过 AppStore actions（TODO: 接入真实后端时替换 actions 内部实现）
   ============================================================ */
import { useMemo, useState } from 'react';
import { Globe2, Plus, Trash2, MapPin, History, Building2, ScrollText, ImagePlus, RefreshCw, Sparkles, Loader2, FileText, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { dbApi } from '../api/db';
import { sceneImageUrl, generateSceneImage } from '../api/image';
import {
  PageHead,
  Button,
  IconBtn,
  Card,
  Tag,
  Field,
  Input,
  Textarea,
  Select,
  Modal,
  EmptyState,
  SectionHead,
  StatCard,
} from '../components/ui';
import type { ImageConfig, StoreActions, WorldImportSection, WorldItem, WorldSection } from '../types';

/* 分类 → 图标映射（未命中时回退地球图标） */
const SECTION_ICONS: Record<string, LucideIcon> = { 地理: MapPin, 历史: History, 势力: Building2, 规则: ScrollText };

/* ---------------- 场景配图横幅 ----------------
   统一风格来自「AI 配图」配置(config.style)，保证各场景美术风格一致；
   变体仅改变构图/机位，不改变主题描述。 */
function SceneBanner({ s, img, actions, variant, onRegen }: { s: WorldSection; img: ImageConfig; actions: StoreActions; variant: number; onRegen: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const url = sceneImageUrl({ config: img, scene: s, variant });

  const regen = async () => {
    if (loading) return;
    setLoading(true);
    setErr(false);
    try {
      // TODO: 接入真实后端 —— 以统一风格 + seed 调用真实文生图接口
      await generateSceneImage({ config: img, scene: s, variant: variant + 1 });
      onRegen();
      actions.setImg({ useCount: (img.useCount || 0) + 1 });
      actions.toast(`已为「${s.type} · ${s.title}」重新生成场景图，保持统一风格`, 'success');
    } catch {
      actions.toast('场景图生成失败，请检查「AI 配图」配置', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`scene-banner ${loading ? 'loading' : ''}`} style={{ marginBottom: 18 }}>
      {err ? (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
          <span className="faint" style={{ fontSize: 13 }}>场景图加载失败</span>
        </div>
      ) : (
        <img src={url} alt={`${s.type} · ${s.title} 场景图`} loading="lazy" onError={() => setErr(true)} />
      )}
      <div className="scene-cap">
        <span className="scene-title">{s.type} · {s.title}</span>
        <button className="img-chip" onClick={regen} disabled={loading} title="按统一风格重新生成场景配图">
          {loading ? <RefreshCw className="spin" /> : <ImagePlus className="i" />}
          <span>{loading ? '生成中' : 'AI 配图'}</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- 页面 ---------------- */
export default function World() {
  const { world, img, actions } = useStore();
  const { toast } = actions;
  const [modalOpen, setModalOpen] = useState(false);
  const [sectionId, setSectionId] = useState(world.sections[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  /* 编辑中的条目（null = 新增模式） */
  const [editingItem, setEditingItem] = useState<{ sid: string; item: WorldItem } | null>(null);
  /* 分区编辑 Modal */
  const [secModalOpen, setSecModalOpen] = useState(false);
  const [editingSec, setEditingSec] = useState<WorldSection | null>(null);
  const [secType, setSecType] = useState('');
  const [secTitle, setSecTitle] = useState('');
  const [secDesc, setSecDesc] = useState('');
  /* 每个分类的配图变体序号（仅变构图，风格统一） */
  const [variants, setVariants] = useState<Record<string, number>>({});
  const bumpVariant = (id: string) => setVariants((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));

  /* ---------- AI 提炼世界观 ---------- */
  const [aiOpen, setAiOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<WorldImportSection[] | null>(null);
  const [aiChecked, setAiChecked] = useState<Set<number>>(new Set());

  const openAI = () => {
    setRawText('');
    setAiResult(null);
    setAiChecked(new Set());
    setAiOpen(true);
  };

  const runExtract = async () => {
    if (!rawText.trim()) {
      toast('请先粘贴原始文本', 'warning');
      return;
    }
    setAiBusy(true);
    try {
      const r = await dbApi.extractWorld(rawText);
      if (!r.ai || !r.sections.length) {
        toast(r.message || 'AI 未能从文本中提炼出世界观，请换段更详细的文本试试', 'warning');
        return;
      }
      setAiResult(r.sections);
      setAiChecked(new Set(r.sections.map((_, i) => i)));
      toast(`AI 提炼出 ${r.sections.length} 个分区，请确认后导入`, 'success');
    } catch {
      toast('提炼失败：后端未连接或大模型调用出错', 'danger');
    } finally {
      setAiBusy(false);
    }
  };

  const doImport = async () => {
    if (!aiResult) return;
    const picked = aiResult.filter((_, i) => aiChecked.has(i));
    if (!picked.length) {
      toast('请至少勾选一个分区', 'warning');
      return;
    }
    setAiBusy(true);
    try {
      await actions.importWorld(picked);
      setAiOpen(false);
      setAiResult(null);
    } catch {
      toast('导入失败，请重试', 'danger');
    } finally {
      setAiBusy(false);
    }
  };

  const toggleCheck = (i: number) => {
    setAiChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  /* 打开新增条目 Modal（可选预选分类） */
  const openAdd = (sid?: string) => {
    setEditingItem(null);
    setSectionId(sid || world.sections[0]?.id || '');
    setTitle('');
    setDesc('');
    setModalOpen(true);
  };

  /* 打开编辑条目 Modal（预填） */
  const openEdit = (sid: string, item: WorldItem) => {
    setEditingItem({ sid, item });
    setSectionId(sid);
    setTitle(item.title);
    setDesc(item.desc);
    setModalOpen(true);
  };

  /* 提交（新增或保存编辑） */
  const submit = () => {
    if (!title.trim()) {
      toast('标题不能为空', 'warning');
      return;
    }
    if (!desc.trim()) {
      toast('描述不能为空', 'warning');
      return;
    }
    if (editingItem) {
      actions.updateWorldItem(editingItem.sid, editingItem.item.id, { title: title.trim(), desc: desc.trim() });
      toast('条目已更新', 'success');
    } else {
      if (!sectionId) {
        toast('请选择所属分类', 'warning');
        return;
      }
      actions.addWorldItem(sectionId, { title: title.trim(), desc: desc.trim() });
      const sec = world.sections.find((s) => s.id === sectionId);
      toast(`已在「${sec?.title || '分类'}」新增条目`, 'success');
    }
    setModalOpen(false);
  };

  /* 分区编辑 */
  const openEditSec = (s: WorldSection) => {
    setEditingSec(s);
    setSecType(s.type);
    setSecTitle(s.title);
    setSecDesc(s.desc);
    setSecModalOpen(true);
  };

  const submitSec = () => {
    if (!editingSec) return;
    if (!secType.trim()) {
      toast('分类名不能为空', 'warning');
      return;
    }
    if (!secTitle.trim()) {
      toast('标题不能为空', 'warning');
      return;
    }
    actions.updateWorldSection(editingSec.id, { type: secType.trim(), title: secTitle.trim(), desc: secDesc.trim() });
    toast('分区已更新', 'success');
    setSecModalOpen(false);
  };

  /* 删除条目（先 confirm） */
  const remove = (sid: string, item: WorldItem) => {
    if (!window.confirm(`确定删除设定「${item.title}」？此操作不可撤销。`)) return;
    actions.removeWorldItem(sid, item.id);
    toast(`已删除「${item.title}」`);
  };

  /* 分类统计 */
  const stats = useMemo(
    () =>
      world.sections.map((s) => ({
        type: s.type,
        count: s.items.length,
        icon: SECTION_ICONS[s.type] || Globe2,
      })),
    [world.sections],
  );

  /* 世界观为空（无分类）兜底 */
  if (world.sections.length === 0) {
    return (
      <div>
        <PageHead
          title="世界观"
          sub="故事发生的这片天地，还是一片空白。"
          actions={<Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>}
        />
        <EmptyState
          icon={Globe2}
          title="世界观还没有条目"
          desc="先搭建地理、历史、势力与规则，让故事有枝可依。"
          action={<Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="世界观"
        sub="临港的每一处地名都像被海雾腌过——地理、旧案、势力与暗语，共同托起这个故事。"
        actions={
          <>
            <Button variant="outline" icon={Sparkles} onClick={openAI}>AI 提炼世界观</Button>
            <Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>
          </>
        }
      />

      {/* 统计行 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {stats.map((s, i) => (
          <StatCard key={s.type} icon={s.icon} value={s.count} label={`${s.type}条目`} delay={40 + i * 50} />
        ))}
      </div>

      {/* 分类区块 */}
      <div className="grid grid-2">
        {world.sections.map((s, i) => (
          <Card key={s.id} className="reveal" style={{ '--d': `${120 + i * 60}ms`, padding: '20px 22px' }}>
            {/* 场景配图：统一风格 + 变体重生成 */}
            <SceneBanner
              s={s}
              img={img}
              actions={actions}
              variant={variants[s.id] || 0}
              onRegen={() => bumpVariant(s.id)}
            />
            <SectionHead
              title={`${s.type} · ${s.title}`}
              sub={s.desc}
              right={
                <div className="row" style={{ gap: 6 }}>
                  <IconBtn icon={Pencil} label={`编辑分区 ${s.title}`} onClick={() => openEditSec(s)} />
                  <Button variant="outline" size="sm" icon={Plus} onClick={() => openAdd(s.id)}>
                    添加
                  </Button>
                </div>
              }
            />
            {s.items.length === 0 ? (
              /* 轻量空态：该分类暂无条目 */
              <div className="empty" style={{ padding: '26px 16px' }}>
                <p>该分类下还没有条目，点击右上角「添加」补上第一笔设定。</p>
              </div>
            ) : (
              <div>
                {s.items.map((it, j) => (
                  <div key={it.id}>
                    <div className="row-between" style={{ padding: '10px 2px', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="display" style={{ fontSize: 14.5, fontWeight: 700 }}>{it.title}</div>
                        <div className="sub" style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.6 }}>
                          {it.desc}
                        </div>
                      </div>
                      <IconBtn icon={Pencil} label={`编辑 ${it.title}`} onClick={() => openEdit(s.id, it)} />
                      <IconBtn icon={Trash2} danger label={`删除 ${it.title}`} onClick={() => remove(s.id, it)} />
                    </div>
                    {/* 条目间浅色分隔 */}
                    {j < s.items.length - 1 && (
                      <div style={{ height: 1, background: 'var(--border)', opacity: 0.7 }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 城史时间线 */}
      {world.timeline.length > 0 && (
        <Card className="reveal" style={{ '--d': '220ms', padding: '22px 24px', marginTop: 24 }}>
          <SectionHead title="城史时间线" sub="纵向时间轴，末项以朱砂高亮为「现在」。" />
          <div style={{ padding: '4px 4px 0' }}>
            {world.timeline.map((t, i) => {
              const isLast = i === world.timeline.length - 1;
              return (
                <div key={t.id} style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
                  {/* 左侧 era（mono 金字） */}
                  <div
                    className="mono"
                    style={{
                      width: 56,
                      flex: 'none',
                      textAlign: 'right',
                      paddingTop: 6,
                      fontSize: 13,
                      color: 'var(--gold)',
                    }}
                  >
                    {t.era}
                  </div>

                  {/* 连接线 + 圆点（颜色取该条目 color，末项朱砂发光） */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flex: 'none' }}>
                    <div
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: '50%',
                        marginTop: 7,
                        background: isLast ? 'var(--primary)' : t.color,
                        boxShadow: isLast
                          ? '0 0 0 4px var(--primary-soft), 0 0 14px var(--primary-glow)'
                          : `0 0 0 3px ${t.color}33`,
                      }}
                    />
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, minHeight: 36, background: 'var(--border)' }} />
                    )}
                  </div>

                  {/* 右侧 title + desc */}
                  <div style={{ flex: 1, paddingBottom: 26, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="display" style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</span>
                      {isLast && <Tag tone="t-primary">现在</Tag>}
                    </div>
                    <div className="sub" style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.6 }}>
                      {t.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 新增 / 编辑条目 Modal */}
      <Modal
        open={modalOpen}
        title={editingItem ? '编辑世界观条目' : '新增世界观条目'}
        onClose={() => setModalOpen(false)}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
            <Button icon={Plus} onClick={submit}>{editingItem ? '保存修改' : '创建条目'}</Button>
          </>
        }
      >
        {!editingItem && (
          <Field label="所属分类">
            <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {world.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.type} · {s.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="标题" hint="必填 · 这条设定的名字">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：雾谷湿地" />
        </Field>
        <Field label="描述" hint="必填 · 一句话交代它在故事里的作用">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="城外湿地，废弃的引水渠与旧船坞，走私与逃亡的灰色地带…" />
        </Field>
      </Modal>

      {/* 编辑分区 Modal */}
      <Modal
        open={secModalOpen}
        title="编辑分区"
        onClose={() => setSecModalOpen(false)}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSecModalOpen(false)}>取消</Button>
            <Button icon={Pencil} onClick={submitSec}>保存分区</Button>
          </>
        }
      >
        <Field label="分类" hint="决定归属与图标，如：地理 / 历史 / 势力 / 规则">
          <Input value={secType} onChange={(e) => setSecType(e.target.value)} placeholder="地理" />
        </Field>
        <Field label="标题">
          <Input value={secTitle} onChange={(e) => setSecTitle(e.target.value)} placeholder="地理与地标" />
        </Field>
        <Field label="概述" hint="选填 · 这个分区讲什么">
          <Textarea value={secDesc} onChange={(e) => setSecDesc(e.target.value)} rows={3} placeholder="临港的街头巷尾与水域…" />
        </Field>
      </Modal>

      {/* AI 提炼世界观 Modal */}
      <Modal
        open={aiOpen}
        title="AI 提炼世界观"
        onClose={() => !aiBusy && setAiOpen(false)}
        width={680}
        footer={
          aiResult ? (
            <>
              <Button variant="ghost" onClick={() => setAiResult(null)} disabled={aiBusy}>重新提炼</Button>
              <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiBusy}>取消</Button>
              <Button icon={Sparkles} onClick={doImport} disabled={aiBusy || aiChecked.size === 0}>
                导入勾选项（{aiChecked.size} 个分区）
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiBusy}>取消</Button>
              <Button icon={aiBusy ? Loader2 : Sparkles} onClick={runExtract} disabled={aiBusy}>
                {aiBusy ? '提炼中…（长文本可能需要 1~2 分钟）' : '开始提炼'}
              </Button>
            </>
          )
        }
      >
        {!aiResult ? (
          <>
            <Field label="原始文本" hint="粘贴任意长度的素材：历史资料、旧稿、笔记、大纲均可，AI 只提炼有依据的设定">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder={'把你的世界观素材粘到这里……\n\n例如一段城市历史、一份势力设定草稿、几页小说旧稿。\nAI 会将其整理为「地理 / 历史 / 势力 / 规则」等分区条目，导入前可逐区勾选。'}
                style={{ lineHeight: 1.7 }}
              />
            </Field>
            <span className="faint" style={{ fontSize: 12 }}>
              已输入 {rawText.length} 字（提取前 2 万字） · 需要在「设置」里配置好大模型 API Key
            </span>
          </>
        ) : (
          <>
            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
              {aiResult.map((sec, i) => {
                const checked = aiChecked.has(i);
                return (
                  <div
                    key={`${sec.type}-${i}`}
                    style={{
                      border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      background: checked ? 'var(--primary-soft, rgba(0,0,0,0.03))' : 'transparent',
                    }}
                    onClick={() => toggleCheck(i)}
                  >
                    <div className="row-between">
                      <label className="row" style={{ gap: 8, cursor: 'pointer', minWidth: 0 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(i)} onClick={(e) => e.stopPropagation()} />
                        <span className="display" style={{ fontSize: 14.5, fontWeight: 700 }}>
                          {sec.type}{sec.title && sec.title !== sec.type ? ` · ${sec.title}` : ''}
                        </span>
                        <Tag tone="t-sub">{sec.items.length} 条</Tag>
                      </label>
                    </div>
                    {sec.desc && (
                      <div className="sub" style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.6 }}>
                        {sec.desc}
                      </div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {sec.items.slice(0, 5).map((it, j) => (
                        <div key={j} className="row" style={{ gap: 6, fontSize: 12.5, minWidth: 0 }}>
                          <FileText size={12} style={{ color: 'var(--text-faint)', flex: 'none' }} />
                          <b style={{ flex: 'none' }}>{it.title}</b>
                          <span className="faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.desc}
                          </span>
                        </div>
                      ))}
                      {sec.items.length > 5 && (
                        <span className="faint" style={{ fontSize: 12 }}>…共 {sec.items.length} 条</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
              导入时：与现有分区同类的条目会追加进去，同名条目自动跳过；全新分类会新建分区。
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}