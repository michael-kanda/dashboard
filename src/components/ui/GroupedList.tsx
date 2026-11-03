import type { ReactNode } from 'react';
import { SectionTitle } from './Page';

// macOS-Systemeinstellungen: Titel über einer Gruppe, Zeilen mit Label links und Wert rechts.
export function GroupedSection({
  title,
  help,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && <SectionTitle title={title} help={help} actions={actions} />}
      <div className="overflow-hidden rounded-container border border-card-border bg-surface shadow-container">{children}</div>
    </section>
  );
}

export function GroupedRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
}) {
  const LabelTag = htmlFor ? 'label' : 'div';
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-subtle px-[18px] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <LabelTag {...(htmlFor ? { htmlFor } : {})} className="block text-[15px] text-heading">{label}</LabelTag>
        {description && <div className="text-[13px] text-muted">{description}</div>}
      </div>
      {children !== undefined && <div className="flex min-w-0 items-center gap-2 text-[14px] text-body">{children}</div>}
    </div>
  );
}
