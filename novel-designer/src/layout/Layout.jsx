/* ============================================================
   砚墨 · 小说设计器 — App Shell（唯一骨架）
   所有页面都渲染在 <Outlet/> 中；导航仅在此定义一次。
   ============================================================ */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PenLine,
  Users,
  Globe2,
  GitBranch,
  Settings,
  Search,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Toaster } from '../components/ui';
import { PROVIDERS } from '../api/llm';

const NAV = [
  { key: 'dashboard', to: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { key: 'writer', to: '/writer', label: '创作台', icon: PenLine },
  { key: 'characters', to: '/characters', label: '角色库', icon: Users },
  { key: 'world', to: '/world', label: '世界观', icon: Globe2 },
  { key: 'plot', to: '/plot', label: '情节大纲', icon: GitBranch },
  { key: 'settings', to: '/settings', label: '大模型配置', icon: Settings },
];

export default function Layout() {
  const { project, llm, toasts } = useStore();
  const navigate = useNavigate();
  const provider = PROVIDERS.find((p) => p.id === llm.provider);

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
          <div className="topbar-title">
            <span className="proj-tag">当前作品</span>
            《{project.title}》
            <ChevronDown size={14} style={{ color: 'var(--text-faint)' }} />
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
