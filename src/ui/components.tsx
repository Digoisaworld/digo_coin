import type { ReactNode } from 'react';

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  full,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  full?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`btn btn-${variant} btn-${size}${full ? ' btn-full' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ScreenHead({
  title,
  sub,
  onBack,
  right,
}: {
  title: string;
  sub?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="screen-head">
      <button type="button" className="back-btn" onClick={onBack} aria-label="Back">
        <span aria-hidden="true">‹</span>
      </button>
      <div className="screen-head-text">
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? <div className="screen-head-right">{right}</div> : null}
    </header>
  );
}

export function Progress({
  value,
  max,
  tone = 'gold',
  height = 8,
}: {
  value: number;
  max: number;
  tone?: 'gold' | 'cyan' | 'green' | 'purple' | 'danger';
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className={`progress progress-${tone}`} style={{ height }}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Tag({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'cyan' | 'green' | 'danger' | 'muted' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function Card({
  children,
  onClick,
  active,
  locked,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  locked?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`card${active ? ' card-active' : ''}${locked ? ' card-locked' : ''} ${className}`}
      onClick={onClick}
      disabled={locked}
    >
      {children}
    </button>
  );
}
