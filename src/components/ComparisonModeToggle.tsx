'use client';

import { COMPARISON_LABELS, type ComparisonMode } from '@/lib/comparison';

interface ComparisonModeToggleProps {
  value: ComparisonMode;
  onChange: (value: ComparisonMode) => void;
  className?: string;
}

const OPTIONS: Array<{ value: ComparisonMode; title: string }> = [
  { value: 'vorperiode', title: 'Mit dem direkt davor liegenden, gleich langen Zeitraum vergleichen' },
  { value: 'vorjahr', title: 'Mit demselben Zeitraum ein Jahr früher vergleichen' },
];

// Wählt, womit Veränderungen und Vorher-Werte verglichen werden.
export default function ComparisonModeToggle({ value, onChange, className = '' }: ComparisonModeToggleProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span id="comparison-mode-label" className="text-13 text-muted">Vergleich:</span>
      <div role="radiogroup" aria-labelledby="comparison-mode-label" className="grid flex-1 grid-cols-2 gap-1.5 sm:flex-none">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.title}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-3 py-1.5 text-center text-xs font-medium transition-all duration-150 ${
                selected
                  ? 'bg-accent-solid text-white'
                  : 'border border-border text-body hover:bg-surface-secondary'
              }`}
            >
              {COMPARISON_LABELS[option.value]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
