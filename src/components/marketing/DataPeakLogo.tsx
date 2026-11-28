// src/components/marketing/DataPeakLogo.tsx
// Wortmarke in hell und dunkel als SVG (scharf in jeder Größe); die passende Variante blendet CSS ein.
// Nachgebaut aus dem alten WebP: Schrift Montserrat (Strichstärke 650) als Pfade, Monogramm aus Ellipsenbögen.
/* eslint-disable @next/next/no-img-element */

export default function DataPeakLogo({ className = '' }: { className?: string }) {
  return (
    <>
      <img src="/logo-data-peak.svg" alt="DataPeak" width={645} height={165} className={`${className} dark:hidden`} />
      <img src="/logo-data-peak-dark.svg" alt="DataPeak" width={645} height={165} className={`${className} hidden dark:block`} />
    </>
  );
}
