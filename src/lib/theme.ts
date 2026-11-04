// Design-Einstellungen des Superadmins: erlaubte Werte, Standardfarben und das CSS daraus.
// Wird auf dem Server (Layout, API) und im Browser (Live-Vorschau) verwendet.
import { z } from 'zod';

export type ThemeMode = 'light' | 'dark';

export const THEME_COLOR_KEYS = [
  'accent',
  'page',
  'sidebar',
  'surface',
  'surfaceSecondary',
  'heading',
  'text',
  'muted',
  'border',
] as const;
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export const THEME_COLOR_FIELDS: { key: ThemeColorKey; label: string; description: string }[] = [
  { key: 'accent', label: 'Akzentfarbe', description: 'Buttons, Links, aktive Einträge, Hauptlinie im Diagramm' },
  { key: 'page', label: 'Seitenhintergrund', description: 'Fläche hinter den Widgets' },
  { key: 'sidebar', label: 'Sidebar', description: 'Hintergrund der Navigation links' },
  { key: 'surface', label: 'Widget-Hintergrund', description: 'Widgets, Listen, Dialoge' },
  { key: 'surfaceSecondary', label: 'Ruhige Flächen', description: 'Tabellenköpfe und Nebenflächen' },
  { key: 'heading', label: 'Überschriften', description: 'Titel und hervorgehobener Text' },
  { key: 'text', label: 'Fließtext', description: 'Normaler Text' },
  { key: 'muted', label: 'Nebentext', description: 'Beschriftungen, Datum, Hinweise' },
  { key: 'border', label: 'Rahmenfarbe', description: 'Rahmen um Widgets und Listen' },
];

// Muss zu design-tokens.css passen; die Rahmenfarbe ist dort halbtransparent, hier der sichtbare Mischwert.
export const THEME_DEFAULT_COLORS: Record<ThemeMode, Record<ThemeColorKey, string>> = {
  light: {
    accent: '#0066CC',
    page: '#FFFFFF',
    sidebar: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceSecondary: '#FAFAFC',
    heading: '#1D1D1F',
    text: '#3A3A3C',
    muted: '#636366',
    border: '#EBEBEB',
  },
  dark: {
    accent: '#2997FF',
    page: '#161617',
    sidebar: '#1C1C1E',
    surface: '#1C1C1E',
    surfaceSecondary: '#232325',
    heading: '#F5F5F7',
    text: '#D1D1D6',
    muted: '#A1A1A6',
    border: '#333335',
  },
};

// Gefüllte Buttons nutzen im Dunkelmodus standardmäßig ein dunkleres Blau als die Akzentfarbe.
const DEFAULT_ACCENT_SOLID: Record<ThemeMode, string> = { light: '#0066CC', dark: '#0A6FD6' };

export const SHADOW_LEVELS = ['none', 'sm', 'md', 'lg'] as const;
export type ShadowLevel = (typeof SHADOW_LEVELS)[number];

export const SHADOW_OPTIONS: { value: ShadowLevel; label: string }[] = [
  { value: 'none', label: 'Ohne' },
  { value: 'sm', label: 'Leicht' },
  { value: 'md', label: 'Mittel' },
  { value: 'lg', label: 'Stark' },
];

// Im Dunkelmodus braucht ein Schatten mehr Deckkraft, um überhaupt sichtbar zu sein.
const SHADOWS: Record<ThemeMode, Record<Exclude<ShadowLevel, 'none'>, string>> = {
  light: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.08)',
    md: '0 2px 4px rgba(0, 0, 0, 0.04), 0 6px 16px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.05), 0 16px 40px rgba(0, 0, 0, 0.14)',
  },
  dark: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.40)',
    md: '0 6px 16px rgba(0, 0, 0, 0.45)',
    lg: '0 16px 40px rgba(0, 0, 0, 0.60)',
  },
};

export const FONT_WEIGHT_KEYS = ['normal', 'medium', 'semibold', 'bold'] as const;
export type FontWeightKey = (typeof FONT_WEIGHT_KEYS)[number];

// Standard je Stufe; Fließtext ist hell 450, dunkel 400 (design-tokens.css).
export const FONT_WEIGHT_FIELDS: { key: FontWeightKey; label: string; description: string; defaultLabel: string; options: number[] }[] = [
  { key: 'normal', label: 'Fließtext', description: 'Normaler Text in Widgets und Listen', defaultLabel: 'Standard (hell 450, dunkel 400)', options: [300, 400, 450, 500, 600] },
  { key: 'medium', label: 'Mittel', description: 'Navigation, Beschriftungen, Werte', defaultLabel: 'Standard (500)', options: [400, 500, 600] },
  { key: 'semibold', label: 'Halbfett', description: 'Überschriften, Buttons, Tabellenköpfe', defaultLabel: 'Standard (600)', options: [500, 600, 700, 800] },
  { key: 'bold', label: 'Fett', description: 'Seitentitel und große Kennzahlen', defaultLabel: 'Standard (700)', options: [600, 700, 800, 900] },
];

const ALLOWED_WEIGHTS = [300, 400, 450, 500, 600, 700, 800, 900] as const;

export const DEFAULT_RADIUS = 14;
export const MAX_RADIUS = 24;

export const HEX_COLOR = /^#[0-9A-F]{6}$/;

const hexColor = z.string().regex(HEX_COLOR, 'Farbe als #RRGGBB angeben');
const modeColors = z.partialRecord(z.enum(THEME_COLOR_KEYS), hexColor);
const fontWeight = z.number().int().refine((value) => (ALLOWED_WEIGHTS as readonly number[]).includes(value));

// Nur diese Werte kommen ins CSS; alles andere wird abgelehnt.
export const themeSchema = z.object({
  light: modeColors.default({}),
  dark: modeColors.default({}),
  border: z.boolean().default(true),
  shadow: z.enum(SHADOW_LEVELS).default('none'),
  radius: z.number().int().min(0).max(MAX_RADIUS).default(DEFAULT_RADIUS),
  weights: z.partialRecord(z.enum(FONT_WEIGHT_KEYS), fontWeight).default({}),
});

export type ThemeSettings = z.infer<typeof themeSchema>;

export const DEFAULT_THEME: ThemeSettings = themeSchema.parse({});

// „#abc“, „abc“, „#aabbcc“ → „#AABBCC“; ungültig → null.
export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(value)) return `#${value.split('').map((c) => c + c).join('')}`;
  if (/^[0-9A-F]{6}$/.test(value)) return `#${value}`;
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function effectiveColor(theme: ThemeSettings, mode: ThemeMode, key: ThemeColorKey): string {
  return theme[mode][key] ?? THEME_DEFAULT_COLORS[mode][key];
}

export interface ContrastIssue {
  mode: ThemeMode;
  label: string;
  ratio: number;
}

// Paare, die im Alltag lesbar sein müssen (WCAG AA, 4,5:1 für normalen Text).
export function findContrastIssues(theme: ThemeSettings): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const mode of ['light', 'dark'] as const) {
    const c = (key: ThemeColorKey) => effectiveColor(theme, mode, key);
    const accentSolid = theme[mode].accent ?? DEFAULT_ACCENT_SOLID[mode];
    const pairs: [string, string, string][] = [
      ['Überschriften auf Widget-Hintergrund', c('heading'), c('surface')],
      ['Fließtext auf Widget-Hintergrund', c('text'), c('surface')],
      ['Nebentext auf Widget-Hintergrund', c('muted'), c('surface')],
      ['Fließtext auf Seitenhintergrund', c('text'), c('page')],
      ['Nebentext in der Sidebar', c('muted'), c('sidebar')],
      ['Akzentfarbe (Links) auf Widget-Hintergrund', c('accent'), c('surface')],
      ['Weiße Schrift auf Akzent-Buttons', '#FFFFFF', accentSolid],
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) issues.push({ mode, label, ratio });
    }
  }
  return issues;
}

function modeDeclarations(theme: ThemeSettings, mode: ThemeMode): string[] {
  const colors = theme[mode];
  const out: string[] = [];
  const set = (name: string, value: string) => out.push(`${name}:${value}`);

  if (colors.accent) {
    const [r, g, b] = hexToRgb(colors.accent);
    set('--dp-accent', colors.accent);
    set('--dp-accent-solid', colors.accent);
    set('--dp-accent-tint', `rgba(${r}, ${g}, ${b}, ${mode === 'dark' ? 0.12 : 0.1})`);
    set('--dp-brand-hover', colors.accent);
    set('--dp-chart-1', colors.accent);
  }
  if (colors.page) set('--dp-page', colors.page);
  if (colors.sidebar) set('--dp-sidebar', colors.sidebar);
  if (colors.surface) set('--dp-bg-primary', colors.surface);
  if (colors.surfaceSecondary) set('--dp-bg-secondary', colors.surfaceSecondary);
  if (colors.heading) {
    set('--dp-text-heading', colors.heading);
    set('--dp-text-strong', colors.heading);
  }
  if (colors.text) {
    set('--dp-text-body', colors.text);
    set('--dp-text-secondary', colors.text);
  }
  if (colors.muted) set('--dp-text-muted', colors.muted);

  if (!theme.border) set('--dp-card-border', 'transparent');
  else if (colors.border) set('--dp-card-border', colors.border);

  if (theme.shadow !== 'none') set('--dp-card-shadow', SHADOWS[mode][theme.shadow]);
  return out;
}

// Erzeugt nur Überschreibungen der Standardwerte. Die Selektoren sind spezifischer als :root und .dark
// in design-tokens.css; :not(.dark) hält die hellen Werte aus dem Dunkelmodus heraus.
export function themeToCss(input: ThemeSettings): string {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return '';
  const theme = parsed.data;

  const light = modeDeclarations(theme, 'light');
  const dark = modeDeclarations(theme, 'dark');

  // Radius und Schriftstärken gelten in beiden Modi; html:root schlägt auch .dark.
  const global: string[] = [];
  if (theme.radius !== DEFAULT_RADIUS) global.push(`--dp-radius-container:${theme.radius}px`);
  for (const key of FONT_WEIGHT_KEYS) {
    const weight = theme.weights[key];
    if (weight !== undefined) global.push(`--dp-weight-${key}:${weight}`);
  }

  const blocks: string[] = [];
  if (global.length) blocks.push(`html:root{${global.join(';')}}`);
  if (light.length) blocks.push(`html:root:not(.dark){${light.join(';')}}`);
  if (dark.length) blocks.push(`html.dark{${dark.join(';')}}`);
  return blocks.join('\n');
}
