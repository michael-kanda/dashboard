/* src/components/pdf/AnalysisReport.tsx */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format, subDays, subMonths } from 'date-fns';

// Fonts laden
// Schrift liegt selbst gehostet unter public/fonts/poppins (OFL-1.1, aus @fontsource/poppins),
// damit beim PDF-Export keine Anfrage samt IP-Adresse an ein CDN geht.
const fontBase = typeof window !== 'undefined' ? window.location.origin : '';
Font.register({
  family: 'Poppins',
  fonts: [
    { src: `${fontBase}/fonts/poppins/poppins-latin-400-normal.woff`, fontWeight: 400 },
    { src: `${fontBase}/fonts/poppins/poppins-latin-700-normal.woff`, fontWeight: 700 },
    { src: `${fontBase}/fonts/poppins/poppins-latin-400-italic.woff`, fontStyle: 'italic' }
  ]
});

const PRIMARY_COLOR = '#188BDB'; 
const ACCENT_BG = '#e0f2fe';     

const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 80, 
    fontFamily: 'Poppins',
    fontSize: 10, 
    color: '#333',
    backgroundColor: '#ffffff'
  },
  header: { 
    marginBottom: 20, 
    borderBottom: `2px solid ${PRIMARY_COLOR}`, 
    paddingBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
    objectFit: 'contain'
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#6b7280', fontWeight: 'bold' },
  metaContainer: { alignItems: 'flex-end' },
  meta: { fontSize: 9, color: '#6b7280', marginBottom: 2 },
  
  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 25, gap: 10 },
  kpiCard: { width: '23%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 },
  kpiLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 'bold' },
  kpiValue: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  kpiChange: { fontSize: 9, fontWeight: 'bold' },
  kpiChangePositive: { color: '#16a34a' },
  kpiChangeNegative: { color: '#dc2626' },
  
  // Section Styles
  section: { marginBottom: 15 },
  sectionTitle: { 
    fontSize: 14, fontWeight: 'bold', color: PRIMARY_COLOR, 
    marginBottom: 12, paddingBottom: 4, borderBottom: '1px solid #f1f5f9' 
  },
  
  // Text-Block Styles
  blockHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: '#111827',
    marginTop: 14,  
    marginBottom: 6 
  },
  blockParagraph: {
    fontSize: 10,
    lineHeight: 1.4,
    color: '#334155',
    marginBottom: 8,
    textAlign: 'left'
  },
  
  // Listen Styles
  listContainer: {
    marginTop: 4,
    marginBottom: 8
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 3
  },
  bullet: {
    width: 10,
    fontSize: 10,
    color: PRIMARY_COLOR,
    marginTop: 2 
  },
  listContent: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
    color: '#334155'
  },

  note: {
    marginTop: 20, padding: 15, backgroundColor: ACCENT_BG,
    borderLeft: `3px solid ${PRIMARY_COLOR}`, borderRadius: 4
  },
  noteText: { fontSize: 9, color: '#0c4a6e', fontStyle: 'italic' },
  
  footer: { 
    position: 'absolute', bottom: 30, left: 40, right: 40, 
    borderTop: '1px solid #e2e8f0', paddingTop: 10, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
  },
  footerText: { fontSize: 8, color: '#94a3b8' },
  footerBrand: { fontSize: 9, fontWeight: 'bold', color: PRIMARY_COLOR }
});

interface KpiData {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
}

interface ReportProps {
  projectId: string;
  domain?: string;
  dateRange: string;
  summaryText: string;
  kpis?: KpiData[];
  baseUrl?: string; // ✅ NEU: BaseURL Prop für absolute Pfade
}

// --- Helper: Datumsbereich formatieren ---
const formatDateRangeText = (range: string): string => {
  const today = new Date();
  let start = today;
  
  switch (range) {
    case '30d': start = subDays(today, 30); break;
    case '3m': start = subMonths(today, 3); break;
    case '6m': start = subMonths(today, 6); break;
    case '12m': start = subMonths(today, 12); break;
    default: 
      if (range === '7d') start = subDays(today, 7);
      else return range; 
  }

  return `${format(start, 'dd.MM.')} - ${format(today, 'dd.MM.yyyy')}`;
};

// --- PARSER LOGIK ---
type Block = 
  | { type: 'heading', content: string }
  | { type: 'paragraph', content: string }
  | { type: 'list', items: string[] };

const parseContentToBlocks = (html: string): Block[] => {
  const blocks: Block[] = [];
  const cleanHtml = html.replace(/\r\n/g, '\n');
  const regex = /<(h[1-6]|p|ul)[^>]*>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(cleanHtml)) !== null) {
    if (match.index > lastIndex) {
      const rawText = cleanHtml.substring(lastIndex, match.index).trim();
      if (rawText) blocks.push({ type: 'paragraph', content: stripTags(rawText) });
    }
    const tag = match[1].toLowerCase();
    const content = match[2];
    if (tag.startsWith('h')) blocks.push({ type: 'heading', content: stripTags(content) });
    else if (tag === 'p') blocks.push({ type: 'paragraph', content: stripTags(content) });
    else if (tag === 'ul') {
      const items: string[] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(content)) !== null) items.push(stripTags(liMatch[1]));
      if (items.length > 0) blocks.push({ type: 'list', items });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleanHtml.length) {
    const rawText = cleanHtml.substring(lastIndex).trim();
    if (rawText) blocks.push({ type: 'paragraph', content: stripTags(rawText) });
  }
  return blocks;
};

const stripTags = (str: string) => {
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/•/g, '') 
    .replace(/\s+/g, ' ')
    .trim();
};

const formatChange = (change?: number) => {
  if (change === undefined || change === null) return '';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

export const AnalysisReport = ({ 
  projectId,
  domain, 
  dateRange, 
  summaryText, 
  kpis,
  baseUrl = '' // ✅ Default leer
}: ReportProps) => {
  
  const contentBlocks = parseContentToBlocks(summaryText);
  const formattedDateRange = formatDateRangeText(dateRange);

  // ✅ LOGIK: Absolute URL erzwingen wenn baseUrl vorhanden
  // WICHTIG: Verwenden Sie hier .png oder .jpg, WebP macht oft Probleme!
  const imageSrc = baseUrl 
    ? `${baseUrl}/data-max-stolz.png` // Absoluter Pfad für Server
    : '/data-max-stolz.png';           // Relativer Pfad für Client (Fallback)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* ✅ Bild Integration */}
            <Image 
              src={imageSrc} 
              style={styles.logo} 
            />
            <View>
              <Text style={styles.title}>Performance Report</Text>
              <Text style={styles.subtitle}>{domain || projectId}</Text>
            </View>
          </View>
          
          <View style={styles.metaContainer}>
            <Text style={styles.meta}>Zeitraum: {formattedDateRange}</Text>
            <Text style={styles.meta}>Datum: {new Date().toLocaleDateString('de-DE')}</Text>
            <Text style={[styles.meta, { color: PRIMARY_COLOR, fontWeight: 'bold', marginTop: 4 }]}>
              DATA PEAK AI
            </Text>
          </View>
        </View>

        {/* KPI GRID */}
        {kpis && kpis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kennzahlen Übersicht</Text>
            <View style={styles.kpiGrid}>
              {kpis.map((kpi, index) => (
                <View key={index} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  <Text style={styles.kpiValue}>
                    {kpi.value}{kpi.unit || ''}
                  </Text>
                  {kpi.change !== undefined && (
                    <Text style={[
                      styles.kpiChange,
                      kpi.change >= 0 ? styles.kpiChangePositive : styles.kpiChangeNegative
                    ]}>
                      {formatChange(kpi.change)} vs. Vorperiode
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* KI ANALYSE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KI-Analyse</Text>
          {contentBlocks.map((block, index) => {
            if (block.type === 'heading') {
              return <Text key={index} style={styles.blockHeading}>{block.content}</Text>;
            }
            if (block.type === 'paragraph') {
              return <Text key={index} style={styles.blockParagraph}>{block.content}</Text>;
            }
            if (block.type === 'list') {
              return (
                <View key={index} style={styles.listContainer}>
                  {block.items.map((item, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.listContent}>{item}</Text>
                    </View>
                  ))}
                </View>
              );
            }
            return null;
          })}
        </View>

        {/* HINWEIS */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Hinweis: Dieser Bericht ist eine Zusammenfassung. Detaillierte interaktive Charts finden Sie im Dashboard unter https://app.datapeak.at
          </Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Automatisch generiert durch Data Max AI
          </Text>
          <Text style={styles.footerBrand}>DATA PEAK</Text>
        </View>
      </Page>
    </Document>
  );
};
