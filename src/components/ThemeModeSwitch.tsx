'use client';

import { MoonStarsFill, SunFill } from 'react-bootstrap-icons';
import { useTheme } from '@/components/ThemeProvider';

const MODES = [
  { value: 'light', label: 'Hell', icon: SunFill },
  { value: 'dark', label: 'Dunkel', icon: MoonStarsFill },
] as const;

// Tag/Nacht als Segment mit Beschriftung, z. B. auf der Login-Seite.
export default function ThemeModeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Darstellung" className="inline-flex rounded-[9px] bg-fill p-0.5">
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent
              ${active ? 'bg-surface font-semibold text-heading shadow-segment' : 'font-medium text-muted hover:text-heading'}`}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
