// src/lib/austria-map-projection.ts
// Rechnet Breiten- und Längengrad in die Koordinaten der Österreich-Karte um
// (src/data/austria-bundeslaender.json, Highcharts-Karte in EPSG:31255, Gauß-Krüger M31).
// Formel wie bei Highcharts: Transversale Mercator auf dem Bessel-Ellipsoid, dann
// Skalierung und Verschiebung aus „hc-transform“. Die Datumsverschiebung (towgs84, rund 100 m)
// fällt bei dieser Kartengröße nicht ins Gewicht und bleibt weg.

const BESSEL_A = 6377397.155;
const BESSEL_F = 1 / 299.1528128;
const E2 = 2 * BESSEL_F - BESSEL_F * BESSEL_F;
const EP2 = E2 / (1 - E2);
const LON0 = (13.33333333333333 * Math.PI) / 180;
const FALSE_NORTHING = -5000000;

// Werte aus "hc-transform"."default" der Kartendatei
const HC = {
  scale: 0.00122132554851,
  jsonres: 15.5,
  jsonmarginX: -999,
  jsonmarginY: 9851,
  xoffset: -288444.120202,
  yoffset: 431577.633379,
};

function meridianArc(phi: number) {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  return BESSEL_A * (
    (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi
    - ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi)
    + ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi)
    - ((35 * e6) / 3072) * Math.sin(6 * phi)
  );
}

/** Transversale Mercator (Snyder), Meter in EPSG:31255. */
function transverseMercator(lat: number, lng: number) {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const n = BESSEL_A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = EP2 * Math.cos(phi) ** 2;
  const a = (lambda - LON0) * Math.cos(phi);
  const x = n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120);
  const y = FALSE_NORTHING + meridianArc(phi) + n * Math.tan(phi) * (
    (a * a) / 2
    + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24
    + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720
  );
  return { x, y };
}

/** Punkt in den Einheiten der Kartendatei (x nach Osten, y nach Norden). */
export function latLngToAustriaMapUnits(lat: number, lng: number): [number, number] {
  const p = transverseMercator(lat, lng);
  return [
    (p.x - HC.xoffset) * HC.scale * HC.jsonres + HC.jsonmarginX,
    HC.jsonmarginY - (HC.yoffset - p.y) * HC.scale * HC.jsonres,
  ];
}
