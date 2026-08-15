/* ============================================================
   砚墨 · 小说设计器 — 共享 UI 组件
   页面仅通过这里的组件拼装界面，保持全局一致性。
   ============================================================ */
import React, { useEffect } from 'react';
import { X as XIcon, Check as CheckIcon } from 'lucide-react';

/* ---------- Button ---------- */
export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, children, className = '', ...rest }) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} disabled={rest.disabled || loading} {...rest}>
      {loading ? (
        <svg className="btn-ico spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        Icon && <Icon className="btn-ico" strokeWidth={1.8} />
      )}
      {children}
    </button>
  );
}

export function IconBtn({ icon: Icon, danger, label, ...rest }) {
  return (
    <button className={`icon-btn ${danger ? 'danger' : ''}`} title={label} aria-label={label} {...rest}>
      <Icon strokeWidth={1.8} size={17} />
    </button>
  );
}

/* ---------- Form ---------- */
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`input ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

/* ---------- Tag ---------- */
export function Tag({ tone, children, ...rest }) {
  return (
    <span className={`tag ${tone ? `t-${tone}` : ''}`} {...rest}>
      {children}
    </span>
  );
}

/* ---------- Card / Section ---------- */
export function Card({ hoverable, className = '', children, ...rest }) {
  return (
    <div className={`card ${hoverable ? 'hoverable' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHead({ title, sub, right }) {
  return (
    <div className="section-head">
      <div>
        <h3>{title}</h3>
        {sub && <div className="sub" style={{ marginTop: 3 }}>{sub}</div>}
      </div>
      {right && <div className="row">{right}</div>}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHead({ title, accent, sub, actions }) {
  return (
    <div className="page-head reveal">
      <div>
        <h1 className="page-title">
          {accent && <span className="accent">{accent}</span>}
          {title}
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({ icon: Icon, value, unit, label, trend, delay = 0 }) {
  return (
    <Card className="stat-card reveal" style={{ ['--d']: `${delay}ms` }}>
      <div className="stat-ico">
        <Icon strokeWidth={1.8} />
      </div>
      {trend && <span className="stat-trend">{trend}</span>}
      <div className="stat-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </Card>
  );
}

/* ---------- Avatar (首字 + 渐变环) ---------- */
export function Avatar({ name, color = '#E5533D', size, style }) {
  const cls = size === 'sm' ? 'avatar sm' : size === 'lg' ? 'avatar lg' : 'avatar';
  return (
    <span
      className={cls}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, ...style }}
    >
      {name ? name.slice(0, 1) : '?'}
    </span>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, footer, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-panel" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <IconBtn icon={XIcon} label="关闭" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="empty">
      <div className="empty-ico">
        {Icon && <Icon strokeWidth={1.5} />}
      </div>
      <h4>{title}</h4>
      {desc && <p>{desc}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

/* ---------- Slider ---------- */
export function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange, fmt }) {
  return (
    <div className="field">
      <div className="slider-row">
        <label>{label}</label>
        <span className="slider-value">{fmt ? fmt(value) : value}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
    </div>
  );
}

/* ---------- Progress ring ---------- */
export function ProgressRing({ value, size = 84, stroke = 7, color = 'var(--primary)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="row" style={{ gap: 14 }}>
      <svg width={size} height={size} className="progress-ring">
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      {label && <div>{label}</div>}
    </div>
  );
}

/* ---------- Toaster ---------- */
export function Toaster({ toasts }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'default' ? '' : t.type}`}>
          <CheckIcon className="t-ico" strokeWidth={2} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
