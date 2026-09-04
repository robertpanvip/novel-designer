/* ============================================================
   砚墨 · 小说设计器 — 情节大纲页（Plot）
   ------------------------------------------------------------
   三幕结构总览 + 分幕节拍流。所有读写一律经由 useStore() 的
   plot 数据与 actions，页面不直接改数据。
   动效：reveal + --d 错峰；图标仅用 lucide-react。
   ============================================================ */
import { useMemo, useState } from 'react';
import {
  GitBranch, Plus, Trash2, CheckCircle2, RotateCcw, ListChecks,
} from 'lucide-react';
import {
  Button, IconBtn, Field, Input, Select, Textarea, Tag, Card,
  SectionHead, PageHead, Modal, EmptyState, ProgressRing,
} from '../components/ui';
import { useStore } from '../store/AppStore';
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
    });
    setModalOpen(true);
  };

  const set = <K extends keyof PlotForm>(k: K, v: PlotForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : null));

  /* 新增节拍：校验所属幕与标题后写入 store */
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
    actions.addPlotNode(form.actId, {
      type: form.type,
      chapterNo: Number(form.chapterNo) || 0,
      title: form.title.trim(),
      summary: form.summary.trim(),
      conflict: form.conflict.trim(),
      pov: form.pov.trim() || '陆昭',
    });
    actions.toast('已新增节拍', 'success');
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

  return (
    <>
      <PageHead
        accent="情节"
        title="大纲"
        sub="三幕式结构总览 · 从「引潮」到「退潮」，每一幕用专属色标注，节拍即剧情的最小推进单元。"
        actions={
          <Button variant="primary" icon={Plus} onClick={openModal}>
            新增节拍
          </Button>
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

      {/* ---- 新增节拍 Modal ---- */}
      {form && (
        <Modal
          open={modalOpen}
          title="新增节拍"
          onClose={() => setModalOpen(false)}
          width={640}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
              <Button variant="primary" icon={Plus} onClick={submit}>创建节拍</Button>
            </>
          }
        >
          <div className="grid grid-2" style={{ gap: 4 }}>
            <Field label="所属幕" hint="选择该节拍所处的三幕结构">
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
    </>
  );
}