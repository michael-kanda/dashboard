'use client';

import Image from 'next/image';

export default function DashboardLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
      <div className="bg-surface p-8 rounded-3xl shadow-2xl border border-theme-border-subtle flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
        <div className="relative w-full flex justify-center">
          <Image
            src="/data-max-arbeitet.webp"
            alt="Data Max arbeitet"
            width={400}
            height={400}
            className="h-[200px] w-auto object-contain"
            priority
          />
        </div>
        <div>
          <h3 className="text-xl font-bold text-strong mb-1">Daten werden aktualisiert</h3>
          <p className="text-muted text-sm leading-relaxed">
            Rufe aktuelle Metriken von Google & Semrush ab...
          </p>
        </div>
        <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar" />
        </div>
      </div>
    </div>
  );
}
