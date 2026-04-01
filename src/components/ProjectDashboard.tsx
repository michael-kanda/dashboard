// src/components/ProjectDashboard.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Eye, EyeSlash } from 'react-bootstrap-icons'; 
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  ChartEntry,
  KpiDatum
} from '@/lib/dashboard-shared';

import TableauKpiGrid from '@/components/TableauKpiGrid';
import TableauPieChart from '@/components/charts/TableauPieChart';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import AiTrafficDetailWidgetV2 from '@/components/AiTrafficDetailWidgetV2';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LandingPageChart from '@/components/charts/LandingPageChart';
import { aggregateLandingPages } from '@/lib/utils';

// ✅ DataMax Chat Import
import { DataMaxChat } from '@/components/datamax';

// ✅ NEU: Google Ads Widget
import GoogleAdsWidget from '@/components/GoogleAdsWidget';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange?: (range: DateRangeOption) => void;
  projectId?: string;
  domain?: string;
  faviconUrl?: string | null;
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
  projectTimelineActive?: boolean;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  bingData?: any[];
  userRole?: string; 
  userEmail?: string; 
  showLandingPages?: boolean;
  showGoogleAds?: boolean;       // ← NEU
  dataMaxEnabled?: boolean;
}

function safeKpi(kpi?: KpiDatum) {
  return kpi || { value: 0, change: 0 };
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange, 
  projectId,
  domain,
  faviconUrl,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  userRole = 'USER', 
  userEmail = '', 
  showLandingPages = false,
  showGoogleAds = false,          // ← NEU
  dataMaxEnabled = true,
}: ProjectDashboardProps) {
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [isLandingPagesVisible, setIsLandingPagesVisible] = useState(showLandingPages);
  const [isGoogleAdsVisible, setIsGoogleAdsVisible] = useState(showGoogleAds);  // ← NEU
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAiTrafficDetail, setShowAiTrafficDetail] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setIsUpdating(false);
  }, [dateRange, data, isLoading]);

  const apiErrors = data.apiErrors;
  const kpis = data.kpis;

  const extendedKpis = kpis ? {
    clicks: safeKpi(kpis.clicks),
    impressions: safeKpi(kpis.impressions),
    sessions: safeKpi(kpis.sessions),
    totalUsers: safeKpi(kpis.totalUsers),
    conversions: safeKpi(kpis.conversions),
    engagementRate: safeKpi(kpis.engagementRate),
    bounceRate: safeKpi(kpis.bounceRate),
    newUsers: safeKpi(kpis.newUsers),
    avgEngagementTime: safeKpi(kpis.avgEngagementTime),
  } : undefined;

  const allChartData = {
    ...(data.charts || {}),
    aiTraffic: (data.aiTraffic?.trend ?? []).map(item => ({
      date: item.date,
      value: (item as any).value ?? (item as any).sessions ?? 0
    }))
  };

  const cleanLandingPages = useMemo(() => {
    return aggregateLandingPages(data.topConvertingPages || []);
  }, [data.topConvertingPages]);

  const exportKpis = useMemo(() => {
    if (!extendedKpis) return [];
    
    return [
      { label: 'Impressionen', value: extendedKpis.impressions.value.toLocaleString('de-DE'), change: extendedKpis.impressions.change },
      { label: 'Klicks', value: extendedKpis.clicks.value.toLocaleString('de-DE'), change: extendedKpis.clicks.change },
      { label: 'Nutzer', value: extendedKpis.totalUsers.value.toLocaleString('de-DE'), change: extendedKpis.totalUsers.change },
      { label: 'Sitzungen', value: extendedKpis.sessions.value.toLocaleString('de-DE'), change: extendedKpis.sessions.change },
      { label: 'Engagement', value: extendedKpis.engagementRate.value.toFixed(1), change: extendedKpis.engagementRate.change, unit: '%' },
      { label: 'Conversions', value: extendedKpis.conversions.value.toLocaleString('de-DE'), change: extendedKpis.conversions.change },
      { label: 'KI-Traffic', value: (data.aiTraffic?.totalUsers || 0).toLocaleString('de-DE'), change: data.aiTraffic?.totalUsersChange || 0 }, 
      { label: 'Ø Zeit', value: extendedKpis.avgEngagementTime.value.toLocaleString('de-DE'), change: extendedKpis.avgEngagementTime.change },
    ];
  }, [extendedKpis, data.aiTraffic]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    if (range === dateRange) return;
    setIsUpdating(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`${pathname}?${params.toString()}`);
    if (onDateRangeChange) onDateRangeChange(range);
  };

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const shouldRenderChart = isAdmin || isLandingPagesVisible;
  const hasSemrushConfig = !!semrushTrackingId || !!semrushTrackingId02;
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const safeApiErrors = (apiErrors as any) || {};

  const hasAiTraffic = (data.aiTraffic?.totalSessions ?? 0) > 0;

  // ✅ NEU: Google Ads Prüfung
  const hasGoogleAdsData = (data.googleAdsData?.rows?.length ?? 0) > 0;
  const shouldRenderGoogleAds = hasGoogleAdsData && (isAdmin || isGoogleAdsVisible);

  return (
    <div className="min-h-screen flex flex-col dashboard-gradient relative">
      
      {/* Lightbox Spinner */}
      {isUpdating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
           <div className="bg-surface p-8 rounded-3xl shadow-2xl border border-theme-border-subtle flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
              <div className="relative w-full flex justify-center">
                 <Image 
                   src="/data-max-arbeitet.webp" 
                   alt="Data Max arbeitet" 
                   width={400} 
                   height={400}
                   className="h-[200px] w-auto object-contain"
                   priority
                 />
              </div>
              <div>
                <h3 className="text-xl font-bold text-strong mb-1">Daten werden aktualisiert</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Rufe aktuelle Metriken von Google & Semrush ab...
                </p>
              </div>
              <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
              </div>
           </div>
        </div>
      )}
      
      <div className="flex-grow w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <GlobalHeader 
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          userRole={userRole}
          userEmail={userEmail}
        />
        
        {projectId && projectTimelineActive && (
          <div className="mb-6 print-timeline">
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* AI WIDGET */}
        {projectId && (
          <div id="section-ai-analyse" className="mt-8 scroll-mt-20 print:hidden">
            <AiAnalysisWidget 
              projectId={projectId}
              domain={domain}
              dateRange={dateRange}
              chartRef={chartRef}
              kpis={exportKpis}
            />
          </div>
        )}

        {/* KPI GRID */}
        <div id="section-kpis" className="mt-8 scroll-mt-20 print-kpi-grid">
          {extendedKpis && (
            <TableauKpiGrid
              kpis={extendedKpis}
              isLoading={isLoading} 
              allChartData={data.charts as any} 
              apiErrors={safeApiErrors}
              dateRange={dateRange} 
            />
          )}
        </div>

        <div id="section-verlauf" className="mt-8 scroll-mt-20 print-trend-chart" ref={chartRef}>
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={allChartData}
            weatherData={data.weatherData}
          />
        </div>
        
        {/* KI-Traffic Sektion mit Toggle für Detail-Ansicht */}
        <div id="section-ki-traffic" className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8 scroll-mt-20 print-traffic-grid">
          <div className="xl:col-span-1 print-ai-card">
            <AiTrafficCard 
              totalSessions={data.aiTraffic?.totalSessions ?? 0}
              totalUsers={data.aiTraffic?.totalUsers ?? 0}
              percentage={data.kpis?.sessions?.value ? ((data.aiTraffic?.totalSessions ?? 0) / data.kpis.sessions.value * 100) : 0}
              totalSessionsChange={data.aiTraffic?.totalSessionsChange}
              totalUsersChange={data.aiTraffic?.totalUsersChange}
              trend={(data.aiTraffic?.trend ?? []).map(item => ({
                date: item.date,
                value: (item as any).value ?? (item as any).sessions ?? 0
              }))}
              topAiSources={data.aiTraffic?.topAiSources ?? []}
              className="h-full"
              isLoading={isLoading}
              dateRange={dateRange}
              error={safeApiErrors?.ga4}
              onDetailClick={() => setShowAiTrafficDetail(!showAiTrafficDetail)}
            />
          </div>
          
          <div className="xl:col-span-2 print-queries-list">
            <TopQueriesList 
              queries={data.topQueries ?? []} 
              isLoading={isLoading}
              className="h-full"
              dateRange={dateRange}
              error={safeApiErrors?.gsc}
            />
          </div>
        </div>

        {/* KI-Traffic Detail-Ansicht (ausklappbar) */}
        {showAiTrafficDetail && hasAiTraffic && (
          <div className="mt-8 animate-in slide-in-from-top-4 duration-300 print:hidden">
            <AiTrafficDetailWidgetV2 
              projectId={projectId}
              dateRange={dateRange}
            />
          </div>
        )}

        {shouldRenderChart && (
          <div id="section-landingpages" className={`mt-8 scroll-mt-20 transition-all duration-300 ${!isLandingPagesVisible && isAdmin ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            {isAdmin && (
               <div className="flex items-center justify-end mb-2 print:hidden">
                 <button 
                    onClick={() => setIsLandingPagesVisible(!isLandingPagesVisible)}
                    className="flex items-center gap-2 text-xs font-medium text-muted hover:text-strong transition-colors"
                 >
                    {isLandingPagesVisible ? <EyeSlash size={14}/> : <Eye size={14}/>}
                    {isLandingPagesVisible ? 'Für Kunden verbergen' : 'Für Kunden sichtbar machen'}
                 </button>
               </div>
            )}
            <div className="print-landing-chart relative">
               <LandingPageChart 
                 data={cleanLandingPages} 
                 isLoading={isLoading}
                 title="Top Landingpages"
                 dateRange={dateRange}
                 queryData={data.landingPageQueries}
                 projectId={projectId}
               />
               {!isLandingPagesVisible && isAdmin && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="overlay-muted-badge backdrop-blur-[1px] px-4 py-2 rounded-lg border text-strong text-xs font-semibold shadow-sm">
                     🚫 Für Kunden ausgeblendet
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PIE CHARTS */}
        <div id="section-zugriffe" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 scroll-mt-20 print-pie-grid">
          <TableauPieChart 
            data={data.channelData} 
            title="Zugriffe nach Channel" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
          <TableauPieChart 
            data={data.countryData} 
            title="Zugriffe nach Land" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
          <TableauPieChart 
            data={data.deviceData} 
            title="Zugriffe nach Endgerät" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
        </div>

        {/* ✅ NEU: GOOGLE ADS SEKTION */}
        {shouldRenderGoogleAds && (
          <div id="section-google-ads" className={`mt-8 scroll-mt-20 transition-all duration-300 ${!isGoogleAdsVisible && isAdmin ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            {isAdmin && (
              <div className="flex items-center justify-end mb-2 print:hidden">
                <button
                  onClick={() => setIsGoogleAdsVisible(!isGoogleAdsVisible)}
                  className="flex items-center gap-2 text-xs font-medium text-muted hover:text-strong transition-colors"
                >
                  {isGoogleAdsVisible ? <EyeSlash size={14} /> : <Eye size={14} />}
                  {isGoogleAdsVisible ? 'Für Kunden verbergen' : 'Für Kunden sichtbar machen'}
                </button>
              </div>
            )}
            <div className="relative">
              <GoogleAdsWidget
                data={data.googleAdsData!}
                isLoading={isLoading}
                dateRange={dateRange}
              />
              {!isGoogleAdsVisible && isAdmin && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="overlay-muted-badge backdrop-blur-[1px] px-4 py-2 rounded-lg border text-strong text-xs font-semibold shadow-sm">
                    🚫 Für Kunden ausgeblendet
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {hasSemrushConfig && (
          <div id="section-semrush" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 scroll-mt-20 print-semrush-grid">
            {hasKampagne1Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords projectId={projectId} /></div>}
            {hasKampagne2Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords02 projectId={projectId} /></div>}
          </div>
        )}

      </div>

      {/* DataMax Chat - Floating Button unten rechts (Conditional) */}
      {dataMaxEnabled && (
        <DataMaxChat projectId={projectId} dateRange={dateRange} />
      )}

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
