'use client';

import { useId } from 'react';
import { Search } from 'react-bootstrap-icons';

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full min-w-[220px] rounded-[9px] border-0 bg-fill pl-9 pr-3 text-[14px] text-heading placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}
