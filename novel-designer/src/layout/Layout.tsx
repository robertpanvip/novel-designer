/* ============================================================
   砚墨 · 小说设计器 — App Shell（唯一骨架）
   所有页面都渲染在 <Outlet/> 中；导航仅在此定义一次。
   ============================================================ */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  PenLine,
  Users,
  Globe2,
  GitBranch,
  Settings,
  Search,
  ChevronDown,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Toaster } from '../components/ui';
import { PROVIDERS } from '../api/llm';

interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { key: 'dashboard', to: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { key: 'writer', to: '/writer', label: '创作台', icon: PenLine },
  { key: 'characters', to: '/characters', label: '角色库', icon: Users },
  { key: 'world', to: '/world', label: '世界观', icon: Globe2 },
  { key: 'plot', to: '/plot', label: '情节大纲', icon: GitBranch },
  { key: 'settings', to: '/settings', label: '大模型配置', icon: Settings },
];

export default function Layout() {
  const { project, projects, llm, toasts, actions } = useStore();
  const navigate = useNavigate();
  const provider = PROVIDERS.find((p) => p.id === llm.provider);

  /* 书籍切换器 */
  const [bookOpen, setBookOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [bookBusy, setBookBusy] = useState(false);

  const closeBookMenu = () => {
    setBookOpen(false);
    setCreating(false);
    setNewTitle('');
  };

  const handleCreateBook = async () => {
    if (bookBusy) return;
    setBookBusy(true);
    await actions.createBook(newTitle);
    setBookBusy(false);
    closeBookMenu();
  };

  const handleSwitchBook = async (id: string) => {
    if (bookBusy) return;
    if (id === project.id) {
      closeBookMenu();
      return;
    }
    setBookBusy(true);
    await actions.switchBook(id);
    setBookBusy(false);
    closeBookMenu();
  };

  const handleRemoveBook = async (id: string, title: string) => {
    if (bookBusy) return;
    if (
      !window.confirm(
        `确定删除《${title}》？\n\n其全部章节、角色、世界观与情节数据将一并删除，且不可恢复。`,
      )
    ) {
      return;
    }
    setBookBusy(true);
    await actions.removeBook(id);
    setBookBusy(false);
  };

  return (
    <div className="app">
      <aside className="app-nav">
        <div className="brand">
          <div className="brand-seal">砚</div>
          <div>
            <div className="brand-name">砚墨</div>
            <div className="brand-sub">Novel Designer</div>
          </div>
        </div>

        <div className="nav-group">创作</div>
        <nav className="nav-list">
          {NAV.map(({ key, to, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-ico" strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-foot">
          <span className="dot-pulse" />
          <div className="fmeta" style={{ minWidth: 0, flex: 1 }}>
            <div className="fname">{provider?.name || '未配置'}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
              {llm.model || '—'} · {llm.connected ? '已连接' : '未连接'}
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="topbar-title"
              onClick={() => setBookOpen((v) => !v)}
              style={{
                cursor: 'pointer', background: 'transparent', border: 'none',
                fontFamily: 'inherit', color: 'inherit', padding: 0,
              }}
              title="切换 / 新建作品"
            >
              <span className="proj-tag">当前作品</span>
              《{project.title}》
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-faint)',
                  transform: bookOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 160ms var(--ease-out)',
                }}
              />
            </button>

            {bookOpen && (
              <>
                {/* 点击空白处关闭 */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={closeBookMenu} />

                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 300, zIndex: 100,
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(0,0,0,0.35)', overflow: 'hidden',
                  }}
                >
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {projects.length === 0 && (
                      <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-sub)' }}>
                        暂无作品（后端未连接时不可切换）
                      </div>
                    )}
                    {projects.map((b) => {
                      const active = b.id === project.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => void handleSwitchBook(b.id)}
                          className="row-between"
                          style={{
                            padding: '10px 12px', gap: 10, cursor: bookBusy ? 'wait' : 'pointer',
                            background: active ? 'rgba(229,83,61,0.10)' : 'transparent',
                            borderBottom: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="row" style={{ gap: 8 }}>
                              {active && <Check size={14} style={{ color: 'var(--primary)', flex: 'none' }} />}
                              <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>
                                《{b.title}》
                              </span>
                            </div>
                            <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                              {b.genre || '未分类'} · {b.chapterCount} 章 · {b.charCount} 角色
                            </div>
                          </div>
                          {projects.length > 1 && (
                            <button
                              type="button"
                              title={`删除《${b.title}》`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRemoveBook(b.id, b.title);
                              }}
                              style={{
                                flex: 'none', width: 26, height: 26, display: 'grid', placeItems: 'center',
                                borderRadius: 6, border: 'none', background: 'transparent',
                                color: 'var(--text-faint)', cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {creating ? (
                    <div className="row" style={{ padding: '10px 12px', gap: 8, borderTop: '1px solid var(--border)' }}>
                      <input
                        className="input grow"
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleCreateBook();
                          if (e.key === 'Escape') setCreating(false);
                        }}
                        placeholder="输入新书名…"
                        maxLength={40}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={bookBusy}
                        onClick={() => void handleCreateBook()}
                      >
                        创建
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="row"
                      style={{
                        width: '100%', padding: '10px 12px', gap: 8, background: 'transparent',
                        border: 'none', borderTop: '1px solid var(--border)', color: 'var(--primary)',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <Plus size={14} /> 新建作品
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="topbar-spacer" />
          <div className="search-box">
            <Search size={14} />
            <input placeholder="搜索章节、角色、设定…" />
          </div>
          <button className="ai-chip" onClick={() => navigate('/settings')} title="打开大模型配置">
            <span className="ai-dot" />
            <span>{provider?.name}</span>
            <span className="mono" style={{ color: 'var(--text-faint)' }}>{llm.model}</span>
          </button>
          <span className="avatar sm" style={{ background: 'linear-gradient(135deg,#E5533D,#b73a28)' }}>
            墨
          </span>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>

      <Toaster toasts={toasts} />
    </div>
  );
}
