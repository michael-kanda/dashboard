// src/components/SemrushTopKeywords02.tsx (Wrapper für Kampagne 2)
'use client';

import React from 'react';
import SemrushKeywordTableBase, { type SemrushTheme } from './SemrushKeywordTableBase';

// Definition des Farbschemas für Kampagne 2 (USA) - PURPLE
const themeKampagne2: SemrushTheme = {
  headerGradient: "",
  headerText: "text-purple-100",
  headerTextMuted: "text-purple-50 opacity-75",
  tableHeaderBg: "bg-purple-600",
  tableHeaderBorder: "border-purple-500",
  tableHeaderHover: "hover:bg-purple-700",
  tableRowHover: "hover:bg-accent-tint",
  // Hex-Farben für inline-styles
  tableHeaderBgColor: "#9333ea", // purple-600
  tableHeaderHoverColor: "#7e22ce", // purple-700
};

interface SemrushTopKeywords02Props {
  projectId?: string | null;
}

export default function SemrushTopKeywords02({ projectId }: SemrushTopKeywords02Props) {
  return (
    <SemrushKeywordTableBase
      projectId={projectId}
      campaign="kampagne_2"
      title="Keyword Tracking - USA"
      logContext="SemrushTopKeywords02"
      errorContext="Kampagne 2"
      keyPrefix="kampagne-2"
      theme={themeKampagne2}
      debugInfo={{
        title: "Debug (Kampagne 2)",
        classes: "bg-accent-tint border-border"
      }}
    />
  );
}
