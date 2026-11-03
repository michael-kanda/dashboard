// src/components/ThemeProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export default function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // ── Theme auf <html> anwenden ──
  const applyTheme = useCallback((t: Theme) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // ── Mount: Theme aus localStorage lesen ──
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('datapeak-theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyTheme(stored);
      } else {
        // Kein gespeichertes Theme → Light Mode, dark class ENTFERNEN
        applyTheme('light');
      }
    } catch (e) {
      // localStorage nicht verfügbar → sicherstellen dass dark class weg ist
      applyTheme('light');
    }
  }, [applyTheme]);

  // ── Theme-Änderungen anwenden ──
  useEffect(() => {
    if (!mounted) return;
    
    applyTheme(theme);
    
    try {
      localStorage.setItem('datapeak-theme', theme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }
  }, [theme, mounted, applyTheme]);

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
  }, [theme, applyTheme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
