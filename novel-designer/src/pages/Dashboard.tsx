/* ============================================================
   砚墨 · 小说设计器 — 工作台 Dashboard
   数据统一从 useStore 读取；今日灵感走 api 存根。
   TODO: 接入真实后端 —— 替换 runAI 存根为真实接口调用
   ============================================================ */
import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Layers,
  Users,
  Flame,
  Sparkles,
  RefreshCw,
  Plus,
  PenLine,
  GitBranch,
  ChevronRight,
  BookOpen,
  Wand2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  PageHead,
  StatCard,
  Card,
  SectionHead,
  Tag,
  Button,
  ProgressRing,
  EmptyState,
  Select,
  Modal,
} from '../components/ui';
import { useStore } from '../store/AppStore';
import { runAI } from '../api/llm';
import type { ChapterStatus, PlotAct, PlotNode } from '../types';

// 章节状态 → 文案 / Tag tone
const STATUS_META: Record<ChapterStatus, { label: string; tone: string }> = {
  done: { label: '已完成', tone: 'success' },
  revising: { label: '修订中', tone: 'warning' },
  draft: { label: '草稿', tone: 'default' },
};

// 「今日灵感」初始文案（未接入后端时的占位；接入真实模型后由流式回复取代）
const DEFAULT_INSPIRATION = `《雾港潮生》的线索正从「岸上」转向「雾中」。不妨让陆昭在重听那晚电台录音时，发现一段被剪掉的空白——停顿的三秒里，有人轻轻敲了两下麦克风。那声音像极了船笛：两声，是求救，也是认门。让林雾那句「界碑下面压着的东西，比沉船还沉」，与沈樱《雾岸》展览里的物证照片第一次正面碰撞。真正的钩子，不妨藏在一张被海水泡皱的旧登船牌上——船牌的主人，已经三十年没有露面了。`;

export default function Dashboard() {
  const { project, chapters, world, plot, actions } = useStore();
  const navigate = useNavigate();

  // 封面图加载失败 → 占位
  const [coverErr, setCoverErr] = useState(false);

  // 今日灵感
  const [insp, setInsp] = useState(DEFAULT_INSPIRATION);
  const [inspLoading, setInspLoading] = useState(false);
  const inspRef = useRef(DEFAULT_INSPIRATION);

  // 创作进度：已完成章节占比
  const doneCount = chapters.filter((c) => c.status === 'done').length;
  const doneRatio = chapters.length ? Math.round((doneCount / chapters.length) * 100) : 0;

  const recent = chapters.slice(0, 5);

  /* ---------- AI 一键成稿 ---------- */
  // 待写节拍（未完成，按章节号排序）
  const undone = useMemo(
    () =>
      plot.acts
        .flatMap((a) => a.nodes.filter((n) => n.status !== 'done').map((n) => ({ act: a, node: n })))
        .sort((x, y) => x.node.chapterNo - y.node.chapterNo),
    [plot.acts],
  );
  const [beatId, setBeatId] = useState('');
  const picked = undone.find((u) => u.node.id === beatId) ?? undone[0];

  const [genOpen, setGenOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genText, setGenText] = useState('');
  const genRef = useRef('');
  const [genMeta, setGenMeta] = useState<{ source?: string; error?: string | null } | null>(null);

  const doGenerate = async (u: { act: PlotAct; node: PlotNode }) => {
    setGenBusy(true);
    setGenText('');
    genRef.current = '';
    setGenMeta(null);
    try {
      // 世界观上下文：分区 + 条目（截断防爆 token）
      const worldCtx = world.sections
        .map(
          (s) =>
            `【${s.type} · ${s.title}】${s.desc}\n${s.items
              .slice(0, 8)
              .map((i) => `- ${i.title}：${i.desc}`)
              .join('\n')}`,
        )
        .join('\n\n')
        .slice(0, 3000);
      // 情节大纲上下文：三幕 + 全部节拍
      const plotCtx = plot.acts
        .map(
          (a) =>
            `== ${a.name}（${a.phase}）==\n${a.nodes
              .map((n) => `第${n.chapterNo}章[${n.type}]${n.title}：${n.summary || ''}${n.status === 'done' ? '（已完成）' : ''}`)
              .join('\n')}`,
        )
        .join('\n')
        .slice(0, 2200);
      const beatCtx = `第${u.node.chapterNo}章（${u.node.type}）「${u.node.title}」：${u.node.summary || '无摘要'}${
        u.node.conflict ? `。核心冲突：${u.node.conflict}` : ''
      }。POV：${u.node.pov || '未指定'}。本拍属于${u.act.name}。`;
      // 已写章节按章节号排序（防乱序）
      const written = chapters
        .filter((c) => c.content.trim())
        .slice()
        .sort((a, b) => a.no - b.no);
      // 前情提要：本章之前所有已完成章节的标题+摘要，让模型知道"之前发生了什么"
      const before = written.filter((c) => c.no < u.node.chapterNo);
      const recapCtx = before
        .map((c) => {
          const brief = (c.summary || c.content).trim().replace(/\s+/g, ' ').slice(0, 60);
          return `第${c.no}章 ${c.title}：${brief}`;
        })
        .join('\n');
      // 真正的"上一章"：章节号紧邻本章且已有正文的那一章（而非列表最后一章）
      const prev = before[before.length - 1] ?? written[written.length - 1];
      const prevEnding = prev && prev.no < u.node.chapterNo ? prev.content.slice(-1400) : '';
      // 下一章节拍：结尾钩子的指向
      const next = undone.find((x) => x.node.chapterNo > u.node.chapterNo);
      const nextBeatCtx = next
        ? `第${next.node.chapterNo}章（${next.node.type}）「${next.node.title}」：${next.node.summary || '无摘要'}`
        : '';
      await runAI({
        action: 'draft',
        context: {
          title: `第${u.node.chapterNo}章 ${u.node.title}`,
          char: u.node.pov || undefined,
          genre: project.genre,
          world: worldCtx || undefined,
          recap: recapCtx || undefined,
          plot: plotCtx || undefined,
          beat: beatCtx,
          prevEnding: prevEnding || undefined,
          nextBeat: nextBeatCtx || undefined,
        },
        onDelta: (t) => {
          genRef.current += t;
          setGenText(genRef.current);
        },
        onMeta: (m) => setGenMeta(m ?? null),
      });
    } catch {
      actions.toast('生成失败：后端未连接或大模型调用出错', 'danger');
      setGenOpen(false);
    } finally {
      setGenBusy(false);
    }
  };

  const openGenerate = () => {
    if (!picked) return;
    setGenOpen(true);
    void doGenerate(picked);
  };

  const regenerate = () => {
    if (!picked) return;
    void doGenerate(picked);
  };

  const saveDraft = () => {
    if (!picked || !genText.trim()) return;
    const text = genText.trim();
    actions.insertChapter({
      title: `第${picked.node.chapterNo}章 ${picked.node.title}`,
      content: text,
      summary: picked.node.summary || '',
      wordCount: text.length,
    });
    actions.toast('已保存为章节草稿，去创作台继续打磨', 'success');
    setGenOpen(false);
    navigate('/writer');
  };

  // 新建章节：写入 store 并 toast 提示
  const handleNewChapter = () => {
    actions.insertChapter({ title: '未命名章节' });
    actions.toast('已新建章节，去创作台开始写作吧', 'success');
  };

  // 换一批灵感：先 loading，再流式逐字追加展示回复
  const handleRefreshInsp = async () => {
    if (inspLoading) return;
    setInspLoading(true);
    setInsp('');
    inspRef.current = '';
    // TODO: 接入真实后端 —— 替换 runAI 存根为真实接口调用
    try {
      await runAI({
        action: 'brainstorm',
        context: { title: project.title, genre: project.genre, char: '陆昭' },
        onDelta: (t) => {
          inspRef.current += t;
          setInsp(inspRef.current);
        },
      });
    } finally {
      setInspLoading(false);
    }
  };

  return (
    <>
      <PageHead
        title="工作台"
        sub="欢迎回到《雾港潮生》的创作现场。海雾未散，故事仍在生长——今天也请继续打捞这个三十年前的秘密。"
      />

      {/* 数据概览 */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon={FileText} value={project.wordCount.toLocaleString()} unit="字" label="总字数" delay={0} />
        <StatCard icon={Layers} value={project.chapterCount} unit="章" label="章节数" delay={60} />
        <StatCard icon={Users} value={project.charCount} unit="位" label="角色数" delay={120} />
        <StatCard icon={Flame} value={project.streak} unit="天" label="连续创作" delay={180} />
      </div>

      {/* 主内容 + 右侧 AI 灵感栏 */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 20 }}>
          {/* ===== 当前作品 hero 卡 ===== */}
          <Card className="reveal" style={{ '--d': '240ms', padding: 24 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {/* 封面图（含失败占位） */}
              <div style={{ flex: 'none' }}>
                {coverErr ? (
                  <div
                    style={{
                      width: 220,
                      height: 124,
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-raised)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <BookOpen size={26} style={{ color: 'var(--text-faint)' }} />
                  </div>
                ) : (
                  <img
                    src={project.cover}
                    alt={`《${project.title}》封面`}
                    onError={() => setCoverErr(true)}
                    style={{
                      width: 220,
                      height: 124,
                      objectFit: 'cover',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border)',
                      display: 'block',
                    }}
                  />
                )}
              </div>

              {/* 右侧信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 12, marginBottom: 8 }}>
                  <h2 className="display" style={{ fontSize: 22 }}>
                    《{project.title}》
                  </h2>
                  <Tag tone="t-gold">{project.genre}</Tag>
                </div>
                <p style={{ color: 'var(--gold)', fontStyle: 'italic', marginBottom: 10 }}>
                  「{project.tagline}」
                </p>
                <p style={{ color: 'var(--text-sub)', fontSize: 13.5, lineHeight: 1.85, maxWidth: 560, marginBottom: 16 }}>
                  {project.synopsis}
                </p>

                <div className="row-between" style={{ flexWrap: 'wrap', gap: 16 }}>
                  <ProgressRing
                    value={doneRatio}
                    size={72}
                    stroke={7}
                    label={
                      <div>
                        <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
                          {doneRatio}%
                        </div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                          已完成 {doneCount}/{chapters.length} 章
                        </div>
                      </div>
                    }
                  />
                  <div className="row">
                    <Button icon={PenLine} onClick={() => navigate('/writer')}>
                      去创作
                    </Button>
                    <Button variant="outline" icon={Users} onClick={() => navigate('/characters')}>
                      角色库
                    </Button>
                    <Button variant="outline" icon={GitBranch} onClick={() => navigate('/plot')}>
                      情节大纲
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ===== AI 一键成稿 ===== */}
          <Card className="reveal" style={{ '--d': '300ms', padding: 20 }}>
            <SectionHead
              title="AI 一键成稿"
              sub="依据世界观、前情提要与情节大纲生成整章初稿，自动衔接上一章结尾"
              right={<Tag tone="t-gold">{undone.length} 拍待写</Tag>}
            />
            {undone.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="所有节拍都已完成"
                desc="去情节大纲添加新节拍，或补齐世界观设定后继续创作。"
                action={
                  <Button variant="outline" size="sm" icon={GitBranch} onClick={() => navigate('/plot')}>
                    去情节大纲
                  </Button>
                }
              />
            ) : (
              <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div className="row" style={{ gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                  <Select
                    value={picked?.node.id ?? ''}
                    onChange={(e) => setBeatId(e.target.value)}
                    style={{ width: 320, maxWidth: '100%' }}
                  >
                    {undone.map((u) => (
                      <option key={u.node.id} value={u.node.id}>
                        第{u.node.chapterNo}章 [{u.node.type}] {u.node.title} · {u.act.name}
                      </option>
                    ))}
                  </Select>
                  <span className="faint" style={{ fontSize: 12 }}>
                    POV · {picked?.node.pov || '未指定'}
                  </span>
                </div>
                <Button variant="gold" icon={Wand2} loading={genBusy} onClick={openGenerate}>
                  生成本章草稿
                </Button>
              </div>
            )}
          </Card>

          {/* ===== 最近章节 ===== */}
          <Card className="reveal" style={{ '--d': '320ms', padding: 20 }}>
            <SectionHead
              title="最近章节"
              sub="最近编辑的前 5 章，点击进入创作台"
              right={
                <Button variant="gold" size="sm" icon={Plus} onClick={handleNewChapter}>
                  新建章节
                </Button>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="还没有章节"
                desc="用「新建章节」落笔你的第一章，或从右侧 AI 灵感开始。"
                action={
                  <Button size="sm" icon={Plus} onClick={handleNewChapter}>
                    新建章节
                  </Button>
                }
              />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recent.map((c) => {
                  const meta = STATUS_META[c.status] || STATUS_META.draft;
                  return (
                    <Card
                      key={c.id}
                      hoverable
                      onClick={() => navigate('/writer')}
                      style={{ padding: '12px 16px', cursor: 'pointer' }}
                    >
                      <div className="row-between">
                        <div className="row" style={{ gap: 12, minWidth: 0 }}>
                          <span className="mono faint" style={{ fontSize: 12, flex: 'none', width: 30 }}>
                            第{c.no}章
                          </span>
                          <span className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
                            {c.title}
                          </span>
                          <Tag tone={meta.tone}>{meta.label}</Tag>
                        </div>
                        <div className="row" style={{ gap: 14, flex: 'none' }}>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                            {c.wordCount.toLocaleString()} 字
                          </span>
                          <span className="faint" style={{ fontSize: 12 }}>
                            {c.updatedAt}
                          </span>
                          <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ===== 今日灵感 · AI ===== */}
        <Card
          className="reveal"
          style={{ '--d': '280ms', width: 340, flex: 'none', padding: 20, display: 'flex', flexDirection: 'column' }}
        >
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <Sparkles size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="display" style={{ fontSize: 15 }}>
                今日灵感 · AI 生成
              </h3>
            </div>
            <Button variant="ghost" size="sm" icon={RefreshCw} loading={inspLoading} onClick={handleRefreshInsp}>
              换一批
            </Button>
          </div>

          {inspLoading ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="skeleton" style={{ height: 13, width: '100%' }} />
              <div className="skeleton" style={{ height: 13, width: '92%' }} />
              <div className="skeleton" style={{ height: 13, width: '86%' }} />
              <div className="skeleton" style={{ height: 13, width: '94%' }} />
              <div className="skeleton" style={{ height: 13, width: '70%' }} />
            </div>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--text-sub)', whiteSpace: 'pre-wrap' }}>
              {insp}
            </p>
          )}

          <div
            className="faint"
            style={{
              marginTop: 'auto',
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              fontSize: 12,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2,
            }}
          >
            灵感已接入大模型，可
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/settings')}
              style={{ padding: '0 2px', color: 'var(--primary-hover)' }}
            >
              在大模型配置中切换模型
            </button>
          </div>
        </Card>
      </div>

      {/* ---- AI 一键成稿 Modal ---- */}
      <Modal
        open={genOpen}
        title={picked ? `AI 成稿 · 第${picked.node.chapterNo}章 ${picked.node.title}` : 'AI 成稿'}
        onClose={() => !genBusy && setGenOpen(false)}
        width={720}
        footer={
          <>
            <Button variant="ghost" onClick={() => setGenOpen(false)} disabled={genBusy}>
              {genText ? '丢弃' : '取消'}
            </Button>
            <Button variant="ghost" icon={RefreshCw} loading={genBusy} onClick={regenerate}>
              重新生成
            </Button>
            <Button variant="primary" icon={CheckCircle2} disabled={genBusy || !genText.trim()} onClick={saveDraft}>
              存为章节
            </Button>
          </>
        }
      >
        {genText ? (
          <div style={{ maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{genText}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="skeleton" style={{ height: 13, width: '100%' }} />
            <div className="skeleton" style={{ height: 13, width: '94%' }} />
            <div className="skeleton" style={{ height: 13, width: '88%' }} />
            <div className="skeleton" style={{ height: 13, width: '96%' }} />
            <div className="skeleton" style={{ height: 13, width: '72%' }} />
            <div className="sub" style={{ fontSize: 12.5, marginTop: 8 }}>
              正在依据世界观（{world.sections.length} 个分区）与情节大纲（
              {plot.acts.reduce((s, a) => s + a.nodes.length, 0)} 拍）生成草稿，约需 1~2 分钟…
            </div>
          </div>
        )}
        {genText && genMeta?.source === 'canned' && (
          <div
            className="row"
            style={{ gap: 8, marginTop: 12, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}
          >
            <Info size={14} style={{ color: 'var(--gold)', flex: 'none' }} />
            <span className="sub" style={{ fontSize: 12 }}>
              当前未配置大模型，以上为内置占位文案；到「设置」配置后可获得真实成稿。
            </span>
          </div>
        )}
        {genText && genMeta?.error && (
          <div
            className="row"
            style={{ gap: 8, marginTop: 12, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}
          >
            <Info size={14} style={{ color: 'var(--danger, #e5484d)', flex: 'none' }} />
            <span className="sub" style={{ fontSize: 12 }}>
              上游返回异常（已回退占位文案）：{genMeta.error}
            </span>
          </div>
        )}
      </Modal>
    </>
  );
}
