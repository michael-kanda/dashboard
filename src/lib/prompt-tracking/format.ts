// src/lib/prompt-tracking/format.ts
//
// Reine Format-/Export-Helfer für die Prompt-Tracking-Card
// (ausgelagert aus src/components/PromptTrackingCard.tsx).

import type { PromptQueryData } from '@/lib/dashboard-shared';
import type { PromptClusterApiResponse } from '@/lib/prompt-cluster-schema';

export function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function buildMarkdown(result: PromptClusterApiResponse, allQueries: PromptQueryData[]): string {
  const { clusters, insights, meta } = result;
  const lines: string[] = [];
  lines.push(`# Prompt Cluster Briefing`);
  lines.push('');
  lines.push(`*Generiert am ${new Date(meta.generatedAt).toLocaleString('de-DE')} mit ${meta.model}*`);
  lines.push(`*Basis: ${meta.queriesAnalyzed} prompt-artige Suchanfragen*`);
  lines.push('');
  lines.push(`## 🔍 Gesamtbild`);
  lines.push('');
  lines.push(insights.summary);
  lines.push('');
  lines.push(`**Dominanter Intent:** ${insights.dominantIntent}`);
  lines.push('');
  lines.push(`**Top-Attribute:** ${insights.dominantAttributes.join(', ')}`);
  lines.push('');
  if (insights.contentGaps.length > 0) {
    lines.push(`## ✏️ Content-Lücken & Empfehlungen`);
    lines.push('');
    insights.contentGaps.forEach((gap) => lines.push(`- ${gap}`));
    lines.push('');
  }
  lines.push(`## 📚 Cluster im Detail`);
  lines.push('');
  clusters.forEach((cluster, idx) => {
    const queries = cluster.queryIndices.map((i) => allQueries[i]).filter((q): q is PromptQueryData => Boolean(q));
    lines.push(`### ${idx + 1}. ${cluster.theme}`);
    lines.push('');
    lines.push(`**Intent:** ${cluster.intent}  `);
    lines.push(`**Anzahl Queries:** ${queries.length}  `);
    lines.push(`**Top-Attribute:** ${cluster.topAttributes.join(', ')}`);
    lines.push('');
    lines.push(cluster.description);
    lines.push('');
    lines.push('**Beispiel-Queries (Top 10):**');
    lines.push('');
    queries.sort((a, b) => b.impressions - a.impressions).slice(0, 10).forEach((q) => {
      lines.push(`- _${q.query}_ (${q.impressions} Impr., ${q.clicks} Klicks)`);
    });
    lines.push('');
  });
  lines.push(`---`);
  lines.push(`*Methodik nach Seybold (2026): https://seybold.de/prompt-tracking-in-google-search-console/*`);
  return lines.join('\n');
}
