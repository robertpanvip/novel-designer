/* ============================================================
   砚墨 · 小说设计器 — 创作台 Writer（核心创作页）
   三段式布局：章节列表 / 编辑器 / AI 创作助手。
   正文受控 + 简单防抖写入 store；AI 生成走 api 存根。
   TODO: 接入真实后端 —— 替换 runAI 存根为真实接口调用
   ============================================================ */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  Settings,
  ArrowRightToLine,
  Maximize2,
  Wand2,
  Repeat,
  Sprout,
  ShieldCheck,
  Square,
  Pilcrow,
  Quote,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { Card, Button, Input, Select, Tag, EmptyState } from '../components/ui';
import { useStore } from '../store/AppStore';
import { runAI } from '../api/llm';

// 章节状态 → 文案 / 状态点颜色
const STATUS_META = {
  done: { label: '已完成', color: 'var(--success)' },
  revising: { label: '修订中', color: 'var(--warning)' },
  draft: { label: '草稿', color: 'var(--text-faint)' },
};

// AI 动作配置（图标 + 文案）
const AI_ACTIONS = [
  { key: 'continue', label: '续写', icon: ArrowRightToLine },
  { key: 'expand', label: '扩写', icon: Maximize2 },
  { key: 'polish', label: '润色', icon: Wand2 },
  { key: 'rewrite', label: '改写', icon: Repeat },
  { key: 'brainstorm', label: '灵感', icon: Sprout },
  { key: 'consistency', label: '一致性检查', icon: ShieldCheck },
];

export default function Writer() {
  const { chapters, llm, actions } = useStore();
  const navigate = useNavigate();

  // 选中章节（默认第一章）
  const [selectedId, setSelectedId] = useState(chapters[0]?.id || null);
  const selected = chapters.find((c) => c.id === selectedId) || null;

  // 正文本地草稿（受控输入源），切换章节时重新载入
  const [draft, setDraft] = useState(selected?.content || '');
  useEffect(() => {
    setDraft(selected ? selected.content : '');
  }, [selectedId]);

  // 简单防抖：停止输入 400ms 后写入 store
  useEffect(() => {
    if (!selectedId) return;
    const t = setTimeout(() => actions.updateChapter(selectedId, { content: draft }), 400);
    return () => clearTimeout(t);
  }, [draft, selectedId]);

  // 新章节插入（追加到末尾）后自动选中最后一章
  const prevLen = useRef(chapters.length);
  useEffect(() => {
    if (chapters.length > prevLen.current) {
      const last = chapters[chapters.length - 1];
      if (last) setSelectedId(last.id);
    }
    prevLen.current = chapters.length;
  }, [chapters.length]);

  // 正文 textarea ref：用于光标定位与选区替换
  const bodyRef = useRef(null);

  // AI 生成状态
  const [genLoading, setGenLoading] = useState(false);
  const [genAction, setGenAction] = useState(null);
  const [genResult, setGenResult] = useState('');
  const genTextRef = useRef('');
  const stopRef = useRef(false);

  const handleNewChapter = () => {
    actions.insertChapter({ title: '未命名章节' });
    actions.toast('已新建章节', 'success');
  };

  // 在光标处插入文本；caretOffset 控制插入后的光标位置
  const insertAtCursor = (text, caretOffset = text.length) => {
    if (!selected || !bodyRef.current) return;
    const el = bodyRef.current;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? start;
    const next = draft.slice(0, start) + text + draft.slice(end);
    actions.updateChapter(selectedId, { content: next });
    setDraft(next);
    const pos = start + caretOffset;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    actions.toast('已插入', 'success');
  };

  // 执行 AI 动作：流式展示生成结果，生成中可「停止」
  const handleAI = async (action) => {
    if (!selected) {
      actions.toast('请先在左侧选择章节', 'warning');
      return;
    }
    if (genLoading) return;
    stopRef.current = false;
    setGenAction(action);
    setGenLoading(true);
    setGenResult('');
    genTextRef.current = '';
    // TODO: 接入真实后端 —— 替换 runAI 存根为真实接口调用
    try {
      await runAI({
        action,
        context: { title: selected.title, content: selected.content, char: '陆昭' },
        onDelta: (t) => {
          if (stopRef.current) return; // 已停止：忽略后续增量
          genTextRef.current += t;
          setGenResult(genTextRef.current);
        },
      });
      if (stopRef.current) {
        actions.toast('已停止生成', 'default');
      } else {
        actions.toast('已生成', 'success');
        if (typeof llm.useCount === 'number') actions.setLLM({ useCount: llm.useCount + 1 });
      }
    } catch {
      actions.toast('生成失败，请稍后再试', 'danger');
    } finally {
      setGenLoading(false);
    }
  };

  // 将生成结果追加到正文末尾
  const appendResult = () => {
    if (!selected || !genResult) return;
    const next = draft ? `${draft}\n\n${genResult}` : genResult;
    actions.updateChapter(selectedId, { content: next });
    setDraft(next);
    actions.toast('已插入到正文末尾', 'success');
  };

  // 用生成结果替换正文中选中的文本（未选中则忽略并提示）
  const replaceSelection = () => {
    if (!selected || !genResult || !bodyRef.current) return;
    const el = bodyRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start == null || start === end) {
      actions.toast('请先在正文中选中要替换的文本', 'warning');
      return;
    }
    const next = draft.slice(0, start) + genResult + draft.slice(end);
    actions.updateChapter(selectedId, { content: next });
    setDraft(next);
    actions.toast('已替换选中文本', 'success');
  };

  const currentLabel = AI_ACTIONS.find((a) => a.key === genAction)?.label || '';

  return (
    <div style={{ height: 'calc(100vh - var(--topbar-h) - 120px)', minHeight: 520, display: 'flex', gap: 16 }}>
      {/* ===== 左栏：章节列表 ===== */}
      <Card style={{ width: 240, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div className="row-between">
            <span className="display" style={{ fontSize: 15, fontWeight: 700 }}>
              章节
            </span>
            <span className="mono faint" style={{ fontSize: 12 }}>
              {chapters.length}
            </span>
          </div>
          <Button variant="gold" size="sm" icon={Plus} onClick={handleNewChapter} style={{ width: '100%', marginTop: 10 }}>
            新章节
          </Button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {chapters.map((c) => {
            const meta = STATUS_META[c.status] || STATUS_META.draft;
            const active = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderLeft: '3px solid transparent',
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  borderLeftColor: active ? 'var(--primary)' : 'transparent',
                  transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', flex: 'none' }}>
                    第{c.no}章
                  </span>
                  <span
                    className="truncate"
                    style={{
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--text)' : 'var(--text-sub)',
                    }}
                  >
                    {c.title}
                  </span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flex: 'none' }} />
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {meta.label}
                  </span>
                  <span className="mono faint" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
                    {c.wordCount} 字
                  </span>
                </div>
              </div>
            );
          })}
          {chapters.length === 0 && (
            <div className="faint" style={{ padding: 20, textAlign: 'center', fontSize: 12.5 }}>
              暂无章节
            </div>
          )}
        </div>
      </Card>

      {/* ===== 中栏：编辑器 ===== */}
      <Card style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* 顶部工具栏：标题 / 状态 / 字数 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div className="row" style={{ gap: 10 }}>
                <Input
                  value={selected.title}
                  onChange={(e) => actions.updateChapter(selectedId, { title: e.target.value })}
                  placeholder="章节标题"
                  style={{ flex: 1, fontWeight: 600, fontSize: 15 }}
                />
                <Select
                  value={selected.status}
                  onChange={(e) => actions.updateChapter(selectedId, { status: e.target.value })}
                  style={{ width: 132, flex: 'none' }}
                >
                  <option value="draft">草稿</option>
                  <option value="revising">修订中</option>
                  <option value="done">已完成</option>
                </Select>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-faint)', alignSelf: 'center', flex: 'none' }}>
                  {draft.length.toLocaleString()} 字
                </span>
              </div>
            </div>

            {/* 正文：受控 textarea，高度撑满中栏 */}
            <textarea
              ref={bodyRef}
              className="textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="从这里开始书写《雾港潮生》的故事…"
              style={{
                flex: 1,
                minHeight: 0,
                border: 'none',
                borderRadius: 0,
                background: 'transparent',
                resize: 'none',
                fontSize: 15,
                lineHeight: 1.9,
                padding: '18px 22px',
              }}
            />

            {/* 底部工具栏：轻量插入操作 */}
            <div className="row" style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', gap: 6 }}>
              <Button variant="ghost" size="sm" icon={Pilcrow} onClick={() => insertAtCursor('\n\n—— · ——\n\n')}>
                插入分节线
              </Button>
              <Button variant="ghost" size="sm" icon={Quote} onClick={() => insertAtCursor('「」', 1)}>
                插入对话引号
              </Button>
              <div className="grow" />
              <span className="faint" style={{ fontSize: 12 }}>
                更新于 {selected.updatedAt}
              </span>
            </div>
          </>
        ) : (
          /* 空态：无章节 */
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
            <EmptyState
              icon={BookOpen}
              title="还没有章节"
              desc="在左侧点击「新章节」创建第一章，开始《雾港潮生》的创作。"
              action={
                <Button icon={Plus} onClick={handleNewChapter}>
                  新章节
                </Button>
              }
            />
          </div>
        )}
      </Card>

      {/* ===== 右栏：AI 创作助手 ===== */}
      <Card style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 头部：模型名 / 未配置提示 */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <Sparkles size={15} style={{ color: 'var(--primary)' }} />
              <span className="display" style={{ fontSize: 15, fontWeight: 700 }}>
                AI 创作助手
              </span>
            </div>
            <Tag tone="t-gold">{llm.model || '未配置模型'}</Tag>
          </div>
          {(!llm.model || !llm.apiKey) && (
            <Button variant="outline" size="sm" icon={Settings} onClick={() => navigate('/settings')} style={{ width: '100%', marginTop: 10 }}>
              去大模型配置
            </Button>
          )}
        </div>

        {/* 六个动作按钮 */}
        <div
          style={{
            padding: 12,
            borderBottom: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {AI_ACTIONS.map((a) => (
            <Button
              key={a.key}
              variant="ghost"
              size="sm"
              icon={a.icon}
              disabled={genLoading}
              onClick={() => handleAI(a.key)}
              style={{ justifyContent: 'flex-start', width: '100%' }}
            >
              {a.label}
            </Button>
          ))}
        </div>

        {/* 生成结果区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {genLoading ? (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <svg
                  className="btn-ico spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ color: 'var(--primary)' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span style={{ fontSize: 12.5, color: 'var(--text-sub)' }}>正在{currentLabel}…</span>
                <div className="grow" />
                <Button variant="ghost" size="sm" icon={Square} onClick={() => { stopRef.current = true; }}>
                  停止
                </Button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="skeleton" style={{ height: 13, width: '100%' }} />
                <div className="skeleton" style={{ height: 13, width: '90%' }} />
                <div className="skeleton" style={{ height: 13, width: '96%' }} />
                <div className="skeleton" style={{ height: 13, width: '72%' }} />
              </div>
            </>
          ) : genResult ? (
            <>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: 'var(--text-sub)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 14,
                }}
              >
                {genResult}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" icon={ChevronRight} onClick={appendResult}>
                  插入到正文末尾
                </Button>
                <Button variant="outline" size="sm" onClick={replaceSelection}>
                  替换选中文本
                </Button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 8px' }}>
              <p className="faint" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                选择下方动作，AI 将基于当前章节内容生成结果，并支持流式预览与一键插入正文。
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
