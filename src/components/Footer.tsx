// src/components/layout/Footer.tsx
import React from 'react';
import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-surface shadow-inner mt-12 py-6 border-t border-theme-border-subtle transition-colors duration-200">
      <div className="w-full px-6 text-center text-muted text-xs">
        <p>
          &copy; {currentYear}{' '}
          <a
            href="https://designare.at/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-strong hover:underline transition-colors"
          >
            Michael Kanda & Evita
          </a>
          . Jede Codezeile von Hand gestreichelt. Also bitte nicht klauen. Alle
          Rechte vorbehalten.
          
          <span className="mx-2">|</span>
          <Link
            href="/impressum"
            className="hover:text-strong hover:underline transition-colors"
          >
            Impressum
          </Link>
          <span className="mx-2">|</span>
          <Link
            href="/datenschutz"
            className="hover:text-strong hover:underline transition-colors"
          >
            Datenschutzerklärung
          </Link>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
