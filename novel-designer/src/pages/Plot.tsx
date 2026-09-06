/* ============================================================
   砚墨 · 小说设计器 — 情节大纲页（Plot）
   ------------------------------------------------------------
   三幕结构总览 + 分幕节拍流。所有读写一律经由 useStore() 的
   plot 数据与 actions，页面不直接改数据。
   动效：reveal + --d 错峰；图标仅用 lucide-react。
   ============================================================ */
import { useMemo, useState } from 'react';
import {
  GitBranch, Plus, Trash2, CheckCircle2, RotateCcw, ListChecks, Sparkles, Loader2, Pencil,
} from 'lucide-react';
import {
  Button, IconBtn, Field, Input, Select, Textarea, Tag, Card,
  SectionHead, PageHead, Modal, EmptyState, ProgressRing,
} from '../components/ui';
import { useStore } from '../store/AppStore';
import { dbApi } from '../api/db';
import type { ExtractedPlotBeat } from '../api/db';
import type { PlotNode } from '../types';

/* 节拍类型 → Tag tone 分色 */
const TYPE_TONE: Record<string, string> = {
  引子: 't-primary',
  承: 't-gold',
  转: 't-warning',
  高潮: 't-danger',
  合: 't-success',
};

/* 幕 phase → Tag tone（起 / 承 / 转·合 各取一色） */
const PHASE_TONE: Record<string, string> = { 起: 't-primary', 承: 't-gold', '转 · 合': 't-danger' };

/* 可选的节拍类型 */
const NODE_TYPES: string[] = ['引子', '承', '转', '高潮', '合'];

interface PlotForm {
  actId: string;
  chapterNo: number;
  type: string;
  title: string;
  summary: string;
  conflict: string;
  pov: string;
  /** 编辑模式：被编辑节拍的 id（新增时为 null） */
  editingId: string | null;
  /** 编辑模式：节点当前所属幕（跨幕移动时以此定位） */
  origActId: string;
}

export default function Plot() {
  const { plot, actions } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PlotForm | null>(null);

  const totalNodes = useMemo(
    () => plot.acts.reduce((s, a) => s + a.nodes.length, 0),
    [plot.acts],
  );
  const doneNodes = useMemo(
    () => plot.acts.reduce((s, a) => s + a.nodes.filter((n) => n.status === 'done').length, 0),
    [plot.acts],
  );
  const pct = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;

  /* 打开新增节拍：默认选中第一幕，章节号顺延 */
  const openModal = () => {
    const maxCh = Math.max(0, ...plot.acts.flatMap((a) => a.nodes.map((n) => n.chapterNo || 0)));
    setForm({
      actId: plot.acts[0]?.id || '',
      chapterNo: maxCh + 1,
      type: '承',
      title: '',
      summary: '',
      conflict: '',
      pov: '陆昭',
      editingId: null,
      origActId: '',
    });
    setModalOpen(true);
  };

  /* 打开编辑节拍：预填当前值 */
  const openEdit = (actId: string, node: PlotNode) => {
    setForm({
      actId,
      chapterNo: node.chapterNo,
      type: node.type,
      title: node.title,
      summary: node.summary || '',
      conflict: node.conflict || '',
      pov: node.pov,
      editingId: node.id,
      origActId: actId,
    });
    setModalOpen(true);
  };

  const set = <K extends keyof PlotForm>(k: K, v: PlotForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : null));

  /* 新增 / 保存编辑节拍 */
  const submit = () => {
    if (!form) return;
    if (!form.actId) {
      actions.toast('请选择所属幕', 'warning');
      return;
    }
    if (!form.title.trim()) {
      actions.toast('请填写节拍标题', 'warning');
      return;
    }
    const fields = {
      type: form.type,
      chapterNo: Number(form.chapterNo) || 0,
      title: form.title.trim(),
      summary: form.summary.trim(),
      conflict: form.conflict.trim(),
      pov: form.pov.trim() || '陆昭',
    };
    if (form.editingId) {
      /* 编辑：actId 变了则附带跨幕移动 */
      actions.updatePlotNode(form.origActId, form.editingId, {
        ...fields,
        ...(form.actId !== form.origActId ? { actId: form.actId } : {}),
      });
      actions.toast(form.actId !== form.origActId ? '已保存并移动到新幕' : '已保存修改', 'success');
    } else {
      actions.addPlotNode(form.actId, fields);
      actions.toast('已新增节拍', 'success');
    }
    setModalOpen(false);
  };

  /* 完成状态切换 */
  const toggleStatus = (actId: string, node: PlotNode) => {
    const next = node.status === 'done' ? 'draft' : 'done';
    actions.updatePlotNode(actId, node.id, { status: next });
    actions.toast(next === 'done' ? `「${node.title}」已标记完成` : `「${node.title}」恢复为草稿`);
  };

  /* 删除节点 */
  const removeNode = (actId: string, node: PlotNode) => {
    if (window.confirm(`确定删除节拍「${node.title}」？`)) {
      actions.removePlotNode(actId, node.id);
      actions.toast('已删除节拍', 'success');
    }
  };

  /* ---------- AI 提炼节拍 ---------- */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiBeats, setAiBeats] = useState<ExtractedPlotBeat[] | null>(null);
  const [aiChecked, setAiChecked] = useState<Set<number>>(new Set());

  const openAI = () => {
    setAiText('');
    setAiBeats(null);
    setAiChecked(new Set());
    setAiOpen(true);
  };

  const runExtract = async () => {
    if (!plot.acts.length) {
      actions.toast('请先建立幕结构，再进行提炼', 'warning');
      return;
    }
    if (!aiText.trim()) {
      actions.toast('请先粘贴剧情素材', 'warning');
      return;
    }
    setAiBusy(true);
    try {
      const r = await dbApi.extractPlot(aiText);
      if (!r.ai || !r.beats.length) {
        actions.toast(r.message || 'AI 未能提炼出节拍，请换段更详细的剧情文本试试', 'warning');
        return;
      }
      setAiBeats(r.beats);
      setAiChecked(new Set(r.beats.map((_, i) => i)));
      actions.toast(`AI 提炼出 ${r.beats.length} 个节拍，请确认后导入`, 'success');
    } catch {
      actions.toast('提炼失败：后端未连接或大模型调用出错', 'danger');
    } finally {
      setAiBusy(false);
    }
  };

  /* 修改预览中的某个节拍字段 */
  const patchBeat = (i: number, patch: Partial<ExtractedPlotBeat>) =>
    setAiBeats((bs) => (bs ? bs.map((b, j) => (j === i ? { ...b, ...patch } : b)) : bs));

  const toggleBeat = (i: number) => {
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

  /* 导入勾选节拍：复用现有新增链路（在线同步后端，离线也有本地兜底） */
  const doImport = () => {
    if (!aiBeats) return;
    const picked = aiBeats.filter((_, i) => aiChecked.has(i));
    if (!picked.length) {
      actions.toast('请至少勾选一个节拍', 'warning');
      return;
    }
    let imported = 0;
    picked.forEach((b) => {
      const act = plot.acts.find((a) => a.phase === b.actPhase) ?? plot.acts[0];
      if (!act) return;
      actions.addPlotNode(act.id, {
        type: b.type,
        chapterNo: b.chapterNo,
        title: b.title,
        summary: b.summary,
        conflict: b.conflict,
        pov: b.pov || '陆昭',
      });
      imported += 1;
    });
    actions.toast(imported ? `已导入 ${imported} 个节拍` : '没有可导入的节拍（幕结构缺失）', imported ? 'success' : 'warning');
    setAiOpen(false);
    setAiBeats(null);
  };

  return (
    <>
      <PageHead
        accent="情节"
        title="大纲"
        sub="三幕式结构总览 · 从「引潮」到「退潮」，每一幕用专属色标注，节拍即剧情的最小推进单元。"
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="outline" icon={Sparkles} onClick={openAI}>
              AI 提炼节拍
            </Button>
            <Button variant="primary" icon={Plus} onClick={openModal}>
              新增节拍
            </Button>
          </div>
        }
      />

      {plot.acts.length === 0 ? (
        /* 空态：整页无幕 */
        <Card className="reveal" style={{ '--d': '40ms', padding: '20px 22px' }}>
          <EmptyState
            icon={GitBranch}
            title="情节结构尚未建立"
            desc="先为小说建立三幕结构，再为每一幕添加节拍。"
            action={<Button variant="outline" icon={Plus} onClick={openModal}>新增节拍</Button>}
          />
        </Card>
      ) : (
        <>
          {/* ---- 结构总览 ---- */}
          <Card className="reveal" style={{ '--d': '40ms', padding: '20px 22px' }}>
            <SectionHead
              title="结构总览"
              sub="三幕式推进 · 起 / 承 / 转 · 合"
              right={<Tag tone="t-gold">{totalNodes} 个节拍</Tag>}
            />
            <div className="grid grid-3" style={{ gap: 12 }}>
              {plot.acts.map((a) => (
                <div
                  key={a.id}
                  className="row-between"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        width: 9, height: 9, borderRadius: '50%',
                        background: a.color, boxShadow: `0 0 10px ${a.color}66`, flex: 'none',
                      }}
                    />
                    <span className="display truncate" style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</span>
                  </div>
                  <div className="row" style={{ gap: 6, flex: 'none' }}>
                    <Tag tone={PHASE_TONE[a.phase]}>{a.phase}</Tag>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{a.nodes.length}拍</span>
                  </div>
                </div>
              ))}
            </div>
            {/* 完成度 */}
            <div className="row-between" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <ProgressRing
                value={pct}
                size={78}
                stroke={7}
                color="var(--gold)"
                label={
                  <div>
                    <div className="display" style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{pct}%</div>
                    <div className="sub" style={{ fontSize: 12, marginTop: 2 }}>{doneNodes} / {totalNodes} 节拍已完成</div>
                  </div>
                }
              />
              <div style={{ textAlign: 'right', maxWidth: 320 }}>
                <div className="sub" style={{ fontSize: 12.5 }}>完成度 = 已完成节拍 ÷ 全部节拍</div>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>将节拍标记为「完成」，三幕进度随之推进。</div>
              </div>
            </div>
          </Card>

          {/* ---- 分幕节拍流 ---- */}
          {plot.acts.map((act, ai) => (
            <Card key={act.id} className="reveal" style={{ '--d': `${80 + ai * 60}ms`, padding: '20px 22px' }}>
              <SectionHead
                title={<span className="display">{act.name}</span>}
                sub={
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {act.nodes.filter((n) => n.status === 'done').length}/{act.nodes.length} 已完成
                  </span>
                }
                right={
                  <div className="row" style={{ gap: 8 }}>
                    <Tag tone={PHASE_TONE[act.phase]}>{act.phase}</Tag>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{act.nodes.length} 拍</span>
                  </div>
                }
              />

              {act.nodes.length === 0 ? (
                /* 空态：单幕无节点 */
                <EmptyState
                  icon={ListChecks}
                  title="这一幕还没有节拍"
                  desc="点击「新增节拍」，为这一幕添加第一个剧情节点。"
                  action={<Button variant="outline" size="sm" icon={Plus} onClick={openModal}>新增节拍</Button>}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {act.nodes.map((node, ni) => (
                    <Card
                      key={node.id}
                      hoverable
                      className="reveal"
                      style={{
                        '--d': `${80 + ai * 60 + (ni + 1) * 40}ms`,
                        padding: '14px 16px',
                        background: 'var(--surface-2)',
                        borderLeft: `3px solid ${act.color}`,
                      }}
                    >
                      {/* 首行：章节号 + 类型 + 状态 */}
                      <div className="row" style={{ gap: 8, minWidth: 0 }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>第 {node.chapterNo} 章</span>
                        <Tag tone={TYPE_TONE[node.type]}>{node.type}</Tag>
                        {node.status === 'done' && (
                          <Tag tone="t-success"><CheckCircle2 size={12} /> 已完成</Tag>
                        )}
                      </div>

                      <div className="display" style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{node.title}</div>
                      {node.summary && <div className="sub" style={{ fontSize: 12.5, marginTop: 2 }}>{node.summary}</div>}
                      {node.conflict && (
                        <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>冲突：{node.conflict}</div>
                      )}

                      <div className="row-between" style={{ marginTop: 10 }}>
                        <span className="mono faint" style={{ fontSize: 11 }}>POV · {node.pov}</span>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className={`btn btn-sm ${node.status === 'done' ? 'btn-outline' : 'btn-subtle'}`}
                            onClick={() => toggleStatus(act.id, node)}
                          >
                            {node.status === 'done' ? <><RotateCcw size={13} /> 撤销完成</> : <><CheckCircle2 size={13} /> 标记完成</>}
                          </button>
                          <IconBtn icon={Pencil} label={`编辑 ${node.title}`} onClick={() => openEdit(act.id, node)} />
                          <IconBtn icon={Trash2} danger label="删除节拍" onClick={() => removeNode(act.id, node)} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {/* ---- 新增 / 编辑节拍 Modal ---- */}
      {form && (
        <Modal
          open={modalOpen}
          title={form.editingId ? '编辑节拍' : '新增节拍'}
          onClose={() => setModalOpen(false)}
          width={640}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
              <Button variant="primary" icon={form.editingId ? CheckCircle2 : Plus} onClick={submit}>
                {form.editingId ? '保存修改' : '创建节拍'}
              </Button>
            </>
          }
        >
          <div className="grid grid-2" style={{ gap: 4 }}>
            <Field label="所属幕" hint={form.editingId ? '可改选其他幕，保存后自动移动' : '选择该节拍所处的三幕结构'}>
              <Select value={form.actId} onChange={(e) => set('actId', e.target.value)}>
                {plot.acts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="章节号">
              <Input type="number" min={1} value={form.chapterNo} onChange={(e) => set('chapterNo', Number(e.target.value))} />
            </Field>
            <Field label="节拍类型">
              <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                {NODE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="POV 视角" hint="本拍的叙述视角人物">
              <Input value={form.pov} onChange={(e) => set('pov', e.target.value)} placeholder="陆昭" />
            </Field>
            <Field label="标题" hint="一句话概括本拍（必填）">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="例如：灯塔灯影" />
            </Field>
            <Field label="摘要">
              <Textarea rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="本拍要发生什么…" />
            </Field>
            <Field label="冲突" hint="本拍的核心张力所在">
              <Input value={form.conflict} onChange={(e) => set('conflict', e.target.value)} placeholder="悬念 / 对立 / 代价…" />
            </Field>
          </div>
        </Modal>
      )}

      {/* ---- AI 提炼节拍 Modal（两步：贴文本 → 预览确认） ---- */}
      <Modal
        open={aiOpen}
        title="AI 提炼节拍"
        onClose={() => !aiBusy && setAiOpen(false)}
        width={720}
        footer={
          aiBeats ? (
            <>
              <Button variant="ghost" onClick={() => setAiBeats(null)}>返回修改文本</Button>
              <Button variant="primary" icon={CheckCircle2} onClick={doImport}>导入勾选节拍</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setAiOpen(false)}>取消</Button>
              <Button variant="primary" icon={Sparkles} loading={aiBusy} onClick={runExtract}>
                {aiBusy ? '提炼中…' : '开始提炼'}
              </Button>
            </>
          )
        }
      >
        {aiBeats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 430, overflowY: 'auto' }}>
            {aiBeats.map((b, i) => {
              const act = plot.acts.find((a) => a.phase === b.actPhase);
              return (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 12px',
                    opacity: aiChecked.has(i) ? 1 : 0.55,
                    background: 'var(--bg-raised)',
                  }}
                >
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input type="checkbox" checked={aiChecked.has(i)} onChange={() => toggleBeat(i)} />
                    <Select
                      value={act?.id ?? ''}
                      onChange={(e) => {
                        const a = plot.acts.find((x) => x.id === e.target.value);
                        patchBeat(i, { actPhase: a?.phase ?? b.actPhase });
                      }}
                      style={{ width: 128 }}
                    >
                      {plot.acts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </Select>
                    <Select value={b.type} onChange={(e) => patchBeat(i, { type: e.target.value })} style={{ width: 90 }}>
                      {NODE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={b.chapterNo}
                      onChange={(e) => patchBeat(i, { chapterNo: Number(e.target.value) || 0 })}
                      style={{ width: 82 }}
                    />
                    <Input value={b.title} onChange={(e) => patchBeat(i, { title: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
                  </div>
                  <Textarea
                    rows={2}
                    value={b.summary}
                    onChange={(e) => patchBeat(i, { summary: e.target.value })}
                    placeholder="摘要"
                    style={{ marginTop: 8 }}
                  />
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <Input
                      value={b.conflict}
                      onChange={(e) => patchBeat(i, { conflict: e.target.value })}
                      placeholder="冲突（可空）"
                      style={{ flex: 1 }}
                    />
                    <Input
                      value={b.pov}
                      onChange={(e) => patchBeat(i, { pov: e.target.value })}
                      placeholder="POV"
                      style={{ width: 110 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <Field
              label="剧情素材"
              hint="草稿 / 笔记 / 旧稿 / 梗概均可，最多取前 2 万字；AI 会按你现有的三幕结构归幕并编排章节号。"
            >
              <Textarea
                rows={10}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="把包含剧情的文本粘贴到这里…"
              />
            </Field>
            {aiBusy && (
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <Loader2 size={14} className="spin" style={{ color: 'var(--gold)' }} />
                <span className="sub" style={{ fontSize: 12.5 }}>AI 正在提炼节拍，长文本可能需要 1~2 分钟，请勿关闭窗口…</span>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}