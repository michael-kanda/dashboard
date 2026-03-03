// src/components/DateRangeSelector.tsx
'use client';

import React from 'react';

export type DateRangeOption = '30d' | '3m' | '6m' | '12m' | '18m' | '24m';

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
  className?: string;
}

const rangeLabels: Record<DateRangeOption, string> = {
  '30d': 'Letzte 30 Tage',
  '3m': 'Letzte 3 Monate',
  '6m': 'Letzte 6 Monate',
  '12m': 'Letzte 12 Monate',
  '18m': 'Letzte 18 Monate',
  '24m': 'Letzte 24 Monate',
};

const shortLabels: Record<DateRangeOption, string> = {
  '30d': 'Letzte 30 Tage',
  '3m': '3 Monate',
  '6m': '6 Monate',
  '12m': '12 Monate',
  '18m': '18 Monate',
  '24m': '24 Monate',
};

export function getRangeLabel(range: DateRangeOption): string {
  return rangeLabels[range];
}

export default function DateRangeSelector({ 
  value, 
  onChange, 
  className = '' 
}: DateRangeSelectorProps) {
  const topRow: DateRangeOption[] = ['30d', '3m', '6m'];
  const bottomRow: DateRangeOption[] = ['12m', '18m', '24m'];

  const renderButton = (option: DateRangeOption) => (
    <button
      key={option}
      onClick={() => onChange(option)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
        value === option
          ? 'bg-[#188BDB] text-white shadow-sm'
          : 'text-body hover:bg-surface-secondary border border-theme-border-default'
      }`}
    >
      {shortLabels[option]}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex gap-1.5">
        {topRow.map(renderButton)}
      </div>
      <div className="flex gap-1.5">
        {bottomRow.map(renderButton)}
      </div>
    </div>
  );
}
