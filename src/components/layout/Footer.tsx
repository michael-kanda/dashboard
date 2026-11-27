// src/components/layout/Footer.tsx
// Gemeinsame Fußzeile für Dashboard und Landingpage.
import Link from 'next/link';

const linkClass = 'transition-colors duration-150 hover:text-heading hover:underline';

/** Eine Zeile: © Jahr Michael Kanda. Alle Rechte vorbehalten. | Impressum | Datenschutzerklärung */
export function FooterLine({ className = '' }: { className?: string }) {
  const currentYear = new Date().getFullYear();

  return (
    <p className={`text-[13px] text-muted ${className}`}>
      &copy; {currentYear}{' '}
      <a href="https://designare.at/" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Michael Kanda
      </a>
      . Alle Rechte vorbehalten.
      <span className="mx-2" aria-hidden="true">|</span>
      <Link href="/impressum" className={linkClass}>Impressum</Link>
      <span className="mx-2" aria-hidden="true">|</span>
      <Link href="/datenschutz" className={linkClass}>Datenschutzerklärung</Link>
    </p>
  );
}

export default function Footer() {
  return (
    <footer className="mt-12 w-full border-t border-border-subtle py-6">
      <FooterLine className="w-full px-6 text-center" />
    </footer>
  );
}
