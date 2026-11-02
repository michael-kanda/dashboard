// src/components/SemrushTopKeywords.tsx (Wrapper für Kampagne 1)
'use client';

import React from 'react';
import SemrushKeywordTableBase, { type SemrushTheme } from './SemrushKeywordTableBase';

// Definition des Farbschemas für Kampagne 1 (Österreich) - ORANGE
const themeKampagne1: SemrushTheme = {
  headerGradient: "",
  headerText: "text-orange-100",
  headerTextMuted: "text-orange-50 opacity-75",
  tableHeaderBg: "bg-orange-600",
  tableHeaderBorder: "border-orange-500",
  tableHeaderHover: "hover:bg-orange-700",
  tableRowHover: "hover:bg-warning-bg",
  // Hex-Farben für inline-styles
  tableHeaderBgColor: "#ea580c", // orange-600
  tableHeaderHoverColor: "#c2410c", // orange-700
};

interface SemrushTopKeywordsProps {
  projectId?: string | null;
}

export default function SemrushTopKeywords({ projectId }: SemrushTopKeywordsProps) {
  return (
    <SemrushKeywordTableBase
      projectId={projectId}
      campaign="kampagne_1"
      title="Keyword Tracking - Österreich"
      logContext="SemrushTopKeywords"
      errorContext="Kampagne 1"
      keyPrefix="kampagne-1"
      theme={themeKampagne1}
      debugInfo={{
        title: "Debug (Kampagne 1)",
        classes: "bg-accent-tint border-border"
      }}
    />
  );
}
