import type { ReactNode } from 'react';

// Inhaltsbereich des Listenstils: ruhiger Hintergrund, feste Abstände, Elemente mit 22 px Abstand.
export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex w-full flex-col gap-[22px] px-[clamp(16px,3vw,40px)] pt-7 pb-12 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  count,
  subtitle,
  children,
}: {
  title: ReactNode;
  count?: number | null;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-heading">
          {title}
          {typeof count === 'number' && (
            <span className="ml-2 font-semibold text-muted tabular-nums">{count}</span>
          )}
        </h1>
        {subtitle && <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function SectionTitle({
  title,
  help,
  actions,
  as: Tag = 'h2',
}: {
  title: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <Tag className="text-[17px] font-semibold tracking-[-0.015em] text-heading">{title}</Tag>
        {help && <p className="mt-0.5 text-[12px] text-muted">{help}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
