/* ============================================================
   砚墨 · 小说设计器 — 工作台 Dashboard
   数据统一从 useStore 读取；今日灵感走 api 存根。
   TODO: 接入真实后端 —— 替换 runAI 存根为真实接口调用
   ============================================================ */
import React, { useState, useRef } from 'react';
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
} from '../components/ui';
import { useStore } from '../store/AppStore';
import { runAI } from '../api/llm';

// 章节状态 → 文案 / Tag tone
const STATUS_META = {
  done: { label: '已完成', tone: 'success' },
  revising: { label: '修订中', tone: 'warning' },
  draft: { label: '草稿', tone: 'default' },
};

// 「今日灵感」初始文案（未接入后端时的占位；接入真实模型后由流式回复取代）
const DEFAULT_INSPIRATION = `《雾港潮生》的线索正从「岸上」转向「雾中」。不妨让陆昭在重听那晚电台录音时，发现一段被剪掉的空白——停顿的三秒里，有人轻轻敲了两下麦克风。那声音像极了船笛：两声，是求救，也是认门。让林雾那句「界碑下面压着的东西，比沉船还沉」，与沈樱《雾岸》展览里的物证照片第一次正面碰撞。真正的钩子，不妨藏在一张被海水泡皱的旧登船牌上——船牌的主人，已经三十年没有露面了。`;

export default function Dashboard() {
  const { project, chapters, actions } = useStore();
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
    </>
  );
}
