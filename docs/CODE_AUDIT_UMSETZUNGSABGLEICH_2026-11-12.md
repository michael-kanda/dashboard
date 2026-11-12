# Abgleich: Code-Audit vom 31.07.2026 gegen den heutigen Code

Stand: 12.11.2026
Geprüfter Commit: `2be441b3` (Branch `main`)
Bezug: [`CODE_AUDIT_2026-07-31.md`](CODE_AUDIT_2026-07-31.md), Kapitel 3 bis 14

Dieser Bericht prüft jeden Punkt aus dem Audit am aktuellen Code und ordnet ihn als **erledigt**, **teilweise** oder **offen** ein. Er ändert keinen Code.

## 1. Kurzfazit

- **Phase 0 (Produktionssicherheit): erledigt.** Alle Setup-, Recreate- und `debug-auth`-Routen sind entfernt. `/api/clear-cache` und die vier verbliebenen Debug-/Diagnose-Routen verlangen eine Anmeldung als `ADMIN` oder `SUPERADMIN`.
- **Phase 1 und 2 (Löschen): erledigt.** Alle im Audit genannten Lösch-Kandidaten sind weg. Nur die beiden ausdrücklich zu behaltenden Dateien sind noch da.
- **Phase 3 (Konsolidierung): teilweise.** Laufzeit-DDL, Google-API-Aufteilung, Generator-Routen, KI-Tool und Indexierung sind erledigt. Offen sind drei gleiche `FollowUpPath`-Definitionen, die nicht aufgeteilte `PromptTrackingCard.tsx` (1.550 Zeilen) und vier weitere sehr große Dateien.
- **Die Codebasis ist seit dem Audit wieder gewachsen**, von 174 auf 280 Module (+106 in 92 Commits). Das Audit-Skript meldet trotzdem keine Verstöße, prüft aber weder Dateigröße noch Authentifizierung.

## 2. Phase 0: Produktionssicherheit

| Punkt aus dem Audit | Heute | Status |
|---|---|---|
| `/api/clear-cache` ohne Authentifizierung | Nur `POST`, prüft `role === 'SUPERADMIN'`, sonst 403. Löscht nicht mehr, sondern markiert Snapshots als veraltet. | erledigt |
| `/api/setup-demo` (Passwort `demo123`) | entfernt | erledigt |
| `/api/setup-db`, `/api/setup-database`, `/api/setup-project-assignments` | entfernt, keine `setup-*`-Route mehr vorhanden | erledigt |
| `/api/debug-auth` | entfernt | erledigt |
| `/api/recreate-landingpages-table` (DROP per GET) | entfernt | erledigt |
| Vercel-Zugriffslogs der alten Routen prüfen | Aus dem Code nicht prüfbar | nicht prüfbar |

Weitere Debug-/Diagnose-Routen, die noch existieren, sind alle abgesichert:

| Route | Zugriff |
|---|---|
| `/api/debug-google-cache` | nur `SUPERADMIN` |
| `/api/debug-users` | nur `SUPERADMIN` |
| `/api/debug-gsc-landingpages` | `ADMIN` oder `SUPERADMIN` |
| `/api/diagnose-gsc` | `ADMIN` oder `SUPERADMIN` |

**Restrisiko:** Die Middleware lässt weiterhin jede `/api`-Route ohne Prüfung durch ([`src/middleware.ts:16`](../src/middleware.ts)). Jede Route muss sich also selbst absichern. Eine Suche über alle 60 Routen findet nur drei ohne eigene Prüfung im Routencode:

- `admin/content-studio/*` (3 Routen): abgesichert über `requireContentStudioProject` in [`src/lib/content-studio/access.ts`](../src/lib/content-studio/access.ts) (nur `ADMIN`/`SUPERADMIN`). Unkritisch.
- `/api/landingpages`: Platzhalter, der nur `{"message": "Daten-API funktioniert!"}` liefert. Kein Datenleck, aber toter Code ohne internen Aufrufer. Löschkandidat.
- `/api/auth/[...nextauth]`: muss öffentlich sein.

## 3. Phase 1 und 2: Löschen

Alle Dateien aus Kapitel 4, 5 und 6 des Audits wurden einzeln geprüft.

| Gruppe | Anzahl | Heute |
|---|---:|---|
| Exakte Duplikate (`*-route.ts`, Skeletons) | 4 | alle entfernt |
| Root-Altdateien (`AiTrafficDetailWidgetV2.tsx`, lose SQL-Datei, `test-semrush.js`) | 3 | alle entfernt |
| Unversionierte `src/app/preview/page 2.tsx` | 1 | nicht im Repository (war nie versioniert) |
| Unreferenzierte Hilfsmodule und Hooks (inkl. `export-utils.ts`) | 5 | alle entfernt |
| Unreferenzierte Kleinkomponenten (`ManualKeywordInput`, `*Chart`) | 4 | alle entfernt |
| Mittlere Lösch-Kandidaten (UI-Altbestand) | 19 | alle entfernt |
| Alte AI-Traffic-Routen V1 | 2 | beide entfernt |
| `AiTrafficDetailCard.tsx` (V1-UI) | 1 | entfernt |
| Zu behalten: `/api/ai-traffic-detail-v2`, V1-Datenpfad `ai-traffic-extended.ts` | 2 | beide vorhanden, wie geplant |

Status: **erledigt**.

## 4. Phase 3: Konsolidierung

### Typen und Duplikate (Kapitel 8)

| Punkt | Heute | Status |
|---|---|---|
| `User` aus mehreren inkompatiblen Quellen | `types/index.ts` leitet `User` jetzt aus dem Zod-Schema in `lib/schemas.ts` ab. Die Erweiterung in `next-auth.d.ts` ist die Session-Ergänzung und gehört dorthin. | erledigt |
| `AiTrafficData` dreifach definiert | Nur noch in `types/ai-traffic.ts` | erledigt |
| `createAuth` fünffach | Fünf Funktionen dieses Namens existieren noch, aber vier davon sind Einzeiler, die `createGoogleAuth` aus `google-auth.ts` mit dem passenden Scope aufrufen. Die Logik liegt an einer Stelle. | erledigt |
| `GoogleCleanUnderline` vierfach | Eine Komponente in `components/ui/GoogleCleanUnderline.tsx`, drei Widgets importieren sie | erledigt |
| `FollowUpPath` mehrfach | **Weiterhin dreimal identisch definiert**: [`components/charts/LandingPageChart.tsx:25`](../src/components/charts/LandingPageChart.tsx), [`lib/dashboard-shared.ts:59`](../src/lib/dashboard-shared.ts), [`lib/google/ga4.ts:555`](../src/lib/google/ga4.ts) | offen |

### Große Dateien (Kapitel 9)

| Datei laut Audit | Zeilen damals | Heute | Status |
|---|---:|---|---|
| `lib/google-api.ts` | 2.639 | 31 Zeilen; aufgeteilt nach `lib/google/` (`client`, `ga4`, `gsc`, `ads`, `sheets`, `dates`, `types` …) | erledigt |
| `api/ai/competitor-spy/route.ts` | 1.794 | Route entfernt (Commit `2dce6395`, „Refocus AI suite on content production“) | erledigt (durch Wegfall) |
| `app/admin/ki-tool/page.tsx` | 1.761 | 12 Zeilen | erledigt |
| `components/PromptTrackingCard.tsx` | 1.570 | **1.550 Zeilen**. Nur zwei kleine Module wurden ausgelagert (`lib/prompt-tracking/brand-detector.ts`, `query-classifier.ts`). | offen |
| `lib/ai-traffic-extended-v2.ts` | 1.187 | **1.162 Zeilen** | offen |
| `admin/edit/[id]/EditUserForm.tsx` | 1.166 | **1.210 Zeilen**, also gewachsen | offen |
| `lib/indexing-status.ts` | 947 | 23 Zeilen; aufgeteilt nach `lib/indexing/` (9 Module) | erledigt |
| `components/LocalSeoMapWidget.tsx` | 931 | 852 Zeilen | offen |
| `components/AiTrafficDetailCard.tsx` | 897 | entfernt | erledigt |
| `api/ai/chat/route.ts` | 842 | **840 Zeilen** | offen |

Das Audit nannte eine Zielgröße von 400–600 Zeilen pro Featuremodul. Heute liegen **18 Dateien über 500 Zeilen** (damals 28). Die größten:

| Datei | Zeilen |
|---|---:|
| `components/PromptTrackingCard.tsx` | 1.550 |
| `app/admin/edit/[id]/EditUserForm.tsx` | 1.210 |
| `lib/ai-traffic-extended-v2.ts` | 1.162 |
| `components/LocalSeoMapWidget.tsx` | 852 |
| `app/api/ai/chat/route.ts` | 840 |
| `lib/google/gsc.ts` | 831 |
| `lib/google-data-loader.ts` | 828 |
| `components/IndexingStatusWidget.tsx` | 798 |

Neu dazugekommen sind vor allem `lib/google/gsc.ts`, `lib/google-data-loader.ts`, `lib/google/ads.ts` und `lib/google/ga4.ts`. Sie sind Ergebnis der Aufteilung von `google-api.ts`, also fachlich schon getrennt, aber jede für sich noch groß.

### Generator-Routen (Kapitel 4)

Die beiden identischen 1.077-Zeilen-Routen `api/ai/generate-questions` und `api/ai/generate-landingpage` existieren nicht mehr. Status: **erledigt**.

### Datenbankmigrationen im Request-Pfad (Kapitel 10)

Keine `ALTER/CREATE/DROP TABLE|INDEX`-Anweisung mehr unter `src`. Schemaänderungen laufen über `migrations/` (inzwischen 9 Dateien, `001_baseline.sql` bis `009_project_share_links.sql`) und `npm run db:migrate`. Status: **erledigt**.

### Abhängigkeiten (Kapitel 12)

Alle neun genannten Pakete sowie `axios` sind nicht mehr in `dependencies`. `@types/bcryptjs` steht nicht mehr in `dependencies`. Status: **erledigt**.

### Spaghetti-Signale (Kapitel 11)

| Signal | Audit (31.07.) | Heute | Status |
|---|---:|---:|---|
| `console.log`-Aufrufe | 261 | 180 | teilweise |
| `any`-Vorkommen (grobe Zählung) | 219 | 170 | teilweise |
| Dateien über 500 Zeilen | 28 | 18 | teilweise |
| Serverbibliotheken importieren UI-Dateien (`lib -> components`) | ja | keine Fundstelle | erledigt |
| Strukturiertes Logging mit Log-Level | empfohlen | nicht umgesetzt (weiterhin `console.log`) | offen |

Die `any`-Zählung ist eine Textsuche (`: any`, `as any`, `<any>`, `any[]`) und mit der Zählung des Audits nur ungefähr vergleichbar.

## 5. Umfang der Codebasis

| Zeitpunkt | Module unter `src` | API-Routen |
|---|---:|---:|
| Audit-Ausgangsstand | 235 | 84 |
| Nach Umsetzung laut Audit-Dokument | 182 | 66 |
| Erster Commit nach dem Audit (01.08.2026), eigene Zählung | 174 | – |
| Heute (`2be441b3`) | 280 | 60 |

Die eigene Zählung schließt `.d.ts`-Dateien aus. Das erklärt vermutlich den Unterschied zwischen 174 und 182.

Seit dem Audit kamen 106 Module dazu, vor allem in `lib/google/`, `lib/indexing/`, `lib/sync/`, `lib/content-studio/` und `lib/data-modules/`. Das ist überwiegend Aufteilung und neue Funktion, nicht neuer Altbestand: das Audit-Skript findet keine verwaisten Module und keine Duplikate. Die Kennzahl „Module“ eignet sich daher nicht mehr als Erfolgsmaß für die Bereinigung.

## 6. Verifikation

Auf Commit `2be441b3`, nach `npm ci`:

| Prüfung | Ergebnis |
|---|---|
| `npm run audit:code` | erfolgreich, 280 TS/TSX-Dateien geprüft, 0 Verstöße |
| `npx tsc --noEmit` | erfolgreich, keine Fehler |
| `npm run test:data-modules` | 93 von 93 Tests bestanden |
| Next-Produktionsbuild | nicht ausgeführt |
| Laufzeittest, Vercel-Logs | nicht ausgeführt |

## 7. Grenzen dieses Abgleichs

- Die Auth-Prüfung der Routen ist eine Textsuche nach bekannten Mustern (`auth()`, `requireContentStudioProject` u. a.) plus manuelle Prüfung der Treffer ohne Muster. Sie zeigt, **ob** eine Rollenprüfung im Code steht, nicht, ob jede Verzweigung einer Route sie erreicht.
- Ob Clients extern noch entfernte Routen aufrufen, zeigen nur die Vercel-Logs.
- Die Zählungen für `console.log` und `any` sind Textsuchen, keine AST-Analyse.

## 8. Offene Punkte nach Priorität

1. **`PromptTrackingCard.tsx` aufteilen** (1.550 Zeilen). Im Audit-Plan Phase 3, Punkt 5, ausdrücklich genannt und nicht umgesetzt.
2. ~~**`FollowUpPath` auf eine Definition reduzieren**~~. Umgesetzt in #4, siehe Kapitel 9.
3. **`EditUserForm.tsx` aufteilen**. Sie ist seit dem Audit von 1.166 auf 1.210 Zeilen gewachsen statt zu schrumpfen.
4. ~~**`/api/landingpages` löschen**~~. Umgesetzt in #4, siehe Kapitel 9.
5. ~~**Audit-Skript erweitern**~~ (Dateigröße, Auth je Route). Umgesetzt in #4, siehe Kapitel 9.
6. **Strukturiertes Logging** statt 180 `console.log`-Aufrufen (Audit-Empfehlung aus Kapitel 11).
7. **`ai-traffic-extended-v2.ts` (1.162 Zeilen) und `api/ai/chat/route.ts` (840 Zeilen)** wie im Audit vorgeschlagen aufteilen.
8. **`axios` als direkte Abhängigkeit eintragen oder ersetzen.** `src/lib/semrush-api.ts` importiert `axios`, das seit der Bereinigung nicht mehr in `package.json` steht. Es wird nur indirekt über `@getbrevo/brevo` installiert.

## 9. Nachtrag: Folge-PRs

Kapitel 1 bis 8 beschreiben den Stand `2be441b3`. Danach entstanden zwei PRs, die Punkte aus Kapitel 8 umsetzen. Beim Schreiben dieses Nachtrags waren beide noch nicht gemergt.

| PR | Inhalt | Kapitel-8-Punkt |
|---|---|---|
| #4 | `FollowUpPath` und `LandingPageFollowUpData` nur noch in `src/types/landing-page.ts`. Platzhalter `/api/landingpages/route.ts` gelöscht (Unterrouten bleiben). `audit:code` prüft Dateigröße (neue Dateien max. 600 Zeilen, große Dateien nicht über ihre Baseline) und Auth je API-Route. | 2, 4, 5 |
| #5 | GitHub-Actions-Workflow für lint, typecheck, Tests und `audit:code`. ESLint von 233 Fehlern auf 0, `any` als Warnung mit Obergrenze 183. Zwei React-Fehler behoben (siehe unten). | neu |

Bei der ESLint-Bereinigung in #5 sind zwei Fehler aufgefallen, die dieser Abgleich nicht gefunden hatte: In `GoogleAdsWidget.tsx` und `PromptTrackingCard.tsx` lief ein `useMemo` erst nach einem frühen `return`. Wechselt ein Widget zwischen „keine Daten“ und „Daten da“, bricht React mit „Rendered more hooks than during the previous render“ ab.

Bis #5 hatte das Repo keine CI, und `audit:code` lief nur, wenn es jemand von Hand startete. Nach dem Merge von #5 laufen `audit:code`, Typen, Tests und ESLint bei jedem PR.
