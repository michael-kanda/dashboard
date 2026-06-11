// src/components/AiTrafficDetailWidgetV2.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
// Wir nutzen hier den absoluten Pfad mit @, um sicherzustellen, dass die Datei gefunden wird
import AiTrafficDetailCardV2 from '@/components/AiTrafficDetailCardV2';
import type { AiTrafficExtendedData } from '@/lib/ai-traffic-extended-v2';

export interface AiTrafficDetailWidgetV2Props {
  projectId?: string;
  dateRange?: string;
  className?: string;
}

export default function AiTrafficDetailWidgetV2({
  projectId,
  dateRange = '30d',
  className
}: AiTrafficDetailWidgetV2Props) {
  const [data, setData] = useState<AiTrafficExtendedData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const params = new URLSearchParams({ dateRange });
      if (projectId) {
        params.set('projectId', projectId);
      }

      const url = `/api/ai-traffic-detail-v2?${params.toString()}`;
      console.log('[AiTrafficDetailWidgetV2] Fetching:', url);
      
      const response = await fetch(url);
      
      // Fehlerbehandlung für nicht-JSON Antworten (z.B. 404 oder 500 HTML Seiten)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         const text = await response.text();
         console.error('[AiTrafficDetailWidgetV2] Ungültige Antwort:', text.substring(0, 100));
         throw new Error(`Server lieferte kein JSON (Status: ${response.status})`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.data && (result.transient || result.quotaLimited)) {
        throw new Error(result.error || 'KI-Traffic-Daten werden gerade aktualisiert.');
      }

      console.log('[AiTrafficDetailWidgetV2] Data received:', result.data ? 'OK' : 'null');
      setData(result.data || undefined);
      
    } catch (err) {
      console.error('[AiTrafficDetailWidgetV2] Fetch Error:', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AiTrafficDetailCardV2
      data={data}
      isLoading={isLoading}
      dateRange={dateRange}
      error={error}
      onRefresh={fetchData}
      className={className}
    />
  );
}
