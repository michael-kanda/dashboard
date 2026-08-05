import type { DateRangeOption } from '@/components/DateRangeSelector';
import type {
  ChartEntry,
  ProjectDashboardData,
} from '@/lib/dashboard-shared';
import type { ProjectIndexingStatus } from '@/lib/indexing-status';
import type { DashboardWidgetVisibility } from '@/lib/dashboard-widget-visibility';

export interface ProjectDashboardProps {
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
  bingData?: unknown[];
  userRole?: string;
  userEmail?: string;
  userAnsprache?: string | null;
  showLandingPages?: boolean;
  showGoogleAds?: boolean;
  showPromptTracking?: boolean;
  widgetVisibility?: Partial<DashboardWidgetVisibility> | null;
  dashboardInfoText?: string | null;
  dataMaxEnabled?: boolean;
  indexingStatus?: ProjectIndexingStatus;
}
