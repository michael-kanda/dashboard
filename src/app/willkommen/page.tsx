// src/app/willkommen/page.tsx
// Landingpage für www.datapeak.at. Die Middleware schreibt "/" der Marketing-Domain hierher um.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  ArrowRight,
  BellFill,
  ChatQuoteFill,
  CheckCircleFill,
  CloudSunFill,
  FileEarmarkBarGraphFill,
  GeoAltFill,
  Grid1x2Fill,
  Link45deg,
  ListCheck,
  Search,
  Stars,
} from 'react-bootstrap-icons';
import ClosingCta from '@/components/marketing/ClosingCta';
import DataMaxChatPreview from '@/components/marketing/DataMaxChatPreview';
import ProductPreview from '@/components/marketing/ProductPreview';
import { MARKETING_ORIGIN, appOriginFor } from '@/lib/site-hosts';

const PAGE_TITLE = 'DataPeak – SEO- und KI-Sichtbarkeit in einem Dashboard';
const PAGE_DESCRIPTION =
  'DataPeak bündelt Search Console, Analytics, Google Ads und KI-Traffic aus ChatGPT & Co. in einem Dashboard. Der KI-Assistent DataMax erklärt die Zahlen in Klartext.';
const OG_IMAGE = `${MARKETING_ORIGIN}/og-datapeak.png`;

export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_ORIGIN),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  applicationName: 'DataPeak',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/',
    siteName: 'DataPeak',
    locale: 'de_AT',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'DataPeak – Ihre Daten. Endlich verständlich.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const CONTACT_MAIL = 'michael@designare.at';

const SOURCES = ['Search Console', 'Analytics 4', 'Google Ads', 'Semrush', 'Bing Webmaster', 'Unternehmensprofile'];

const PILLARS = [
  {
    title: 'Alles an einem Ort',
    text: 'Search Console, Analytics, Google Ads und Semrush in einem Dashboard. Statt fünf offener Tabs sehen Sie auf einen Blick, was sich gegenüber dem Vormonat verändert hat.',
  },
  {
    title: 'KI-Suche messbar',
    text: 'DataPeak zeigt, wie viele Besucher über ChatGPT, Perplexity, Gemini und Claude kommen, und fasst Ihre Position in der KI-Suche im GEO-Sichtbarkeits-Score zusammen.',
  },
  {
    title: 'In Klartext erklärt',
    text: 'Der KI-Assistent DataMax erklärt Trends in verständlichen Sätzen und schlägt konkrete nächste Schritte vor. Ohne Fachbegriffe, ohne Pivot-Tabellen.',
  },
];

const STEPS = [
  {
    title: 'Datenquellen verbinden',
    text: 'Wir verknüpfen Ihr Projekt einmalig mit Search Console, Analytics und den übrigen Quellen. Sie müssen dafür nichts installieren.',
  },
  {
    title: 'Automatisch aktuell',
    text: 'DataPeak holt die Zahlen einmal täglich im Hintergrund. Beim Öffnen sehen Sie sofort den letzten Stand, ohne zu warten.',
  },
  {
    title: 'Verstehen und handeln',
    text: 'Auffälligkeiten werden markiert, DataMax erklärt die Ursachen. Für Kunden oder Geschäftsführung gibt es den PDF-Bericht oder einen Gastlink.',
  },
];

const FEATURES = [
  { icon: Search, title: 'Top 100 Suchanfragen.', text: 'Mit der Seite, die jeweils dafür rankt.' },
  { icon: Stars, title: 'KI-Traffic pro Modell.', text: 'Sitzungen, Conversions und Verlauf für jede KI-Quelle.' },
  { icon: BellFill, title: 'Anomalie-Erkennung.', text: 'Starke Anstiege und Einbrüche bei KI-Quellen erkennt DataPeak von selbst.' },
  { icon: GeoAltFill, title: 'Lokale Sichtbarkeit.', text: 'Standorte auf der Karte, mit Unternehmensprofil und Vergleich.' },
  { icon: ChatQuoteFill, title: 'Fragen-Radar.', text: 'Lange, fragenartige Suchanfragen aus der Search Console.' },
  { icon: CloudSunFill, title: 'Wetter und Feiertage.', text: 'Im Verlauf sehen Sie, was den Traffic an einem Tag beeinflusst hat.' },
  { icon: ListCheck, title: 'Indexierungsstatus.', text: 'Welche Seiten Google kennt und wo es hakt.' },
  { icon: FileEarmarkBarGraphFill, title: 'PDF-Bericht.', text: 'Eine saubere Zusammenfassung auf Knopfdruck.' },
];

const TRUST = [
  'Zugang nur auf Einladung, ohne öffentliche Registrierung.',
  'Zwei-Faktor-Anmeldung für alle Admins verpflichtend.',
  'Jeder Kunde sieht ausschließlich die Daten seines eigenen Projekts.',
  'Gastlinks laufen automatisch ab und lassen sich jederzeit widerrufen.',
  'Daten kommen direkt aus den offiziellen Schnittstellen von Google und Co.',
];

const FAQ = [
  {
    group: 'Daten und Funktionen',
    items: [
      {
        q: 'Welche Datenquellen bindet DataPeak an?',
        a: 'Google Search Console, Google Analytics 4, Google Ads, Semrush, Bing Webmaster Tools und Google-Unternehmensprofile. Welche Bereiche im Dashboard erscheinen, lässt sich pro Projekt einstellen.',
      },
      {
        q: 'Wie aktuell sind die Zahlen?',
        a: 'DataPeak aktualisiert die Daten einmal täglich im Hintergrund. Beim Öffnen des Dashboards sehen Sie sofort den zuletzt gespeicherten Stand; wann er abgerufen wurde, steht direkt dabei.',
      },
      {
        q: 'Woher weiß DataPeak, wie viele Besucher von ChatGPT kommen?',
        a: 'Aus Google Analytics 4. Besuche, die von ChatGPT, Perplexity, Gemini, Claude und weiteren KI-Diensten kommen, werden erkannt und pro Quelle ausgewertet, inklusive Conversions und Folgeseiten.',
      },
      {
        q: 'Was zeigt das Fragen-Radar?',
        a: 'DataPeak filtert lange, fragenartige Suchanfragen ab zehn Wörtern aus der Search Console. So sehen Sie, wie Menschen ihre Fragen formulieren, und finden Themen, die auf Ihrer Website noch fehlen.',
      },
    ],
  },
  {
    group: 'Berichte und Zusammenarbeit',
    items: [
      {
        q: 'Kann ich Ergebnisse mit anderen teilen?',
        a: 'Ja, als PDF-Bericht oder als Gastlink. Ein Gastlink zeigt das Dashboard ohne Konto, läuft automatisch ab und lässt sich jederzeit widerrufen.',
      },
      {
        q: 'Was macht DataMax genau?',
        a: 'DataMax ist der KI-Assistent im Dashboard. Er liest die Zahlen Ihres Projekts, erklärt Veränderungen in Klartext und schlägt konkrete Verbesserungen vor, etwa für einzelne Seiten oder Standorte.',
      },
      {
        q: 'Funktioniert DataPeak auch am Handy?',
        a: 'Ja. Das Dashboard passt sich an Bildschirmgröße an und lässt sich am Smartphone, Tablet und Computer nutzen, hell oder dunkel.',
      },
    ],
  },
  {
    group: 'Zugang und Sicherheit',
    items: [
      {
        q: 'Wie bekomme ich Zugang?',
        a: `DataPeak ist nicht frei registrierbar. Fragen Sie über „Zugang anfragen“ unten auf dieser Seite einen Zugang an oder schreiben Sie an ${CONTACT_MAIL}. Wir richten Ihr Projekt ein und schicken Ihnen die Zugangsdaten.`,
      },
      {
        q: 'Wer sieht meine Daten?',
        a: 'Nur Sie und die Personen, die Ihr Projekt betreuen. Kundenkonten sehen ausschließlich ihr eigenes Projekt, Admins melden sich zusätzlich mit einem zweiten Faktor an.',
      },
      {
        q: 'Kann ich DataPeak vorher ansehen?',
        a: 'Ja. Die Demo zeigt das echte Dashboard mit einer erfundenen Kanzlei als Beispiel, ohne Anmeldung.',
      },
    ],
  },
];

// Strukturierte Daten für Suchmaschinen: Organisation, Website, Software und FAQ.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${MARKETING_ORIGIN}/#organization`,
      name: 'DataPeak',
      url: `${MARKETING_ORIGIN}/`,
      logo: `${MARKETING_ORIGIN}/logo-data-peak.webp`,
      email: CONTACT_MAIL,
      founder: { '@type': 'Person', name: 'Michael Kanda' },
    },
    {
      '@type': 'WebSite',
      '@id': `${MARKETING_ORIGIN}/#website`,
      url: `${MARKETING_ORIGIN}/`,
      name: 'DataPeak',
      inLanguage: 'de-AT',
      publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'DataPeak',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: `${MARKETING_ORIGIN}/`,
      description: PAGE_DESCRIPTION,
      inLanguage: 'de-AT',
      publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
      featureList: FEATURES.map((feature) => feature.title.replace(/\.$/, '')),
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.flatMap((group) => group.items).map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">
      <span className="h-px w-6 bg-accent" aria-hidden="true" />
      {children}
    </p>
  );
}

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-[640px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.08] tracking-[-0.025em] text-heading">{title}</h2>
      {lead && <p className="mt-4 text-[17px] leading-[1.55] text-body">{lead}</p>}
    </div>
  );
}

export default function LandingPage() {
  const appOrigin = appOriginFor(headers().get('host'));
  const demoHref = `${appOrigin}/demo-anwalt`;

  return (
    <div className="text-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c') }}
      />
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Eyebrow>SEO- und KI-Sichtbarkeit</Eyebrow>
          <h1 className="text-[clamp(42px,6.4vw,72px)] font-bold leading-[1.02] tracking-[-0.035em] text-heading">
            Ihre Daten. Endlich verständlich<span className="text-accent">.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[18px] leading-[1.55] text-body">
            DataPeak bündelt Search Console, Analytics, Google Ads und KI-Traffic in einem Dashboard. Der KI-Assistent
            DataMax erklärt, was die Zahlen bedeuten und was als Nächstes zu tun ist.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={demoHref}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent-solid px-6 text-[15px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Demo ansehen <ArrowRight size={15} aria-hidden="true" />
            </a>
            <a
              href="#ablauf"
              className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[15px] font-semibold text-heading transition-colors duration-150 hover:bg-fill"
            >
              So funktioniert’s
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Datenquellen">
            {SOURCES.map((source) => (
              <li key={source} className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-[12px] font-medium text-body">
                {source}
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview />
      </section>

      {/* ── Drei Säulen ──────────────────────────────────── */}
      <section id="funktionen" className="scroll-mt-16 border-y border-border-subtle bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Warum DataPeak" title="Zahlen, die Sie wirklich lesen." />
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {PILLARS.map((pillar, index) => (
              <div key={pillar.title} className="border-t border-border pt-5">
                <p className="text-[13px] font-semibold tabular-nums text-accent">0{index + 1}</p>
                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.015em] text-heading">{pillar.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6]">{pillar.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── So funktioniert's ────────────────────────────── */}
      <section id="ablauf" className="mx-auto max-w-[1120px] scroll-mt-16 px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="So funktioniert’s"
          title="Einmal verbinden. Dann läuft es."
          lead="Sie arbeiten an Ihrer Website wie bisher. DataPeak sammelt die Zahlen und meldet sich, wenn etwas auffällt."
        />

        <div className="mt-12 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]" aria-hidden="true">
          <div className="rounded-container border border-border bg-surface p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Quellen</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SOURCES.slice(0, 5).map((source) => (
                <span key={source} className="rounded-[6px] bg-fill px-2 py-1 text-[12px] font-medium text-body">{source}</span>
              ))}
            </div>
          </div>
          <div className="hidden items-center text-muted lg:flex"><ArrowRight size={18} /></div>
          <div className="rounded-container border border-accent/40 bg-accent-tint p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">DataPeak</p>
            <p className="mt-3 text-[15px] font-semibold text-heading">Einmal täglich aktualisiert</p>
            <p className="mt-1 text-[13px] text-body">Gespeichert, verglichen und auf Auffälligkeiten geprüft.</p>
          </div>
          <div className="hidden items-center text-muted lg:flex"><ArrowRight size={18} /></div>
          <div className="rounded-container border border-border bg-surface p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Ergebnis</p>
            <ul className="mt-3 space-y-1.5 text-[14px] text-heading">
              <li className="flex items-center gap-2"><Grid1x2Fill size={12} className="text-accent" /> Dashboard</li>
              <li className="flex items-center gap-2"><ChatQuoteFill size={12} className="text-accent" /> Erklärung von DataMax</li>
              <li className="flex items-center gap-2"><Link45deg size={14} className="text-accent" /> PDF-Bericht und Gastlink</li>
            </ul>
          </div>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-container border border-border bg-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-solid text-[14px] font-bold text-white">{index + 1}</span>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.015em] text-heading">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.6]">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Funktionen ───────────────────────────────────── */}
      <section className="border-y border-border-subtle bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Dashboard"
            title="Alles im Blick."
            lead="Vom ersten Klick in Google bis zur Anfrage über ChatGPT: DataPeak zeigt, woher Ihre Besucher kommen und was sie suchen."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-container border border-border bg-surface p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <p className="mt-3 text-[15px] leading-[1.55]">
                  <span className="font-semibold text-heading">{title}</span> {text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── DataMax ──────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="DataMax"
            title="Ein Analyst, der nie Feierabend hat."
            lead="DataMax kennt die Zahlen Ihres Projekts und beantwortet Fragen dazu in ganzen Sätzen. Warum ist der Traffic gestiegen? Welche Seite verliert? Was bringt am meisten?"
          />
          <ul className="mt-6 space-y-3 text-[15px]">
            {[
              'Erklärt Trends und Ausreißer in Klartext.',
              'Schlägt konkrete Verbesserungen für einzelne Seiten vor.',
              'Vergleicht Standorte und weist auf Datenlücken hin.',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <CheckCircleFill size={16} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <DataMaxChatPreview />
      </section>

      {/* ── Sicherheit ───────────────────────────────────── */}
      <section className="border-y border-border-subtle bg-surface">
        <div className="mx-auto grid max-w-[1120px] gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
          <SectionHeading
            eyebrow="Sicherheit"
            title="Ihre Daten bleiben Ihre Daten."
            lead="Analysedaten sind Geschäftsdaten. DataPeak ist von Grund auf darauf ausgelegt, dass jeder nur sieht, was er sehen soll."
          />
          <ul className="space-y-4 self-center">
            {TRUST.map((line) => (
              <li key={line} className="flex gap-3 text-[15px] leading-[1.55]">
                <CheckCircleFill size={16} className="mt-0.5 flex-shrink-0 text-success-bar" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-[1120px] scroll-mt-16 px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Häufige Fragen." lead={`Noch etwas offen? Schreiben Sie an ${CONTACT_MAIL}.`} />
        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          {FAQ.map((group) => (
            <div key={group.group}>
              <h3 className="dp-section-title">{group.group}</h3>
              <div className="overflow-hidden rounded-container border border-border bg-surface">
                {group.items.map((item) => (
                  <details key={item.q} className="group border-b border-border-subtle last:border-b-0">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3.5 text-[15px] font-semibold text-heading hover:bg-fill [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span className="mt-0.5 text-[18px] leading-none text-muted transition-transform duration-150 group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="px-4 pb-4 text-[14px] leading-[1.6] text-body">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Abschluss ────────────────────────────────────── */}
      <ClosingCta demoHref={demoHref} />
    </div>
  );
}
