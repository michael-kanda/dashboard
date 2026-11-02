'use client';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[9px] bg-fill p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-8 whitespace-nowrap rounded-[7px] px-3 text-[13px] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent
              ${active ? 'bg-surface font-semibold text-heading shadow-segment' : 'font-medium text-secondary hover:text-heading'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
