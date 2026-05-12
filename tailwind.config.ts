import type { Config } from 'tailwindcss'

/**
 * DATAPEAK – Tailwind Config
 *
 * All color/size values reference CSS variables defined in design-tokens.css.
 * To change a color: edit design-tokens.css → Tailwind picks it up automatically.
 *
 * Class naming convention:
 *   text-heading    → var(--dp-text-heading)
 *   bg-surface      → var(--dp-bg-primary)
 *   border-border   → var(--dp-border-default)
 *   text-brand      → var(--dp-brand)
 *   etc.
 */
const config: Config = {
  darkMode: 'class',   // .dark class on <html> triggers dark mode
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {

      /* ── Colors ─────────────────────────────────────────── */
      colors: {
        // Backgrounds
        surface: {
          DEFAULT:    'var(--dp-bg-primary)',
          secondary:  'var(--dp-bg-secondary)',
          tertiary:   'var(--dp-bg-tertiary)',
          quaternary: 'var(--dp-bg-quaternary)',
        },

        // Text
        heading:   'var(--dp-text-heading)',
        strong:    'var(--dp-text-strong)',
        body:      'var(--dp-text-body)',
        muted:     'var(--dp-text-muted)',
        faint:     'var(--dp-text-faint)',

        // Borders  →  border-border / border-border-subtle / border-border-strong
        border: {
          DEFAULT: 'var(--dp-border-default)',
          subtle:  'var(--dp-border-subtle)',
          strong:  'var(--dp-border-strong)',
        },

        // Brand blue  →  bg-brand / text-brand / border-brand
        brand: {
          DEFAULT:    'var(--dp-brand)',
          hover:      'var(--dp-brand-hover)',
          foreground: 'var(--dp-brand-foreground)',
        },

        // Accents  →  bg-accent-indigo / text-accent-emerald / etc.
        accent: {
          indigo:          'var(--dp-accent-indigo)',
          'indigo-light':  'var(--dp-accent-indigo-light)',
          'indigo-hover':  'var(--dp-accent-indigo-hover)',
          emerald:         'var(--dp-accent-emerald)',
          'emerald-light': 'var(--dp-accent-emerald-light)',
          red:             'var(--dp-accent-red)',
          'red-light':     'var(--dp-accent-red-light)',
        },

        // Legacy alias used by button.tsx & shadcn/ui primitives
        primary: {
          DEFAULT:    'var(--dp-brand)',
          foreground: 'var(--dp-brand-foreground)',
        },
      },

      /* ── Shadows ────────────────────────────────────────── */
      boxShadow: {
        card: 'var(--dp-shadow-card)',
      },

      /* ── Border Radius ──────────────────────────────────── */
      borderRadius: {
        sm:   'var(--dp-radius-sm)',
        DEFAULT: 'var(--dp-radius-md)',
        md:   'var(--dp-radius-md)',
        lg:   'var(--dp-radius-lg)',
        xl:   'var(--dp-radius-xl)',
        '2xl':'var(--dp-radius-2xl)',
        full: 'var(--dp-radius-full)',
      },

      /* ── Font Family ────────────────────────────────────── */
      fontFamily: {
        sans: ['var(--dp-font-sans)'],
        mono: ['var(--dp-font-mono)'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
