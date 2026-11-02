import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum | Data Peak',
  description: 'Impressum und Anbieterkennzeichnung für das Data Peak Dashboard.',
};

export default function ImpressumPage() {
  return (
    <div className="bg-surface py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-6">
        <h1 className="text-3xl font-bold text-heading">Impressum</h1>

        <section>
          <h2 className="text-xl font-semibold text-heading mb-2">
            Medieninhaber und für den Inhalt verantwortlich:
          </h2>
          <p className="text-body">
            Michael Kanda
            <br />
            Schlachthammerstraße 86/6
            <br />
            1220 Wien, Österreich
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-heading mb-2">
            Kontakt:
          </h2>
          <p className="text-body">
            Telefon: +43 664 94 60 890
            <br />
            E-Mail: michael@designare.at
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-heading mb-2">
            Grundlegende Richtung der Webseite (&quot;Blattlinie&quot;):
          </h2>
          <p className="text-body">
            Diese Webseite stellt das &quot;Data Peak&quot; Dashboard, ein privates
            Projekt zur Analyse und Visualisierung von SEO- und Web-Kennzahlen,
            für registrierte Benutzer bereit.
          </p>
        </section>

        <section className="border-t pt-6 mt-8">
          <h2 className="text-2xl font-bold text-heading mb-4">
            Disclaimer & Nutzungsbedingungen
          </h2>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            1. Abgrenzung zum Arbeitgeber
          </h3>
          <p className="text-body">
            Die Webseite &quot;Data Peak&quot; und das darauf angebotene Dashboard sind
            rein private Entwicklungen von Michael Kanda. Sie stehen in keinerlei
            Verbindung zum Unternehmen maxonline Marketing hfw GesmbH, meinem
            Arbeitgeber. Alle hier dargestellten Inhalte, Tools und Meinungen
            sind ausschließlich meine eigenen.
          </p>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            2. Haftung für Inhalte
          </h3>
          <p className="text-body">
            Die Inhalte dieser Webseite wurden mit größter Sorgfalt erstellt; für
            die Richtigkeit, Vollständigkeit oder Aktualität der Daten
            (insbesondere der von Drittanbietern wie Google oder Semrush
            bezogenen Daten) übernehme ich jedoch keine Gewähr.
          </p>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            3. Haftung für Links
          </h3>
          <p className="text-body">
            Diese Webseite enthält Links zu externen Websites Dritter (z.B. zu
            den Domains der verwalteten Projekte), auf deren Inhalte ich keinen
            Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der
            jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            4. Urheberrecht
          </h3>
          <p className="text-body">
            Alle Inhalte, Werke und insbesondere der Quellcode dieses Dashboards
            unterliegen dem österreichischen Urheberrecht. Eine Nutzung,
            Vervielfältigung, Bearbeitung oder Verbreitung ist nur mit meiner
            schriftlichen Zustimmung erlaubt.
          </p>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            5. Nutzung des Dienstes
          </h3>
          <p className="text-body">
            Das &quot;Data Peak&quot; Dashboard ist ein unentgeltlicher Dienst für
            registrierte Benutzer. Der Dienst wird &quot;wie er ist&quot; (&quot;as is&quot;) ohne
            jegliche Garantie für Verfügbarkeit oder fehlerfreie Funktion zur
            Verfügung gestellt. Es besteht kein Anspruch auf Nutzung oder
            ununterbrochene Verfügbarkeit.
          </p>

          <h3 className="text-lg font-semibold text-heading mt-4 mb-2">
            6. Schlussbestimmung
          </h3>
          <p className="text-body">
            Sollten einzelne Bestimmungen dieses Textes unwirksam sein oder
            werden, so berührt dies die Wirksamkeit der übrigen Bestimmungen
            nicht.
          </p>
        </section>

        <p className="text-muted italic mt-8">Stand: 03. November 2025</p>
      </div>
    </div>
  );
}
