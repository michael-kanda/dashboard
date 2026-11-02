import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung | Data Peak',
  description: 'Datenschutzerklärung für das Data Peak Dashboard.',
};

export default function DatenschutzPage() {
  return (
    <div className="bg-page px-[clamp(16px,3vw,40px)] pt-7 pb-12">
      <div className="max-w-[680px] space-y-6 text-[16px] leading-[1.6]">
        <h1 className="text-[29px] font-bold leading-[1.1] tracking-[-0.02em] text-heading">
          Datenschutzerklärung
        </h1>

        <section>
          <p className="text-body">
            Verantwortlicher im Sinne der Datenschutzgesetze, insbesondere der
            EU-Datenschutzgrundverordnung (DSGVO), ist:
          </p>
          <p className="text-body mt-4">
            Michael Kanda
            <br />
            Schlachthammerstraße 86/6
            <br />
            1220 Wien, Österreich
          </p>
          <p className="text-body mt-4">
            E-Mail: michael@designare.at
            <br />
            Telefon: +43 664 94 60 890
          </p>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            1. Allgemeines
          </h2>
          <p className="text-body">
            Der Schutz Ihrer persönlichen Daten ist mir ein besonderes Anliegen.
            Ich verarbeite Ihre Daten daher ausschließlich auf Grundlage der
            gesetzlichen Bestimmungen (DSGVO, TKG 2021). Diese
            Datenschutzerklärung informiert Sie über die Verarbeitung Ihrer
            personenbezogenen Daten im Rahmen der Nutzung des &quot;Data Peak&quot;
            Dashboards.
          </p>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            2. Art der verarbeiteten Daten
          </h2>
          <p className="text-body mb-4">
            Im Rahmen der Nutzung dieses Dienstes werden folgende Datenkategorien
            verarbeitet:
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 text-body">
            <li>
              <strong>Bestandsdaten:</strong> E-Mail-Adresse, Passwort
              (verschlüsselt gespeichert), zugewiesene Rolle (z.B. ADMIN,
              BENUTZER), Mandanten-ID und Berechtigungen.
            </li>
            <li>
              <strong>Konfigurationsdaten:</strong> Von Ihnen oder einem
              Administrator hinterlegte Daten zu Ihren Projekten, wie Domain,
              Google Search Console (GSC) Site-URL, Google Analytics 4 (GA4)
              Property ID sowie Semrush Projekt- und Tracking-IDs.
            </li>
            <li>
              <strong>Inhaltsdaten:</strong> Daten, die Sie im Rahmen des
              Redaktionsplans anlegen, wie Landingpage-URLs, Keywords und Status.
            </li>
            <li>
              <strong>Nutzungsdaten / Metadaten:</strong> Zum Zweck der
              Authentifizierung und Sitzungsverwaltung werden notwendige Cookies
              (Session-Cookies) von `next-auth` auf Ihrem Gerät gespeichert.
            </li>
            <li>
              <strong>Protokolldaten:</strong> Aktionen von Benutzern (z.B.
              Statusänderungen von Landingpages) werden zur Nachvollziehbarkeit
              protokolliert.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            3. Zweck und Rechtsgrundlage der Verarbeitung
          </h2>
          <p className="text-body mb-4">
            Die Verarbeitung Ihrer Daten dient folgenden Zwecken:
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 text-body">
            <li>
              <strong>Zurverfügungstellung des Dienstes:</strong> Um Ihnen den
              Login und die Nutzung der Dashboard-Funktionen zu ermöglichen
              (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO -
              Vertragserfüllung).
            </li>
            <li>
              <strong>Abruf von Drittanbieter-Daten:</strong> Die von Ihnen
              hinterlegten Konfigurationsdaten (GSC, GA4, Semrush IDs) werden
              ausschließlich dazu verwendet, Daten von den jeweiligen APIs
              (Google API, Semrush API) abzurufen und in diesem Dashboard
              darzustellen. Diese Daten werden zur Performance-Verbesserung
              zwischengespeichert.
            </li>
            <li>
              <strong>Benachrichtigungsfunktion:</strong> Um Administratoren und
              Benutzer per E-Mail (über den Dienst Brevo) und intern über
              Statusänderungen im Redaktionsplan zu informieren.
            </li>
            <li>
              <strong>Sicherheit und Administration:</strong> Zur Verwaltung von
              Benutzerkonten und Berechtigungen (Rechtsgrundlage: Art. 6 Abs. 1
              lit. f DSGVO - Berechtigtes Interesse an der Verwaltung des
              Dienstes).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            4. Empfänger der Daten / Drittanbieter
          </h2>
          <p className="text-body mb-4">
            Ihre Daten werden nur weitergegeben, wenn dies zur Erbringung des
            Dienstes technisch notwendig ist.
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 text-body">
            <li>
              <strong>Vercel (Hosting & Datenbank):</strong> Diese Webseite und
              die dazugehörige Datenbank (`@vercel/postgres`) werden bei Vercel
              Inc. (USA) gehostet. Vercel ist unter dem EU-U.S. Data Privacy
              Framework zertifiziert, wodurch ein angemessenes
              Datenschutzniveau sichergestellt wird.
            </li>
            <li>
              <strong>Brevo (E-Mail-Versand):</strong> Für den Versand von
              Systembenachrichtigungen (z.B. bei Statusänderungen) wird der
              Dienst Brevo (ehemals Sendinblue) genutzt. Hierzu wird Ihre
              E-Mail-Adresse sowie der Inhalt der Benachrichtigung an Brevo
              übermittelt.
            </li>
            <li>
              <strong>Google APIs & Semrush API:</strong> Ihre API-Schlüssel und
              Konfigurations-IDs werden verwendet, um Anfragen an die Server von
              Google (USA) und Semrush (USA) zu senden, um die Dashboard-Daten
              abzurufen. Es werden keine personenbezogenen Daten *an* diese
              Dienste gesendet, sondern nur Daten *von* diesen abgerufen.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            5. Cookies
          </h2>
          <p className="text-body">
            Diese Website verwendet `next-auth` für die Authentifizierung.
            `next-auth` setzt technisch notwendige Cookies (Session-Cookies), um
            Ihre Sitzung aufrechtzuerhalten und Sie als eingeloggten Benutzer zu
            erkennen. Diese Cookies sind für die Funktion des Dashboards zwingend
            erforderlich (Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO). Es findet
            kein darüber hinausgehendes Tracking statt.
          </p>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            6. Speicherdauer
          </h2>
          <p className="text-body">
            Ihre Bestands- und Konfigurationsdaten werden gespeichert, solange
            Ihr Benutzerkonto für das &quot;Data Peak&quot; Dashboard besteht. Daten in
            Caches (z.B. Google-Daten) werden periodisch, spätestens nach 48
            Stunden, erneuert. Protokolldaten werden aus administrativen Gründen
            für einen begrenzten Zeitraum aufbewahrt.
          </p>
        </section>

        <section>
          <h2 className="text-[23px] font-semibold tracking-[-0.015em] text-heading mt-8 mb-3">
            7. Ihre Rechte
          </h2>
          <p className="text-body">
            Ihnen stehen grundsätzlich die Rechte auf Auskunft, Berichtigung,
            Löschung, Einschränkung, Datenübertragbarkeit, Widerruf und
            Widerspruch zu. Wenn Sie glauben, dass die Verarbeitung Ihrer Daten
            gegen das Datenschutzrecht verstößt, können Sie sich bei mir
            (Kontaktdaten siehe oben) oder bei der Datenschutzbehörde (in
            Österreich: dsb.gv.at) beschweren.
          </p>
        </section>

        <p className="text-[14px] text-muted mt-8">Stand: 03. November 2025</p>
      </div>
    </div>
  );
}
