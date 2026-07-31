# DataPeak Code Audit

Stand: 31.07.2026
Scope: Ausgangsanalyse des Repository-Stands `ee312d8a` mit anschliessender Umsetzung

## Umsetzungsstatus

Die nachfolgenden Kapitel dokumentieren den urspruenglichen Befund. Die freigegebenen Massnahmen wurden anschliessend umgesetzt:

- Produktiver Umfang von 235 auf 182 TypeScript-/TSX-Module reduziert; die lokale, unversionierte Datei `src/app/preview/page 2.tsx` blieb unangetastet.
- API-Oberflaeche von 84 auf 66 Routen reduziert.
- Alle nicht authentifizierten Setup-, Recreate- und Debug-Routen entfernt; `/api/clear-cache` ist jetzt auf `SUPERADMIN` beschraenkt.
- Exakte Dateiduplikate und statisch verwaiste Anwendungsmodule entfernt.
- Die beiden aktiven KI-Generator-Routen verwenden jetzt einen gemeinsamen Handler statt 2 x 1.077 Zeilen identischer Implementierung.
- Laufzeit-DDL in Seiten, Bibliotheken und API-Routen von 42 Fundstellen auf 0 reduziert.
- Versionierte Baseline-Migration mit Transaktion und Migrationstabelle unter `migrations/001_baseline.sql` eingefuehrt.
- Zentrale Typen fuer Benutzer, Projektstandorte, Datumsbereiche und KI-Traffic eingefuehrt.
- Google-Authentifizierung und Widget-Unterstreichung zentralisiert.
- 12 nicht verwendete direkte Abhaengigkeiten samt Typ-Paketen aus `package.json` und Lockfile entfernt.
- Statische Regressionserkennung mit `npm run audit:code` hinzugefuegt. Sie prueft Laufzeit-DDL, verwaiste Module, exakte Duplikate und unzulaessige `lib -> component`-Abhaengigkeiten.
- Lokaler Build ist nicht mehr von einem Download der Google Fonts oder dem Laden des Sentry-Build-Plugins abhaengig. In Vercel/CI bleibt die Sentry-Integration aktiv.

Aktueller automatischer Audit: **0 Laufzeit-DDL, 0 exakte Duplikate, 0 verwaiste produktive Module**.

Vor dem ersten Deployment dieses Stands muss einmal `npm run db:migrate` gegen die Ziel-Datenbank ausgefuehrt werden. Danach erfolgen Schemaaenderungen nicht mehr waehrend normaler Requests.

Verifikation:

- TypeScript (`tsc --noEmit`): erfolgreich
- ESLint fuer `src` und `scripts`: erfolgreich vor der abschliessenden, syntaktisch separat geprueften Build-Konfiguration
- `npm run audit:code`: erfolgreich, 182 Module geprueft
- `git diff --check`: erfolgreich
- Next-Produktionsbuild: lokal ohne Compilerfehler gestartet, blieb in der sehr langsamen Dateiverarbeitung der lokalen Toolchain stehen und wurde kontrolliert beendet; kein Build-Prozess blieb aktiv

## 1. Kurzfazit

Der aktuelle Code funktioniert als gewachsenes Produkt, zeigt aber klare Zeichen einer langen, featuregetriebenen Entwicklung:

- 235 TypeScript-/TSX-Dateien unter `src`
- 84 API-Routen
- 28 Dateien mit mehr als 500 Zeilen
- 33 Dateien ohne eingehende statische Importreferenz, zusammen ca. 4.386 Zeilen
- 4 Gruppen exakt identischer Dateien
- 77 potenziell ungenutzte Exports; davon ist nur ein Teil nach manueller Pruefung sicher entfernbar
- 42 DDL-Anweisungen (`ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`) in App-Routen oder Seiten
- 261 `console.log`-Aufrufe und 219 Vorkommen von `any`

Die groessten Risiken waren nicht nur ungenutzte Komponenten. Hoechste Prioritaet hatten frei erreichbare Setup-/Debug-Endpunkte, doppelte aktive KI-Generator-Routen und Datenbankmigrationen im normalen Request-Pfad. Diese Punkte sind laut Umsetzungsstatus bereinigt.

## 2. Methodik und Grenzen

Verwendet wurden:

1. TypeScript-AST-basierter Importgraph fuer relative Imports und `@/`-Aliase.
2. Erkennung von statischen und dynamischen Imports sowie Re-Exports.
3. Ausnahmen fuer Next.js-Einstiegspunkte wie `page.tsx`, `layout.tsx`, `route.ts`, Middleware und Instrumentation.
4. Hashvergleich fuer exakt identische Dateien.
5. Manuelle Pruefung der wichtigsten Kandidaten, API-Pfade und Aufrufstellen.
6. Zeilen-, DDL-, Logging- und `any`-Zaehler als Wartbarkeitssignale.

Grenzen:

- Direkte externe Aufrufe einer API-URL erscheinen nicht im Importgraphen.
- Dynamisch aus Datenbankwerten oder Strings geladene Module koennen statisch uebersehen werden.
- Vor dem Entfernen oeffentlicher API-Routen sollten Vercel-Zugriffslogs geprueft werden.
- "Ohne Importreferenz" bedeutet deshalb Loeschkandidat, nicht automatisch Loeschfreigabe.

Risikostufen in diesem Bericht:

- **Niedrig:** statisch eindeutig verwaist oder exaktes Duplikat; Build und kurzer Smoke-Test genuegen in der Regel.
- **Mittel:** intern unreferenziert, aber externe URL-Aufrufe, manuelle Betriebsablaeufe oder versteckte Produktpfade sind moeglich.
- **Hoch:** aktiv genutzt, sicherheitskritisch oder eng mit Daten- und Typvertraegen gekoppelt; nicht direkt loeschen, sondern zuerst entkoppeln und testen.

## 3. Sofortige Produktionsrisiken

### P0: Nicht authentifizierte Betriebs- und Setup-Endpunkte

Die Middleware laesst alle `/api`-Routen bewusst passieren. Die folgenden Routen enthalten selbst keine Authentifizierung:

| Route | Wirkung | Prioritaet | Loeschrisiko |
|---|---|---:|---:|
| [`/api/clear-cache`](../src/app/api/clear-cache/route.ts) | Kann ohne `userId` den gesamten `google_data_cache` loeschen; Kommentar bestaetigt fehlende Authentifizierung. | P0 | Niedrig bis mittel |
| [`/api/setup-demo`](../src/app/api/setup-demo/route.ts) | Erstellt bzw. aktualisiert Demo-Admin und Demo-Projekt mit festem Passwort `demo123` und gibt Zugangsdaten zurueck. | P0 | Niedrig |
| [`/api/setup-db`](../src/app/api/setup-db/route.ts) | Fuehrt `createTables()` ohne Authentifizierung aus. | P0 | Mittel |
| [`/api/setup-database`](../src/app/api/setup-database/route.ts) | Erstellt eine alte Landingpage-Tabellenstruktur ohne Authentifizierung. | P0 | Niedrig |
| [`/api/setup-project-assignments`](../src/app/api/setup-project-assignments/route.ts) | Veraendert das Datenbankschema ohne Authentifizierung. | P0 | Niedrig |
| [`/api/debug-auth`](../src/app/api/debug-auth/route.ts) | Legt Credential-Methode, vorhandene Env-Namen und Service-Account-E-Mail offen. | P1 | Niedrig |

Empfehlung: Zuerst aus der Produktion entfernen oder mindestens mit `SUPERADMIN` und einer expliziten Betriebsfreigabe absichern. Setup-Aufgaben sollten in versionierte Migrationen statt in HTTP-Routen wandern.

### P1: Destruktive Alt-Route bleibt deployt

[`/api/recreate-landingpages-table`](../src/app/api/recreate-landingpages-table/route.ts) ist zwar auf `SUPERADMIN` beschraenkt, fuehrt aber per GET ein `DROP TABLE ... CASCADE` aus. Ein GET-Endpunkt darf keine destruktive Datenbankoperation ausloesen. Die Route ist ein konkreter Loeschkandidat, sobald bestaetigt ist, dass sie nicht mehr als Notfallwerkzeug genutzt wird.

## 4. Exakte Duplikate

### Sicher verwaiste Duplikate

| Dateien | Befund | Empfehlung | Loeschrisiko |
|---|---|---|---:|
| [`datamax-settings-route.ts`](../src/app/api/admin/datamax-settings-route.ts) und [`datamax-settings/route.ts`](../src/app/api/admin/datamax-settings/route.ts) | Exakt identisch. Nur die zweite Datei ist eine gueltige Next.js-Route. | `datamax-settings-route.ts` loeschen. | Niedrig |
| [`ki-tool-settings-route.ts`](../src/app/api/admin/ki-tool-settings-route.ts) und [`ki-tool-settings/route.ts`](../src/app/api/admin/ki-tool-settings/route.ts) | Exakt identisch. Nur die zweite Datei ist eine gueltige Next.js-Route. | `ki-tool-settings-route.ts` loeschen. | Niedrig |
| [`src/skeletons/DashboardSkeleton.tsx`](../src/skeletons/DashboardSkeleton.tsx) und [`src/components/skeletons/DashboardSkeleton.tsx`](../src/components/skeletons/DashboardSkeleton.tsx) | Exakt identisch und beide ohne Importreferenz. | Beide loeschen oder einen Skeleton wieder bewusst anschliessen. | Niedrig |

### Aktives, fachlich problematisches Duplikat

[`generate-questions/route.ts`](../src/app/api/ai/generate-questions/route.ts) und [`generate-landingpage/route.ts`](../src/app/api/ai/generate-landingpage/route.ts) sind mit jeweils 1.077 Zeilen bytegenau identisch. Beide Endpunkte werden aktiv aufgerufen.

Folgen:

- Eine Fragen-Route fuehrt aktuell dieselbe Pipeline wie die Landingpage-Route aus.
- Jede Korrektur muss doppelt erfolgen.
- Die Dateien koennen unbemerkt auseinanderlaufen.

Empfehlung: Gemeinsamen Service extrahieren und nur die fachlich unterschiedlichen Prompt-/Response-Adapter in den Routen belassen. Keinen der beiden Endpunkte direkt loeschen, solange beide Clients existieren. Loeschrisiko: hoch.

## 5. Dateien ohne statische Importreferenz

Der Importgraph findet 33 TypeScript-/TSX-Dateien ohne eingehende Referenz. Die Liste ist nach Loeschrisiko gruppiert.

### Niedriges Loeschrisiko

| Datei | Zeilen | Grund |
|---|---:|---|
| [`src/app/api/admin/datamax-settings-route.ts`](../src/app/api/admin/datamax-settings-route.ts) | 104 | Exaktes, ungueltig benanntes Routenduplikat |
| [`src/app/api/admin/ki-tool-settings-route.ts`](../src/app/api/admin/ki-tool-settings-route.ts) | 173 | Exaktes, ungueltig benanntes Routenduplikat |
| [`src/skeletons/DashboardSkeleton.tsx`](../src/skeletons/DashboardSkeleton.tsx) | 49 | Exaktes Duplikat, keine Nutzung |
| [`src/components/skeletons/DashboardSkeleton.tsx`](../src/components/skeletons/DashboardSkeleton.tsx) | 49 | Exaktes Duplikat, keine Nutzung |
| [`src/lib/export-utils.ts`](../src/lib/export-utils.ts) | 187 | Kein Import; alle Exports ungenutzt |
| [`src/lib/kpis.ts`](../src/lib/kpis.ts) | 46 | Kein Import; alternative KPI-Normalisierung |
| [`src/lib/permissions.ts`](../src/lib/permissions.ts) | 132 | Kein Import; Berechtigungslogik wird an anderen Stellen separat umgesetzt |
| [`src/hooks/use-api-data.ts`](../src/hooks/use-api-data.ts) | 41 | Kein Import |
| [`src/hooks/useMaintenanceMode.ts`](../src/hooks/useMaintenanceMode.ts) | 59 | Kein Import |
| [`src/components/ManualKeywordInput.tsx`](../src/components/ManualKeywordInput.tsx) | 49 | Kein Import |
| [`src/components/ChannelChart.tsx`](../src/components/ChannelChart.tsx) | 21 | Kein Import; aktuelle Dashboard-Charts nutzen andere Komponenten |
| [`src/components/CountryChart.tsx`](../src/components/CountryChart.tsx) | 21 | Kein Import |
| [`src/components/DeviceChart.tsx`](../src/components/DeviceChart.tsx) | 21 | Kein Import |
| [`src/app/preview/page 2.tsx`](<../src/app/preview/page 2.tsx>) | 34 | Unversionierte lokale Datei; kein Bestandteil des Repositorys und deshalb vom automatischen Cleanup ausgeschlossen. Manuell pruefen. |

Zusaetzliche, nicht im `src`-Importgraphen liegende Kandidaten:

| Datei | Befund | Loeschrisiko |
|---|---|---:|
| [`AiTrafficDetailWidgetV2.tsx`](../AiTrafficDetailWidgetV2.tsx) | Alte Kopie im Repository-Root; die aktive Datei liegt unter `src/components`. | Niedrig |
| [`src/app/api/setup-landingpage-logs`](../src/app/api/setup-landingpage-logs) | Lose SQL-Datei ohne Dateiendung im App-Verzeichnis; keine Referenz. | Niedrig |
| [`test-semrush.js`](../test-semrush.js) | Nicht in `package.json` eingebunden, verwendet nicht installierte direkte Abhaengigkeit `axios` und feste Projekt-IDs. | Niedrig |

### Mittleres Loeschrisiko

Diese Dateien sind intern nicht referenziert, koennen aber geparkte oder noch manuell erwartete UI-Funktionen enthalten. Vor Entfernung sind mindestens Build und Dashboard-Smoke-Test erforderlich.

- [`AiQuestionsCard.tsx`](../src/components/AiQuestionsCard.tsx) - 140 Zeilen
- [`AiTrafficDetailWidget.tsx`](../src/components/AiTrafficDetailWidget.tsx) - 86 Zeilen, alte V1-UI
- [`BingAnalysisWidget.tsx`](../src/components/BingAnalysisWidget.tsx) - 235 Zeilen
- [`CacheRefreshButton.tsx`](../src/components/CacheRefreshButton.tsx) - 70 Zeilen
- [`CustomerLandingpagesView.tsx`](../src/components/CustomerLandingpagesView.tsx) - 93 Zeilen
- [`DashboardHeader.tsx`](../src/components/DashboardHeader.tsx) - 62 Zeilen
- [`GeoVisibilityScore.tsx`](../src/components/GeoVisibilityScore.tsx) - 167 Zeilen
- [`KpiCardsGrid.tsx`](../src/components/KpiCardsGrid.tsx) - 158 Zeilen
- [`LandingpageApproval.tsx`](../src/components/LandingpageApproval.tsx) - 424 Zeilen
- [`LandingpageLogbook.tsx`](../src/components/LandingpageLogbook.tsx) - 61 Zeilen
- [`MaintenanceAwareHeader.tsx`](../src/components/MaintenanceAwareHeader.tsx) - 67 Zeilen
- [`MaintenanceModeToggle.tsx`](../src/components/MaintenanceModeToggle.tsx) - 182 Zeilen
- [`ProjectHeader.tsx`](../src/components/ProjectHeader.tsx) - 102 Zeilen
- [`PromptTrackingBridge.tsx`](../src/components/PromptTrackingBridge.tsx) - 121 Zeilen
- [`PromptTrackingSettings.tsx`](../src/components/PromptTrackingSettings.tsx) - 404 Zeilen
- [`SemrushConfigDisplay.tsx`](../src/components/SemrushConfigDisplay.tsx) - 156 Zeilen
- [`SemrushConfiguration.tsx`](../src/components/SemrushConfiguration.tsx) - 264 Zeilen
- [`charts/KpiMultiLineChart.tsx`](../src/components/charts/KpiMultiLineChart.tsx) - 221 Zeilen
- [`layout/Header.tsx`](../src/components/layout/Header.tsx) - 387 Zeilen

## 6. API-Routen als Loeschkandidaten

API-Routen sind Next.js-Einstiegspunkte und erscheinen deshalb nie als normale Imports. Ihre Nutzung wurde separat ueber URL-Literale geprueft.

| Route | Interne Aufrufer | Empfehlung | Loeschrisiko |
|---|---|---|---:|
| [`/api/ai-traffic-detail`](../src/app/api/ai-traffic-detail/route.ts) | Nur das ungenutzte `AiTrafficDetailWidget.tsx` | Nach Vercel-Logpruefung entfernen. | Mittel |
| [`/api/ai/ai-traffic-detail`](../src/app/api/ai/ai-traffic-detail/route.ts) | Kein interner URL-Aufrufer | Nach Vercel-Logpruefung entfernen. | Mittel |
| [`/api/ai-traffic-detail-v2`](../src/app/api/ai-traffic-detail-v2/route.ts) | Aktiv durch Hook und Dashboard-Widget | Behalten. | Hoch |
| Setup-Routen unter `/api/setup-*` | Keine UI-Aufrufer gefunden | Durch Migrationen ersetzen und danach entfernen. | Mittel |
| Debug-Routen unter `/api/debug-*` | Keine produktiven UI-Aufrufer gefunden | Nach Logpruefung entfernen. | Niedrig bis mittel |

Es existieren 21 Setup-, Debug-, Diagnose- oder Recreate-Routen bei insgesamt 84 API-Routen. Diese Betriebsoberflaeche ist fuer ein Produktionssystem zu gross.

## 7. Potenziell ungenutzte Exports

Die statische Analyse meldet 77 Kandidaten. Viele davon sind Typen, die lokal verwendet werden, aber nicht exportiert sein muessen. Die folgenden Runtime-Exports sind besonders klar:

| Export | Datei | Befund | Empfehlung |
|---|---|---|---|
| `createAIStreamResponse` | [`ai-config.ts`](../src/lib/ai-config.ts) | Keine Import- oder lokale Nutzung | Export/Funktion entfernen, falls kein externer Test sie nutzt |
| `getUserByEmail` | [`database.ts`](../src/lib/database.ts) | Keine Nutzung | Entfernen oder einziges User-Repository daraus machen |
| `getQueriesByLandingPage` | [`google-api.ts`](../src/lib/google-api.ts) | Keine externe Nutzung; Objektvariante wird verwendet | Entfernen nach Test der Follow-up-Funktion |
| `normalizeFlatKpis` | [`dashboard-shared.ts`](../src/lib/dashboard-shared.ts) | Keine externe Nutzung | Entfernen |
| `hasDashboardData` | [`dashboard-shared.ts`](../src/lib/dashboard-shared.ts) | Keine Nutzung | Entfernen |
| `getMainKeyword`, `isQuestionKeyword`, `calculateKeywordDensity` | [`keyword-analyzer.ts`](../src/lib/keyword-analyzer.ts) | Keine Nutzung | Entfernen oder Tests/API bewusst anschliessen |
| `getTopSignals` | [`intent-analyzer.ts`](../src/lib/intent-analyzer.ts) | Keine externe Nutzung | Export entfernen; Funktion ggf. lokal belassen |
| `getSemrushKeywordsRapidFallback`, `formatSemrushResult`, `logSemrushAttempt`, `getSemrushDiagnostics` | [`semrush-api-handler.ts`](../src/lib/semrush-api-handler.ts) | Keine Aufrufer | Nach Semrush-Smoke-Test entfernen |
| `objectToWeatherMap` | [`weather.ts`](../src/lib/weather.ts) | Keine Nutzung | Entfernen |

Reine Typ-Exports sollten nicht einzeln gejagt werden. Sie sollten beim Konsolidieren der zentralen Typmodule bereinigt werden.

## 8. Typ- und Logikduplikate

### Mehrere inkompatible `User`-Quellen

- Zod-basierter `User` in [`lib/schemas.ts`](../src/lib/schemas.ts)
- Separates Interface in [`types/index.ts`](../src/types/index.ts)
- Session-Erweiterung in [`next-auth.d.ts`](../src/next-auth.d.ts)

Die Anwendung importiert aktiv aus beiden ersten Quellen. Unterschiede bei Optionalitaet, Nullwerten und Defaults waren bereits Ursache mehrerer Buildfehler. Ziel sollte ein kanonisches Datenbankschema plus klar abgeleitete DTOs sein.

### `AiTrafficData` mindestens dreifach definiert

- [`types/ai-traffic.ts`](../src/types/ai-traffic.ts)
- [`lib/google-api.ts`](../src/lib/google-api.ts)
- lokale Demo-Definition in [`lib/demo-data.ts`](../src/lib/demo-data.ts)

### Wiederholte Infrastruktur

- `createAuth` existiert fuenfmal: Google API, AI Traffic V1, AI Traffic V2 und zwei Diagnose-Routen.
- `GoogleCleanUnderline` existiert viermal in Widget-Komponenten.
- `FollowUpPath` und Landingpage-Query-Typen existieren in API-, Shared- und UI-Modulen.
- Datumsformatierung, Pfadnormalisierung und Zahlenformatierung werden mehrfach lokal implementiert.

Empfehlung: Kleine, fachlich benannte Module statt eines globalen `utils.ts`: `google-auth.ts`, `dashboard-types.ts`, `url-normalization.ts`, `widget-heading.tsx`.

## 9. Grosse Verantwortungsvermischungen

| Datei | Zeilen | Vermischte Verantwortungen | Empfohlene Aufteilung | Refaktorierungsrisiko |
|---|---:|---|---|---:|
| [`lib/google-api.ts`](../src/lib/google-api.ts) | 2.639 | Auth, GA4-Queue, Cache, GSC, GenAI, Sheets, Ads, Prompt Tracking, Typen | `google-auth`, `ga4-client/cache`, `gsc-client`, `google-ads`, `genai-gsc` | Hoch |
| [`api/ai/competitor-spy/route.ts`](../src/app/api/ai/competitor-spy/route.ts) | 1.794 | HTTP, Scraping, HTML-Extraktion, Tech-Erkennung, Promptbau, KI-Aufruf | Route + Scraper + Extractors + Prompt-Service | Hoch |
| [`app/admin/ki-tool/page.tsx`](../src/app/admin/ki-tool/page.tsx) | 1.761 | Setup-Wizard, Toolnavigation, API-Orchestrierung, Verlauf, Darstellung | Feature-Komponenten und `useKiToolWorkspace` | Hoch |
| [`components/PromptTrackingCard.tsx`](../src/components/PromptTrackingCard.tsx) | 1.570 | Tracking-UI, Research-Setup, Ranking, Promptbau, Markdownexport | Tracking-Widget + Research-Feature + Domain-Service | Hoch |
| [`lib/ai-traffic-extended-v2.ts`](../src/lib/ai-traffic-extended-v2.ts) | 1.187 | Auth, GA4-Abfragen, Intentklassifizierung, Journey, Vergleich | GA4-Repository + Klassifizierer + Aggregator | Hoch |
| [`admin/edit/[id]/EditUserForm.tsx`](../src/app/admin/edit/[id]/EditUserForm.tsx) | 1.166 | Benutzer, Rechte, Dashboard, APIs, Local SEO, Formularzustand | Tabs/Sections mit gemeinsamem Form-State | Mittel |
| [`lib/indexing-status.ts`](../src/lib/indexing-status.ts) | 947 | Schema, Sitemap-Crawler, SSRF-Schutz, GSC, Scheduling, Mapping | Repository + Sitemap-Service + Inspection-Service | Hoch |
| [`components/LocalSeoMapWidget.tsx`](../src/components/LocalSeoMapWidget.tsx) | 931 | Geometrie, Pins, Profil-API, Auswahlzustand, KPI-UI | Map + Marker + PlacePreview + DetailPanel | Mittel |
| [`components/AiTrafficDetailCard.tsx`](../src/components/AiTrafficDetailCard.tsx) | 897 | Alte V1-Darstellung und Typquelle fuer weiterhin genutzte V1-Lib | Typen aus UI loesen; V1 kontrolliert abbauen | Hoch |
| [`api/ai/chat/route.ts`](../src/app/api/ai/chat/route.ts) | 842 | Auth, Datenaggregation, Promptregeln, Streaming, Fallbackfragen | Context-Builder + Prompt + Route | Hoch |

## 10. Datenbankmigrationen im Request-Pfad

Besonders auffaellig:

- [`projekt/[id]/page.tsx`](../src/app/projekt/[id]/page.tsx) fuehrt bei jedem Projektaufruf fuenf `ALTER TABLE ... IF NOT EXISTS` aus.
- [`admin/edit/[id]/page.tsx`](../src/app/admin/edit/[id]/page.tsx) migriert beim Seitenaufruf.
- [`api/users/[id]/route.ts`](../src/app/api/users/[id]/route.ts) wiederholt DDL in GET/PUT-Pfaden.
- Weitere Projekt-, GenAI- und Local-SEO-Routen pruefen bzw. veraendern Spalten waehrend normaler Requests.

Risiken:

- zusaetzliche Datenbank-Roundtrips auf jedem Request
- Schema-Locks unter Last
- schwer reproduzierbare Deployments
- unterschiedliche Schemaquellen in `database.ts` und einzelnen Routen

Empfehlung: Eine versionierte Migrationskette als einzige Schemaquelle. Request-Code darf nur Daten lesen oder schreiben, nicht das Schema veraendern.

## 11. Spaghetti-Signale

Die Zaehler sind keine Fehler fuer sich, zeigen aber die Richtung:

- 261 `console.log`-Aufrufe; darunter dauerhafte `[PAGE-TRACE]`, `[DASHBOARD-DEBUG]` und Widget-Fetch-Logs
- 219 `any`-Vorkommen
- 28 Dateien ueber 500 Zeilen
- UI-Typen werden von Serverbibliotheken importiert, z. B. AI Traffic V1 aus `AiTrafficDetailCard.tsx`
- Migrations-, Diagnose-, Produktiv- und Fallbacklogik liegen nebeneinander

Empfehlung: Strukturiertes Logging mit Log-Level, keine Serverabhaengigkeit von UI-Dateien und eine maximale Zielgroesse von ca. 400-600 Zeilen pro Featuremodul.

## 12. Abhaengigkeitskandidaten

Folgende Runtime-Abhaengigkeiten haben keinen erkannten Import unter `src`. Vor Entfernung muessen Configs, Skripte und dynamische Imports geprueft werden:

`@ai-sdk/react`, `@google-analytics/data`, `@google/generative-ai`, `@tanstack/react-query`, `file-saver`, `google-trends-api`, `html-to-image`, `html2canvas`, `html2pdf.js`.

Zusaetzlich liegt `@types/bcryptjs` unter `dependencies` statt `devDependencies`. `react-dom` ist als Next/React-Kernabhaengigkeit kein Loeschkandidat.

## 13. Konkreter Bereinigungsplan

### Phase 0: Produktionssicherheit

1. `clear-cache`, `setup-demo`, `setup-db`, `setup-database`, `setup-project-assignments` und `debug-auth` entfernen oder absichern.
2. Destruktive GET-Route `recreate-landingpages-table` entfernen.
3. Vercel-Zugriffslogs der alten AI-Traffic-, Setup- und Debug-Routen pruefen.

### Phase 1: Nahezu risikofreies Loeschen

1. Die beiden `*-route.ts`-Duplikate entfernen.
2. Beide ungenutzten Skeleton-Dateien entfernen.
3. Root-Kopie `AiTrafficDetailWidgetV2.tsx`, lose SQL-Datei und kaputtes `test-semrush.js` entfernen.
4. Unversionierte `page 2.tsx` nicht automatisch anfassen; Eigentuemer und Zweck zuerst manuell klaeren.
5. Komplett unreferenzierte Hilfsmodule und Hooks aus Abschnitt 5 entfernen.

Erwartete Reduktion: mindestens ca. 1.000 Zeilen bei sehr niedrigem Risiko.

### Phase 2: UI-Altbestand

1. Die mittleren Loeschkandidaten in kleinen Gruppen entfernen.
2. Nach jeder Gruppe: TypeScript-Build, Dashboard-Screenshot, Admin-Smoke-Test.
3. Alte AI-Traffic-V1-UI entfernen, V1-Datenpfad fuer DataMax vorerst behalten.

### Phase 3: Konsolidierung

1. `User`, `AiTrafficData`, Landingpage- und Follow-up-Typen vereinheitlichen.
2. Generator-Routen auf gemeinsamen Service umstellen.
3. Google API nach Datenquelle teilen.
4. Runtime-DDL durch Migrationen ersetzen.
5. Prompt Tracking, KI Content Suite und Competitor Spy in Featuremodule aufteilen.

## 14. Freigabeempfehlung

Nicht alles in einem grossen Refactoring loeschen. Empfohlen sind getrennte Commits:

1. Security-Endpunkte
2. exakte Duplikate und Root-Altdateien
3. unreferenzierte Utilities/Hooks
4. unreferenzierte UI-Komponenten
5. Typkonsolidierung
6. Modulaufteilungen

So bleibt jeder Schritt einzeln pruefbar und bei einer Regression gezielt rueckgaengig zu machen.
