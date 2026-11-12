// src/lib/ai-traffic-v2/intent.ts
// Klassifizierer: ordnet Landingpage-Pfaden eine Intent-Kategorie zu

import type { IntentCategory } from './types';

// ============================================================================
// INTENT-KATEGORIEN (mit Lucide Icon-Namen statt Emojis)
// ============================================================================

export const INTENT_CATEGORIES: IntentCategory[] = [
  {
    key: 'informational',
    label: 'Informational',
    icon: 'book-open',
    color: '#3b82f6',
    patterns: [
      /\/blog\//i,
      /\/ratgeber\//i,
      /\/wissen\//i,
      /\/magazin\//i,
      /\/artikel\//i,
      /\/news\//i,
      /\/tipps\//i,
      /\/guide\//i,
      /\/tutorial\//i,
      /\/how-to\//i,
      /\/was-ist\//i,
      /\/erklaerung\//i,
      /\/faq/i,
      /\/glossar/i,
      /\/lexikon/i,
    ]
  },
  {
    key: 'transactional',
    label: 'Transaktional',
    icon: 'shopping-cart',
    color: '#10b981',
    patterns: [
      /\/preise/i,
      /\/pricing/i,
      /\/kosten/i,
      /\/angebot/i,
      /\/tarife/i,
      /\/pakete/i,
      /\/buchen/i,
      /\/bestellen/i,
      /\/kaufen/i,
      /\/shop/i,
      /\/warenkorb/i,
      /\/checkout/i,
      /\/produkt\//i,
      /\/products\//i,
    ]
  },
  {
    key: 'lead',
    label: 'Lead / Anfrage',
    icon: 'phone',
    color: '#f59e0b',
    patterns: [
      /\/kontakt/i,
      /\/contact/i,
      /\/anfrage/i,
      /\/termin/i,
      /\/beratung/i,
      /\/demo/i,
      /\/callback/i,
      /\/rueckruf/i,
      /\/formular/i,
      /\/anfragen/i,
      /\/get-started/i,
      /\/kostenlos-testen/i,
      /\/free-trial/i,
    ]
  },
  {
    key: 'navigational',
    label: 'Service / Leistung',
    icon: 'compass',
    color: '#8b5cf6',
    patterns: [
      /\/leistungen/i,
      /\/services/i,
      /\/loesungen/i,
      /\/solutions/i,
      /\/angebot\//i,
      /\/was-wir-tun/i,
      /\/bereiche/i,
      /\/branchen/i,
      /\/fuer-/i,
      /\/for-/i,
    ]
  },
  {
    key: 'brand',
    label: 'Brand / Vertrauen',
    icon: 'building-2',
    color: '#ec4899',
    patterns: [
      /\/ueber-uns/i,
      /\/about/i,
      /\/team/i,
      /\/referenzen/i,
      /\/kunden/i,
      /\/portfolio/i,
      /\/case-stud/i,
      /\/erfolge/i,
      /\/partner/i,
      /\/karriere/i,
      /\/jobs/i,
      /\/presse/i,
      /\/awards/i,
    ]
  },
  {
    key: 'legal',
    label: 'Rechtliches',
    icon: 'scale',
    color: '#6b7280',
    patterns: [
      /\/impressum/i,
      /\/datenschutz/i,
      /\/privacy/i,
      /\/agb/i,
      /\/terms/i,
      /\/legal/i,
      /\/widerruf/i,
      /\/cookie/i,
    ]
  }
];

// Default-Intent für nicht kategorisierbare Seiten
export const DEFAULT_INTENT: IntentCategory = {
  key: 'other',
  label: 'Sonstige',
  icon: 'file-text',
  color: '#9ca3af',
  patterns: []
};

// Homepage Intent
export const HOMEPAGE_INTENT: IntentCategory = {
  key: 'homepage',
  label: 'Homepage',
  icon: 'home',
  color: '#0ea5e9',
  patterns: []
};

// ============================================================================
// INTENT-ERKENNUNG
// ============================================================================

/**
 * Ermittelt die Intent-Kategorie für einen Pfad
 */
export function detectIntent(path: string): IntentCategory {
  if (path === '/' || path === '') {
    return HOMEPAGE_INTENT;
  }

  for (const category of INTENT_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(path)) {
        return category;
      }
    }
  }
  
  return DEFAULT_INTENT;
}
