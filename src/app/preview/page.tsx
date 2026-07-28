import {
  Activity,
  BarChart3,
  Bot,
  ChevronDown,
  Gauge,
  Globe2,
  LayoutDashboard,
  LineChart,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';

const kpis = [
  { label: 'Impressionen', value: '28.934', change: '+22,3%', tone: 'text-blue-600' },
  { label: 'Klicks', value: '1.247', change: '+18,5%', tone: 'text-emerald-600' },
  { label: 'Nutzer', value: '2.847', change: '+19,2%', tone: 'text-indigo-600' },
  { label: 'Conversions', value: '127', change: '+31,5%', tone: 'text-amber-600' },
];

const channels = [
  ['Organic Search', '46%', 'bg-blue-500'],
  ['Direct', '24%', 'bg-emerald-500'],
  ['Referral', '18%', 'bg-violet-500'],
  ['Social', '12%', 'bg-amber-500'],
];

const bars = [48, 58, 44, 70, 62, 74, 68, 86, 79, 92, 83, 96];

const navigation = [
  [Gauge, 'Übersicht', true],
  [LineChart, 'Verlauf & Analyse', false],
  [Bot, 'KI-Traffic', false],
  [Search, 'Keywords', false],
  [Settings, 'Einstellungen', false],
] as const;

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#188bdb] text-white">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">DataPeak</div>
              <div className="text-xs font-medium text-slate-500">SEO Performance Suite</div>
            </div>
          </div>

          <nav className="space-y-1">
            {navigation.map(([Icon, label, active]) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? 'bg-blue-50 text-[#1479bf]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </div>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/85 px-5 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Globe2 size={14} />
                  demo-shop.de
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Dashboard Übersicht</h1>
              </div>
              <button className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                Letzte 30 Tage
                <ChevronDown size={16} />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-6 p-5 lg:p-8">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <article key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
                    <Activity className={kpi.tone} size={18} />
                  </div>
                  <div className="mt-4 text-3xl font-bold tracking-tight">{kpi.value}</div>
                  <div className={`mt-2 text-sm font-semibold ${kpi.tone}`}>{kpi.change} zum Vormonat</div>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Performance Verlauf</h2>
                    <p className="text-sm text-slate-500">Klicks, Impressionen und Nutzer im Vergleich</p>
                  </div>
                  <BarChart3 className="text-slate-400" size={20} />
                </div>
                <div className="flex h-72 items-end gap-3">
                  {bars.map((height, index) => (
                    <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="w-full rounded-t-md bg-[#188bdb]" style={{ height: `${height}%` }} />
                      <span className="text-[10px] font-medium text-slate-400">{index + 1}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold">Traffic Quellen</h2>
                    <p className="text-sm text-slate-500">Anteile nach Channel</p>
                  </div>
                  <Sparkles className="text-[#188bdb]" size={20} />
                </div>
                <div className="space-y-4">
                  {channels.map(([label, value, color]) => (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-600">{label}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className={`h-2 rounded-full ${color}`} style={{ width: value }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">KI-Traffic & Top Landingpages</h2>
                  <p className="text-sm text-slate-500">Kompakte Arbeitsansicht für Analyse und Optimierung</p>
                </div>
                <Bot className="text-indigo-500" size={22} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {['ChatGPT: 88 Sessions', 'Perplexity: 41 Sessions', 'Google Gemini: 29 Sessions'].map((item) => (
                  <div key={item} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
