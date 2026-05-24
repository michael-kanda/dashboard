# DataPeak

> SEO-Dashboard mit KI-Analyse · SEO Dashboard with AI Analysis

**Author:** Michael Kanda
**Homepage:** [designare.at/data-peak-dashboard](https://designare.at/data-peak-dashboard)

---

🇩🇪 [Deutsch](#-deutsch) · 🇬🇧 [English](#-english)

---

## 🇩🇪 Deutsch

### Das Wichtigste in Kürze

- **Alles auf einen Blick:** Search Console, Analytics und KI-Traffic in einem einzigen Dashboard — statt 5 offene Google-Tabs.
- **KI-Traffic sichtbar:** Sieh zum ersten Mal, wie viele Besucher über ChatGPT, Claude, Perplexity oder Google Gemini auf deine Website kommen — inklusive Trend-Vergleich pro Modell.
- **GEO-Sichtbarkeits-Score:** Eine einzige Kennzahl von 0–100 zeigt, wie gut deine Inhalte in der KI-Suche sichtbar sind. Aus Anteil, Quellen-Vielfalt und Wachstum berechnet.
- **Prompt Tracking:** Erkenne lange, konversationsartige Suchanfragen direkt in der Google Search Console — ein erster Proxy für AI-Mode-Queries, bevor Google offizielle Daten dazu liefert.
- **Proaktive Insights:** Anomalie-Erkennung meldet Spikes und Einbrüche pro KI-Quelle automatisch — du musst keine Trends mehr selbst suchen.
- **Verstehen statt rätseln:** Der KI-Assistent **DataMax** erklärt deine Daten in Klartext und liefert konkrete Empfehlungen.

### Was ist DataPeak?

DataPeak bündelt deine wichtigsten Daten aus Google Search Console und Google Analytics 4 an einem Ort und sagt dir in Klartext, was funktioniert und was nicht. Zusätzlich erkennt es einen Kanal, den die meisten noch gar nicht auf dem Radar haben: **KI-Traffic**. Immer mehr Besucher kommen über ChatGPT, Claude, Perplexity und Google Gemini auf Websites — DataPeak misst diese Quellen automatisch, erkennt Bewegungen und liefert mit dem **GEO-Sichtbarkeits-Score** eine kompakte Bewertung deiner Position in der KI-Suche.

Mit dem **Prompt Tracking** geht DataPeak einen Schritt weiter: Es filtert prompt-ähnliche Suchanfragen (≥10 Wörter) direkt aus der Search Console heraus und macht so sichtbar, wie Nutzer in Zeiten von ChatGPT & Co. ihre Fragen formulieren — lange, bevor Google offizielle AI-Mode-Daten liefert.

### Features

- **Zentrales Dashboard:** Impressionen, Klicks, Besucher, Conversions, Verweildauer und Absprungrate — mit Vergleich zum Vormonat.
- **Top 100 Suchanfragen mit Landingpage-Zuordnung:** Erkenne sofort, welche Seite für welches Keyword rankt.
- **Traffic-Segmentierung:** Nach Channel (Organic, Direct, Referral, Social), Land und Endgerät (Desktop, Mobile, Tablet).
- **KI-Traffic-Analyse:** ChatGPT, Claude, Perplexity und Google Gemini werden automatisch erkannt — inkl. Sitzungen, Nutzer, Folgepfade und Interaktionsrate. Pro KI-Quelle: Top-Landingpage, Conversion-Rate und 14-Tage-Sparkline auf einen Blick.
- **Multi-Line Trend-Chart pro KI-Modell:** Vergleiche das Wachstum von ChatGPT vs. Gemini vs. Perplexity direkt nebeneinander — Trends, die im aggregierten Verlauf untergehen, werden sofort sichtbar.
- **GEO-Sichtbarkeits-Score (0–100):** Eine kompakte Health-Anzeige aus drei Faktoren — KI-Anteil, Quellen-Vielfalt und Wachstum. Bewertet deine Position in der KI-Suche auf einen Blick.
- **Anomalie-Erkennung:** Spikes (≥ +100 %) und Drops (≤ –50 %) pro KI-Quelle werden automatisch erkannt und mit der jeweils stärksten Landingpage verknüpft ("Gemini-Traffic +127 % diese Woche, v.a. auf /pricing").
- **Conversion-Tracking pro KI-Quelle:** Welche KI bringt nicht nur Traffic, sondern auch Wert? Conversions und Conversion-Rate werden pro Modell ausgewiesen.
- **Prompt Tracking (GSC Proxy):** Konversationsartige Suchanfragen mit ≥10 Wörtern werden automatisch isoliert und nach Brand vs. Non-Brand klassifiziert.
- **KI-Cluster-Analyse der Prompts:** Auf Knopfdruck gruppiert Gemini deine Prompt-Queries in thematische Cluster, erkennt dominante Intents (informational, transactional, comparative …) und identifiziert konkrete Content-Lücken.
- **Intent-Kategorisierung & User-Journey:** Welche Seiten besuchen KI-Nutzer nach dem Einstieg?
- **Wetter- & Feiertagsanzeige:** Verstehe Traffic-Einbrüche und -Spitzen im Kontext.
- **DataMax KI-Assistent:** Erklärt Trends in Klartext und empfiehlt nächste Schritte.
- **PDF-Reports auf Knopfdruck:** Saubere Analysen für dich oder deine Stakeholder.

### Technischer Stack

- **Framework:** Next.js 14
- **Sprache:** TypeScript
- **KI:** Vercel AI SDK + Google Gemini (für DataMax und Prompt-Cluster-Analyse)
- **Datenbank:** Vercel Postgres
- **APIs:** Google Search Console API, Google Analytics 4 Data API (via OAuth2)
- **Hosting:** Vercel

### Datensicherheit

DataPeak nutzt ausschließlich offizielle Google-APIs via OAuth2. Daten werden in einer dedizierten Vercel-Umgebung sicher verarbeitet — kein Drittanbieter sieht deine Analytics-Daten.

### Zielgruppe

Jeder Webseitenbetreiber mit Zugang zu Google Search Console und Google Analytics 4. Aktuell werden exklusive Testzugänge vergeben — eine Self-Service-Version ist in Planung.

### Testzugang

Testzugang anfragen auf [designare.at/data-peak-dashboard](https://designare.at/data-peak-dashboard).

---

## 🇬🇧 English

### Key Takeaways

- **Everything at a glance:** Search Console, Analytics, and AI traffic in a single dashboard — instead of five open Google tabs.
- **AI traffic made visible:** See for the first time how many visitors come to your website from ChatGPT, Claude, Perplexity, or Google Gemini — including trend comparison per model.
- **GEO Visibility Score:** A single 0–100 metric shows how well your content is surfaced in AI search. Calculated from share, source diversity, and growth.
- **Prompt Tracking:** Identify long, conversational search queries straight from Google Search Console — an early proxy for AI-Mode queries, well before Google releases official data on this.
- **Proactive insights:** Anomaly detection automatically flags spikes and drops per AI source — you no longer have to spot trends yourself.
- **Understand instead of guessing:** The AI assistant **DataMax** explains your data in plain language and delivers concrete recommendations.

### What is DataPeak?

DataPeak consolidates your most important data from Google Search Console and Google Analytics 4 in one place and tells you in plain language what is working and what is not. On top of that, it surfaces a channel most people are not yet tracking: **AI traffic**. More and more visitors reach websites via ChatGPT, Claude, Perplexity, and Google Gemini — DataPeak detects these sources automatically, spots movements early, and delivers a compact assessment of your position in AI search with the **GEO Visibility Score**.

With **Prompt Tracking**, DataPeak goes one step further: it filters prompt-like search queries (≥10 words) directly from Search Console and reveals how users actually phrase their questions in the age of ChatGPT & Co. — long before Google delivers official AI-Mode data.

### Features

- **Central dashboard:** Impressions, clicks, visitors, conversions, time on site, and bounce rate — with month-over-month comparison.
- **Top 100 search queries with landing page mapping:** See instantly which page ranks for which keyword.
- **Traffic segmentation:** By channel (Organic, Direct, Referral, Social), country, and device (Desktop, Mobile, Tablet).
- **AI traffic analysis:** ChatGPT, Claude, Perplexity, and Google Gemini are detected automatically — including sessions, users, follow-up paths, and engagement rate. Per AI source: top landing page, conversion rate, and a 14-day sparkline at a glance.
- **Multi-line trend chart per AI model:** Compare the growth of ChatGPT vs. Gemini vs. Perplexity side by side — trends that get lost in an aggregated view become immediately visible.
- **GEO Visibility Score (0–100):** A compact health indicator built from three factors — AI share, source diversity, and growth. Rates your position in AI search at a glance.
- **Anomaly detection:** Spikes (≥ +100 %) and drops (≤ –50 %) per AI source are detected automatically and linked to the strongest landing page ("Gemini traffic +127 % this week, mostly on /pricing").
- **Conversion tracking per AI source:** Which AI delivers not just traffic but actual value? Conversions and conversion rate are reported per model.
- **Prompt Tracking (GSC proxy):** Conversational search queries with ≥10 words are isolated automatically and classified into Brand vs. Non-Brand.
- **AI cluster analysis of prompts:** With one click, Gemini groups your prompt queries into thematic clusters, detects dominant intents (informational, transactional, comparative …) and surfaces concrete content gaps.
- **Intent categorization & user journey:** See which pages AI-referred visitors go to next.
- **Weather & holiday overlay:** Understand traffic drops and spikes in context.
- **DataMax AI assistant:** Explains trends in plain language and recommends next steps.
- **One-click PDF reports:** Clean analyses for you or your stakeholders.

### Tech Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **AI:** Vercel AI SDK + Google Gemini (powers DataMax and prompt cluster analysis)
- **Database:** Vercel Postgres
- **APIs:** Google Search Console API, Google Analytics 4 Data API (via OAuth2)
- **Hosting:** Vercel

### Data Security

DataPeak uses only official Google APIs via OAuth2. Data is processed securely in a dedicated Vercel environment — no third-party ever sees your analytics data.

### Who Is It For?

Any website owner with access to Google Search Console and Google Analytics 4. Exclusive test access is currently being granted — a self-service version is planned.

### Request Access

Request test access at [designare.at/data-peak-dashboard](https://designare.at/data-peak-dashboard).

---


## 👤 Author · Autor

**Michael Kanda** — Komplize für Web & KI · Accomplice for Web & AI

WordPress ohne Ballast, Code ohne Kompromisse, KI mit Verstand.
WordPress without bloat, code without compromise, AI with common sense.

- 🌐 Website: [designare.at](https://designare.at)
- 📊 DataPeak: [designare.at/data-peak-dashboard](https://designare.at/data-peak-dashboard)

---

## 📄 License

© Michael Kanda — All rights reserved · Alle Rechte vorbehalten.

Siehe [Impressum](https://designare.at/impressum.html) und [Datenschutz](https://designare.at/datenschutz.html).
See [Impressum](https://designare.at/impressum.html) and [Privacy Policy](https://designare.at/datenschutz.html).
