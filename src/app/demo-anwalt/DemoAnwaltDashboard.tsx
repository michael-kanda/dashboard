import type { ReactNode } from 'react';

const kpis = [
  { label: 'Klicks', value: '1.848', change: '+14,7 %', tone: 'text-emerald-600' },
  { label: 'Impressionen', value: '48.210', change: '+22,4 %', tone: 'text-emerald-600' },
  { label: 'Nutzer', value: '2.474', change: '+10,5 %', tone: 'text-emerald-600' },
  { label: 'Conversions', value: '184', change: '+18,9 %', tone: 'text-emerald-600' },
  { label: 'KI-Traffic', value: '86', change: '+42,6 %', tone: 'text-violet-600' },
  { label: 'Google GenAI', value: '1.430', change: '+38,2 %', tone: 'text-blue-600' },
];

const queries = [
  ['rechtsanwalt wien', '214', '8.240', '2,6 %', '7,8'],
  ['fuehrerschein entzogen anwalt', '168', '2.980', '5,6 %', '3,2'],
  ['scheidungsanwalt wien erstberatung', '132', '2.140', '6,2 %', '2,9'],
  ['anwalt erbrecht testament', '96', '1.740', '5,5 %', '4,1'],
  ['strafverteidiger wien', '84', '1.960', '4,3 %', '5,6'],
];

const landingPages = [
  ['/verkehrsrecht/fuehrerschein-entzug/', '498', '39', '7,8 %'],
  ['/familienrecht/scheidung/', '493', '34', '6,9 %'],
  ['/rechtsanwalt-wien/', '704', '31', '4,4 %'],
  ['/erbrecht/testament/', '361', '22', '6,1 %'],
  ['/strafrecht/', '309', '18', '5,8 %'],
];

const aiSources = [
  ['ChatGPT', 39, '45 %', '#10a37f'],
  ['Perplexity', 22, '26 %', '#6366f1'],
  ['Gemini', 14, '16 %', '#4285f4'],
  ['Copilot', 8, '9 %', '#00a4ef'],
];

const channelData = [
  ['Organic Search', '1.842', '57 %'],
  ['Direct', '521', '16 %'],
  ['Paid Search', '196', '6 %'],
  ['AI Referrals', '86', '3 %'],
];

function GoogleUnderline() {
  return (
    <div className="mt-1 h-[10px] w-48 overflow-hidden rounded-full" aria-hidden="true">
      <div
        className="h-full w-full"
        style={{
          background: 'linear-gradient(90deg,#4285F4 0 25%,#EA4335 25% 50%,#FBBC05 50% 75%,#34A853 75% 100%)',
        }}
      />
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${className}`}>
      {children}
    </section>
  );
}

function Bar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function DemoAnwaltDashboard() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-800">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-lg bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                Oeffentliche Demo
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">DataPeak Dashboard fuer Rechtsanwaltskanzleien</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Fiktive Live-Ansicht fuer kanzlei-demo.at. Diese Seite zeigt typische SEO-, GA4-, Google-Ads-,
                KI-Traffic- und Google-GenAI-Kennzahlen ohne Login und ohne echte Kundendaten.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">Zeitraum</p>
              <p className="text-slate-600">13.05.2026 - 06.06.2026</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">{kpi.value}</span>
                <span className={`text-sm font-semibold ${kpi.tone}`}>{kpi.change}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Verlauf & Analyse</h2>
                <GoogleUnderline />
              </div>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Quelle: GA4 + GSC</span>
            </div>
            <div className="grid grid-cols-12 items-end gap-2">
              {[42, 48, 39, 55, 63, 58, 71, 76, 84, 91, 99, 108, 121, 116, 132, 146, 151, 164].map((height, index) => (
                <div key={index} className="flex h-56 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-violet-500"
                    style={{ height: `${Math.max(18, height)}px` }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Der Demo-Trend zeigt wachsende organische Sichtbarkeit, steigende Conversion-Qualitaet und zusaetzliche Nachfrage aus KI-Quellen.
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Google GenAI Sichtbarkeit</h2>
            <GoogleUnderline />
            <div className="mt-5 rounded-lg bg-blue-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">GenAI-Impressions</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-4xl font-semibold text-slate-900">1.430</span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-700">+38,2 %</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {landingPages.slice(0, 4).map((page, index) => (
                <div key={page[0]}>
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-slate-700">{page[0]}</span>
                    <span className="font-semibold text-slate-900">{[442, 318, 286, 194][index]}</span>
                  </div>
                  <Bar value={[88, 63, 57, 39][index]} color="bg-blue-500" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">KI-Traffic</h2>
            <GoogleUnderline />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Sitzungen</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">86</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Nutzer</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">61</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {aiSources.map(([source, sessions, share, color]) => (
                <div key={source as string} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color as string }} />
                  <span className="flex-1 text-sm font-medium text-slate-700">{source}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{sessions}</span>
                  <span className="w-12 text-right text-xs text-slate-500">{share}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Google Ads Performance</h2>
            <GoogleUnderline />
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Ad Spend', '967,60 EUR'],
                ['Klicks', '208'],
                ['Conversions', '32'],
                ['ROAS', '5,4'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 text-sm">
              {['Verkehrsrecht', 'Familienrecht', 'Erbrecht'].map((item, index) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                  <span className="font-medium text-slate-700">{item}</span>
                  <span className="font-semibold text-slate-900">{[11, 14, 7][index]} Conversions</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Top Suchanfragen</h2>
            <p className="mt-1 text-sm text-slate-500">Quelle GSC · Sortiert nach Klicks</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-3">Suchanfrage</th>
                    <th className="pb-3 text-right">Klicks</th>
                    <th className="pb-3 text-right">Impr.</th>
                    <th className="pb-3 text-right">CTR</th>
                    <th className="pb-3 text-right">Pos.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queries.map((row) => (
                    <tr key={row[0]}>
                      <td className="max-w-[260px] truncate py-3 font-medium text-slate-800">{row[0]}</td>
                      <td className="py-3 text-right tabular-nums">{row[1]}</td>
                      <td className="py-3 text-right tabular-nums">{row[2]}</td>
                      <td className="py-3 text-right tabular-nums">{row[3]}</td>
                      <td className="py-3 text-right tabular-nums">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Top Landingpages</h2>
            <p className="mt-1 text-sm text-slate-500">Sortiert nach Conversion-Leistung</p>
            <div className="mt-5 space-y-3">
              {landingPages.map((page, index) => (
                <div key={page[0]} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex justify-between gap-3">
                    <span className="truncate font-mono text-sm text-slate-800">{page[0]}</span>
                    <span className="font-semibold text-slate-900">{page[2]} Conv.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>{page[1]} Sitzungen</span>
                    <span>{page[3]} Conversion-Rate</span>
                  </div>
                  <div className="mt-3">
                    <Bar value={[78, 69, 44, 61, 58][index]} color="bg-violet-500" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {['Zugriffe nach Channel', 'Zugriffe nach Land', 'Zugriffe nach Endgeraet'].map((title, cardIndex) => (
            <Card key={title}>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <div className="mt-5 space-y-4">
                {(cardIndex === 0 ? channelData : cardIndex === 1 ? [['Oesterreich', '2.741', '85 %'], ['Deutschland', '294', '9 %'], ['Schweiz', '112', '3 %']] : [['Mobile', '2.014', '63 %'], ['Desktop', '1.028', '32 %'], ['Tablet', '174', '5 %']]).map((row, index) => (
                  <div key={row[0]}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{row[0]}</span>
                      <span className="text-slate-500">{row[1]}</span>
                    </div>
                    <Bar value={[85, 32, 18, 10][index] ?? 8} color={cardIndex === 0 && index === 3 ? 'bg-violet-500' : 'bg-sky-500'} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <footer className="mt-6 rounded-lg bg-white p-5 text-xs leading-relaxed text-slate-500 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
          Demo-Hinweis: GSC und Google Ads messen Impressionen und Klicks auf der Google-Suchseite.
          GA4 misst Website-Nutzung consent-abhaengig. KI-Sichtbarkeit und Prompt Research liefern Trend-Tendenzen,
          keine statischen Fixwerte. Alle Werte auf dieser Seite sind fiktiv.
        </footer>
      </div>
    </main>
  );
}
