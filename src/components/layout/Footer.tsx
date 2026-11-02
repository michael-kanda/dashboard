// src/components/layout/Footer.tsx
import React from 'react';
import Link from 'next/link';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-12 w-full border-t border-border-subtle py-6">
      <div className="w-full px-6 text-center text-[13px] text-muted">
        <p>
          &copy; {currentYear}{' '}
          <a
            href="https://designare.at/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-heading hover:underline transition-colors duration-150"
          >
            Michael Kanda & Evita
          </a>
          . Jede Codezeile von Hand gestreichelt. Also bitte nicht klauen. Alle
          Rechte vorbehalten.
          
          <span className="mx-2">|</span>
          <Link
            href="/impressum"
            className="hover:text-heading hover:underline transition-colors duration-150"
          >
            Impressum
          </Link>
          <span className="mx-2">|</span>
          <Link
            href="/datenschutz"
            className="hover:text-heading hover:underline transition-colors duration-150"
          >
            Datenschutzerklärung
          </Link>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
