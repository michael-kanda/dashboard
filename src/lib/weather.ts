// src/lib/weather.ts

// =============================================
// TLD → Koordinaten Mapping (erweiterbar)
// =============================================
const TLD_COORDINATES: Record<string, { lat: number; lng: number; label: string }> = {
  at: { lat: 48.2082, lng: 16.3738, label: 'Wien' },
  de: { lat: 52.52, lng: 13.405, label: 'Berlin' },
};

const DEFAULT_COORDS = TLD_COORDINATES['de']; // Fallback

// =============================================
// WMO Weather Codes → Einfache Kategorien
// https://open-meteo.com/en/docs#weathervariables
// =============================================
export type WeatherIcon = 'sun' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm';

const WMO_TO_ICON: Record<number, WeatherIcon> = {
  0: 'sun',              // Clear sky
  1: 'sun',              // Mainly clear
  2: 'partly-cloudy',    // Partly cloudy
  3: 'cloudy',           // Overcast
  45: 'fog',             // Fog
  48: 'fog',             // Depositing rime fog
  51: 'rain',            // Light drizzle
  53: 'rain',            // Moderate drizzle
  55: 'rain',            // Dense drizzle
  56: 'rain',            // Light freezing drizzle
  57: 'rain',            // Dense freezing drizzle
  61: 'rain',            // Slight rain
  63: 'rain',            // Moderate rain
  65: 'rain',            // Heavy rain
  66: 'rain',            // Light freezing rain
  67: 'rain',            // Heavy freezing rain
  71: 'snow',            // Slight snow
  73: 'snow',            // Moderate snow
  75: 'snow',            // Heavy snow
  77: 'snow',            // Snow grains
  80: 'rain',            // Slight rain showers
  81: 'rain',            // Moderate rain showers
  82: 'rain',            // Violent rain showers
  85: 'snow',            // Slight snow showers
  86: 'snow',            // Heavy snow showers
  95: 'thunderstorm',    // Thunderstorm
  96: 'thunderstorm',    // Thunderstorm w/ slight hail
  99: 'thunderstorm',    // Thunderstorm w/ heavy hail
};

// Emoji-Mapping für Tooltip-Anzeige
export const WEATHER_EMOJI: Record<WeatherIcon, string> = {
  'sun': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'fog': '🌫️',
  'rain': '🌧️',
  'snow': '🌨️',
  'thunderstorm': '⛈️',
};

export const WEATHER_LABEL_DE: Record<WeatherIcon, string> = {
  'sun': 'Sonnig',
  'partly-cloudy': 'Teilw. bewölkt',
  'cloudy': 'Bewölkt',
  'fog': 'Nebel',
  'rain': 'Regen',
  'snow': 'Schnee',
  'thunderstorm': 'Gewitter',
};

// =============================================
// Datenstruktur pro Tag
// =============================================
export interface DailyWeather {
  icon: WeatherIcon;
  emoji: string;
  label: string;
  tempMax: number;  // °C
  tempMin: number;  // °C
}

// =============================================
// Koordinaten aus Domain-TLD extrahieren
// =============================================
export function getCoordinatesFromDomain(domain?: string | null) {
  if (!domain) return DEFAULT_COORDS;

  // TLD extrahieren: "example.at" → "at", "sub.example.de" → "de"
  const parts = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('.');
  const tld = parts[parts.length - 1]?.toLowerCase();

  return TLD_COORDINATES[tld] || DEFAULT_COORDS;
}

// =============================================
// Open-Meteo Historical Weather API
// =============================================
export async function fetchWeatherData(
  domain: string | undefined | null,
  startDate: string,
  endDate: string
): Promise<Map<string, DailyWeather>> {
  const map = new Map<string, DailyWeather>();
  const coords = getCoordinatesFromDomain(domain);

  try {
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', coords.lat.toString());
    url.searchParams.set('longitude', coords.lng.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
    url.searchParams.set('timezone', 'Europe/Berlin');

    const response = await fetch(url.toString(), { 
      next: { revalidate: 86400 } // 24h Cache auf Fetch-Ebene
    });

    if (!response.ok) {
      console.warn(`[Weather] API Fehler: ${response.status} ${response.statusText}`);
      return map;
    }

    const data = await response.json();
    const daily = data?.daily;

    if (!daily?.time || !daily?.weather_code) {
      console.warn('[Weather] Unerwartetes API-Format');
      return map;
    }

    for (let i = 0; i < daily.time.length; i++) {
      const dateStr = daily.time[i];
      const wmoCode = daily.weather_code[i];
      const tempMax = daily.temperature_2m_max?.[i] ?? null;
      const tempMin = daily.temperature_2m_min?.[i] ?? null;

      if (dateStr == null || wmoCode == null) continue;

      const icon: WeatherIcon = WMO_TO_ICON[wmoCode] ?? 'cloudy';

      map.set(dateStr, {
        icon,
        emoji: WEATHER_EMOJI[icon],
        label: WEATHER_LABEL_DE[icon],
        tempMax: tempMax !== null ? Math.round(tempMax) : 0,
        tempMin: tempMin !== null ? Math.round(tempMin) : 0,
      });
    }

    console.log(`[Weather] ✅ ${map.size} Tage geladen (${coords.label})`);
  } catch (error) {
    console.warn('[Weather] Fetch fehlgeschlagen (ignoriert):', error);
  }

  return map;
}

/**
 * Konvertiert die Map zu einem serialisierbaren Objekt für JSON-Cache.
 */
export function weatherMapToObject(map: Map<string, DailyWeather>): Record<string, DailyWeather> {
  const obj: Record<string, DailyWeather> = {};
  map.forEach((val, key) => { obj[key] = val; });
  return obj;
}
