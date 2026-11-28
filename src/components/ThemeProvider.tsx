// src/components/ThemeProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// theme: was gerade zu sehen ist. preference: was der Nutzer gewählt hat;
// „system“ folgt der Einstellung des Geräts und wechselt mit ihr.
export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'datapeak-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  // Erst nach dem Lesen aus localStorage true; vorher kennt der Server die Wahl nicht.
  mounted: boolean;
  setPreference: (preference: ThemePreference) => void;
  setTheme: (theme: Theme) => void;
  // Hell → Dunkel → Gerät, für Stellen mit nur einem Knopf
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  preference: 'system',
  mounted: false,
  setPreference: () => {},
  setTheme: () => {},
  cyclePreference: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // ── Mount: Wahl aus localStorage lesen ──
  useEffect(() => {
    const stored = readPreference();
    setPreferenceState(stored);
    setThemeState(stored === 'system' ? systemTheme() : stored);
    setMounted(true);
  }, []);

  // ── Wahl anwenden und merken ──
  useEffect(() => {
    if (!mounted) return;
    const resolved = preference === 'system' ? systemTheme() : preference;
    setThemeState(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ohne localStorage gilt die Wahl nur bis zum Neuladen.
    }
  }, [preference, mounted]);

  // ── „Wie Gerät“: Wechsel der Geräteeinstellung sofort übernehmen ──
  useEffect(() => {
    if (!mounted || preference !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const resolved: Theme = query.matches ? 'dark' : 'light';
      setThemeState(resolved);
      applyTheme(resolved);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference, mounted]);

  // ── Drucken immer im hellen Modus, danach zurück ──
  useEffect(() => {
    const onBeforePrint = () => document.documentElement.classList.remove('dark');
    const onAfterPrint = () => applyTheme(theme);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);
  const setTheme = useCallback((next: Theme) => setPreferenceState(next), []);
  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, mounted, setPreference, setTheme, cyclePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
