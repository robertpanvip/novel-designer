/* ============================================================
   砚墨 · 小说设计器 — 共享 UI 组件
   页面仅通过这里的组件拼装界面，保持全局一致性。
   ============================================================ */
import { useEffect } from 'react';
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  HTMLAttributes,
  CSSProperties,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { X as XIcon, Check as CheckIcon } from 'lucide-react';
import type { CustomCSS, Toast } from '../types';

/* ---------- Button ---------- */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'gold' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, children, className = '', ...rest }: ButtonProps) {
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

export interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  danger?: boolean;
  label: string;
}

export function IconBtn({ icon: Icon, danger, label, ...rest }: IconBtnProps) {
  return (
    <button className={`icon-btn ${danger ? 'danger' : ''}`} title={label} aria-label={label} {...rest}>
      <Icon strokeWidth={1.8} size={17} />
    </button>
  );
}

/* ---------- Form ---------- */
export interface FieldProps {
  label?: string;
  hint?: string;
  children?: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

/* ---------- Tag ---------- */
export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: string;
  children?: ReactNode;
}

export function Tag({ tone, children, ...rest }: TagProps) {
  return (
    <span className={`tag ${tone ? `t-${tone}` : ''}`} {...rest}>
      {children}
    </span>
  );
}

/* ---------- Card / Section ---------- */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children?: ReactNode;
}

export function Card({ hoverable, className = '', children, ...rest }: CardProps) {
  return (
    <div className={`card ${hoverable ? 'hoverable' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export interface SectionHeadProps {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}

export function SectionHead({ title, sub, right }: SectionHeadProps) {
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
export interface PageHeadProps {
  title: string;
  accent?: string;
  sub?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ title, accent, sub, actions }: PageHeadProps) {
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
export interface StatCardProps {
  icon: LucideIcon;
  value: ReactNode;
  unit?: string;
  label: ReactNode;
  trend?: string;
  delay?: number;
}

export function StatCard({ icon: Icon, value, unit, label, trend, delay = 0 }: StatCardProps) {
  return (
    <Card className="stat-card reveal" style={{ ['--d']: `${delay}ms` } as CustomCSS}>
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
export interface AvatarProps {
  name?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

export function Avatar({ name, color = '#E5533D', size, style }: AvatarProps) {
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
export interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
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
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, desc, action }: EmptyStateProps) {
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
export interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (v: number) => void;
  fmt?: (v: number) => string;
}

export function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange, fmt }: SliderProps) {
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
export interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
}

export function ProgressRing({ value, size = 84, stroke = 7, color = 'var(--primary)', label }: ProgressRingProps) {
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
export interface ToasterProps {
  toasts: Toast[];
}

export function Toaster({ toasts }: ToasterProps) {
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
