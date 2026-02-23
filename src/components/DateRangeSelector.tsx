// src/components/DateRangeSelector.tsx
'use client';

import React from 'react';

export type DateRangeOption = '30d' | '3m' | '6m' | '12m' | '18m' | '24m';

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
  className?: string;
}

// Behalte die originalen langen Labels für die Export-Funktion 
// (falls sie z.B. im Titel des Dashboards genutzt wird)
const rangeLabels: Record<DateRangeOption, string> = {
  '30d': 'Letzte 30 Tage',
  '3m': 'Letzte 3 Monate',
  '6m': 'Letzte 6 Monate',
  '12m': 'Letzte 12 Monate',
  '18m': 'Letzte 18 Monate',
  '24m': 'Letzte 24 Monate',
};

// Kürzere Labels speziell für die kleineren Buttons
const buttonLabels: Record<DateRangeOption, string> = {
  '30d': '30 Tage',
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
  const options: DateRangeOption[] = ['30d', '3m', '6m', '12m', '18m', '24m'];

  return (
    // grid-cols-3 sorgt für exakt 3 Spalten und einen automatischen Zeilenumbruch danach
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`
            px-2 py-1.5 text-xs font-medium rounded-md transition-colors border
            ${value === option
              ? 'bg-[#188BDB] text-white border-[#188BDB] shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          {buttonLabels[option]}
        </button>
      ))}
    </div>
  );
}
