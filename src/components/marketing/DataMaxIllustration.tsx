// src/components/marketing/DataMaxIllustration.tsx
// DataMax als Vektorgrafik: Helm mit leuchtendem Display, Balken, Trendpfeil und Lächeln.

interface DataMaxIllustrationProps {
  className?: string;
  /** Nur der Kopf, z. B. als Avatar im Chat. */
  headOnly?: boolean;
  title?: string;
}

const NAVY = '#26238C';
const NAVY_DARK = '#1A1866';
const LINE = '#C9D6FF';
const SCREEN = '#F4F7FF';
const ICON = '#7C9BE8';

function Head() {
  return (
    <g>
      {/* Ohren / Kopfhörer */}
      <rect x="22" y="78" width="26" height="62" rx="13" fill={NAVY_DARK} />
      <rect x="192" y="78" width="26" height="62" rx="13" fill={NAVY_DARK} />
      <path d="M31 92v34M209 92v34" stroke={LINE} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* Helm */}
      <rect x="38" y="30" width="164" height="150" rx="62" fill={NAVY} />
      <path d="M70 46c18-9 40-12 60-10" stroke={LINE} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* Display mit Leuchten */}
      <rect x="56" y="62" width="128" height="96" rx="36" fill={SCREEN} />
      <rect x="56" y="62" width="128" height="96" rx="36" fill="none" stroke="#FFFFFF" strokeWidth="5" opacity="0.9" />
      {/* Balken */}
      <rect x="80" y="104" width="8" height="14" rx="2" fill={ICON} />
      <rect x="93" y="96" width="8" height="22" rx="2" fill={ICON} />
      <rect x="106" y="88" width="8" height="30" rx="2" fill={ICON} />
      {/* Trendpfeil */}
      <path d="M126 112l12-12 8 8 16-18" stroke={ICON} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M152 88h11v11" stroke={ICON} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Lächeln */}
      <path d="M102 132c10 9 26 9 36 0" stroke={ICON} strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

export default function DataMaxIllustration({ className = '', headOnly = false, title = 'DataMax' }: DataMaxIllustrationProps) {
  // Ohne Titel ist die Grafik reine Dekoration.
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

  if (headOnly) {
    return (
      <svg viewBox="18 26 204 158" className={className} {...a11y}>
        <Head />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 300" className={className} {...a11y}>
      {/* Körper */}
      <path d="M58 300v-58c0-30 22-52 52-52h20c30 0 52 22 52 52v58z" fill={NAVY} />
      <path d="M78 214c8-8 18-12 30-12" stroke={LINE} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* Hals */}
      <rect x="98" y="172" width="44" height="22" rx="8" fill={NAVY_DARK} />
      {/* Verschränkte Arme */}
      <rect x="44" y="232" width="152" height="40" rx="20" fill={NAVY_DARK} />
      <path d="M62 252h56M126 252h52" stroke={LINE} strokeWidth="4" strokeLinecap="round" opacity="0.65" />
      <circle cx="58" cy="238" r="6" fill={SCREEN} />
      {/* Brust-Logo */}
      <path d="M104 214l10 8 10-12 12 8" stroke={LINE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Head />
    </svg>
  );
}
