/* src/components/ExportButton.tsx */
'use client';

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { AnalysisReport } from '@/components/pdf/AnalysisReport';
import { FileEarmarkPdf } from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';

interface ExportButtonProps {
  chartRef?: React.RefObject<HTMLDivElement>;
  analysisText: string;
  projectId: string;
  domain?: string; // ✅ NEU
  dateRange: string;
  kpis?: Array<{
    label: string;
    value: string | number;
    change?: number;
    unit?: string;
  }>;
}

export default function ExportButton({ 
  analysisText, 
  projectId, 
  domain,
  dateRange,
  kpis
}: ExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!analysisText) return;
    setIsGenerating(true);

    try {
      const blob = await pdf(
        <AnalysisReport 
          projectId={projectId}
          domain={domain}
          dateRange={dateRange}
          summaryText={analysisText}
          kpis={kpis}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Dateiname auch angepasst
      link.download = `Report_${domain || projectId}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("PDF Export Fehler:", error);
      alert("Fehler beim Erstellen des PDFs.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!analysisText) return null;

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-accent bg-accent-solid/10 hover:bg-accent-solid/20 border border-accent/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="PDF Report herunterladen"
    >
      {isGenerating ? (
        <>
          <Spinner size={13} />
          <span>Erstelle PDF...</span>
        </>
      ) : (
        <>
          <FileEarmarkPdf size={14} />
          <span>Als PDF exportieren</span>
        </>
      )}
    </button>
  );
}
