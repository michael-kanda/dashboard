import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

// Listen-Container mit echter Tabelle; scrollt waagrecht im Container statt die Seite zu verbreitern.
export function DataList({
  children,
  minWidth = 720,
  label,
  className = '',
}: {
  children: ReactNode;
  minWidth?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-container border border-border bg-surface ${className}`}>
      <table className="w-full border-collapse text-left" style={{ minWidth }} aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function DataListHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-secondary">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  );
}

export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={`px-[18px] py-2.5 text-[13px] font-semibold text-muted ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-border-subtle transition-colors duration-150 ease-out last:border-b-0 hover:bg-[var(--dp-row-hover)] ${className}`}>
      {children}
    </tr>
  );
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-[18px] py-3 align-middle text-[14px] text-body ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-surface-secondary text-muted" aria-hidden="true">
      {children}
    </span>
  );
}

export function PrimaryCell({
  icon,
  title,
  subtitle,
  href,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="block truncate text-[15px] font-semibold text-heading">{title}</span>
      {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-3">
      {icon && <IconTile>{icon}</IconTile>}
      <div className="min-w-0 max-w-[320px]">
        {href ? <a href={href} className="block min-w-0 hover:underline">{content}</a> : content}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, children = 'Keine Einträge gefunden' }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-[18px] py-6 text-[14px] text-muted">
        {children}
      </td>
    </tr>
  );
}

// Ruhiger Ladeplatzhalter in Listenform.
export function ListSkeleton({ rows = 4, label = 'Wird geladen …' }: { rows?: number; label?: string }) {
  return (
    <div className="rounded-container border border-border bg-surface" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border-subtle px-[18px] py-3 last:border-b-0">
          <span className="h-[34px] w-[34px] rounded-[9px] bg-surface-secondary" />
          <span className="h-3 w-1/3 rounded bg-surface-tertiary" />
          <span className="ml-auto h-3 w-16 rounded bg-surface-tertiary" />
        </div>
      ))}
    </div>
  );
}
