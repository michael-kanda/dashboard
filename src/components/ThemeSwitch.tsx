'use client';

import { Display, Moon, Sun } from 'react-bootstrap-icons';
import { useTheme, type ThemePreference } from '@/components/ThemeProvider';

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'Wie Gerät', icon: Display },
];

// Hell, Dunkel oder wie das Gerät: drei runde Knöpfe in einer Pille.
// Bis die Wahl aus localStorage gelesen ist, ist keiner markiert (sonst springt die Markierung).
export default function ThemeSwitch({ className = '' }: { className?: string }) {
  const { preference, setPreference, mounted } = useTheme();

  return (
    <div role="group" aria-label="Darstellung" className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-[3px] ${className}`}>
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent
              ${active ? 'bg-accent-tint text-accent' : 'text-muted hover:bg-fill hover:text-heading'}`}
          >
            <Icon size={value === 'system' ? 14 : 15} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// Für Stellen mit Platz für nur einen Knopf: zeigt die aktuelle Wahl, ein Klick schaltet weiter.
export function ThemeCycleButton({ className, iconSize = 16 }: { className: string; iconSize?: number }) {
  const { preference, cyclePreference, mounted } = useTheme();
  const current = THEME_OPTIONS.find((option) => option.value === preference) ?? THEME_OPTIONS[2];
  const next = THEME_OPTIONS[(THEME_OPTIONS.indexOf(current) + 1) % THEME_OPTIONS.length];
  const Icon = current.icon;
  const label = `Darstellung: ${current.label}. Wechseln zu ${next.label}`;

  return (
    <button type="button" onClick={cyclePreference} aria-label={label} title={label} className={className}>
      <Icon size={iconSize} aria-hidden="true" className={mounted ? undefined : 'opacity-0'} />
    </button>
  );
}
