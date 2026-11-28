import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { latLngToAustriaMapUnits } from '../../src/lib/austria-map-projection.ts';

type Ring = [number, number][];
const geo = JSON.parse(readFileSync(new URL('../../src/data/austria-bundeslaender.json', import.meta.url), 'utf8')) as {
  features: { properties: { name: string }; geometry: { type: string; coordinates: unknown } }[];
};

function rings(coordinates: unknown, out: Ring[] = []): Ring[] {
  const c = coordinates as unknown[];
  if (Array.isArray(c[0]) && typeof (c[0] as unknown[])[0] === 'number') {
    out.push(c as Ring);
    return out;
  }
  c.forEach((entry) => rings(entry, out));
  return out;
}

// Punkt-in-Polygon (gerade/ungerade Kreuzungen) über alle Ringe eines Bundeslands
function inside(stateName: string, [x, y]: [number, number]) {
  const feature = geo.features.find((f) => f.properties.name === stateName);
  assert.ok(feature, stateName);
  let crossings = 0;
  for (const ring of rings(feature.geometry.coordinates)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings++;
    }
  }
  return crossings % 2 === 1;
}

test('cities land in their federal state on the Austria map', () => {
  const cities: [string, number, number, string][] = [
    ['Wien', 48.2082, 16.3738, 'Wien'],
    ['Linz', 48.3069, 14.2858, 'Oberösterreich'],
    ['Graz', 47.0707, 15.4395, 'Steiermark'],
    ['Salzburg', 47.8095, 13.055, 'Salzburg'],
    ['Innsbruck', 47.2692, 11.4041, 'Tirol'],
    ['Klagenfurt', 46.6247, 14.3053, 'Kärnten'],
  ];
  for (const [city, lat, lng, state] of cities) {
    assert.ok(inside(state, latLngToAustriaMapUnits(lat, lng)), `${city} liegt nicht in ${state}`);
  }
});
