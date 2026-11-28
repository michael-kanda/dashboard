// src/components/marketing/ScrollReveal.tsx
// Lässt Elemente mit der Klasse .dp-reveal beim Scrollen sanft einblenden (14 px nach oben, 0,6 s).
// Nur Elemente unterhalb des sichtbaren Bereichs werden vorbereitet: Was beim Laden schon zu sehen ist,
// bleibt unverändert, ohne JavaScript oder mit „Bewegung reduzieren“ passiert gar nichts.
// Versatz für Karten nacheinander: data-reveal-delay="100" (Millisekunden).
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add('dp-reveal-in');
          observer.unobserve(el);
          // Verzögerung nur fürs Einblenden, danach nicht mehr (z. B. für Hover-Übergänge)
          el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    const fold = window.innerHeight * 0.92;
    document.querySelectorAll<HTMLElement>('.dp-reveal:not(.dp-reveal-in)').forEach((el) => {
      // Schon vorbereitete Elemente wieder beobachten (Effekt kann mehrfach laufen, z. B. im Strict Mode),
      // neue nur, wenn sie noch unterhalb des sichtbaren Bereichs liegen.
      if (!el.classList.contains('dp-reveal-armed')) {
        if (el.getBoundingClientRect().top < fold) return;
        el.classList.add('dp-reveal-armed');
        const delay = Number(el.dataset.revealDelay);
        if (delay > 0) el.style.transitionDelay = `${delay}ms`;
      }
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
