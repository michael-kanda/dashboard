import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Wichtig: Damit greift '.dark' auf dem HTML-Tag
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Hier machen wir deine CSS-Variablen als Tailwind-Klassen verfügbar!
      colors: {
        surface: {
          DEFAULT: 'var(--dp-bg-primary)',
          secondary: 'var(--dp-bg-secondary)',
          tertiary: 'var(--dp-bg-tertiary)',
        },
        heading: 'var(--dp-text-heading)',
        body: 'var(--dp-text-body)',
        muted: 'var(--dp-text-muted)',
        faint: 'var(--dp-text-faint)',
        border: {
          DEFAULT: 'var(--dp-border-default)',
          subtle: 'var(--dp-border-subtle)',
          strong: 'var(--dp-border-strong)',
        },
        primary: {
          DEFAULT: '#188BDB', // Dein primary-highlight
          foreground: '#ffffff',
        }
      },
      boxShadow: {
        card: 'var(--dp-shadow-card)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
