export type ContentType = 'landingpage' | 'article';
export type ContentMode = 'new' | 'optimize';
export type ContentDateRange = '30d' | '3m' | '6m';
export type ContentBrandMode = 'with-brand' | 'without-brand';

export interface ContentBrief {
  projectId: string;
  contentType: ContentType;
  mode: ContentMode;
  targetUrl: string;
  topic: string;
  region: string;
  targetAudience: string;
  conversionGoal: string;
  brandMode: ContentBrandMode;
  tone: 'professional' | 'approachable' | 'technical';
  facts: string;
  dateRange: ContentDateRange;
}

export interface ContentKeywordMetric {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

export interface ContentPageMetrics {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  sessions: number;
  newUsers: number;
  conversions: number;
  engagementRate: number | null;
}

export interface ExistingPageSnapshot {
  reachable: boolean;
  title: string;
  description: string;
  h1: string;
  headings: string[];
  wordCount: number;
  canonical: string | null;
  internalLinks: Array<{ anchor: string; url: string }>;
  textExcerpt: string;
  error?: string;
}

export interface InternalLinkCandidate {
  url: string;
  path: string;
  label: string;
  clicks: number;
  impressions: number;
  position: number | null;
  relevance: number;
  reason: string;
}

export interface ContentContext {
  project: {
    id: string;
    domain: string;
    brandKeywords: string[];
  };
  targetUrl: string;
  targetPath: string;
  dataSources: string[];
  keywords: ContentKeywordMetric[];
  metrics: ContentPageMetrics;
  existingPage: ExistingPageSnapshot | null;
  sitemap: {
    totalUrls: number;
    indexedUrls: number;
    internalLinkCandidates: InternalLinkCandidate[];
  };
  cannibalizationCandidates: InternalLinkCandidate[];
  notes: string[];
}

export interface ContentOutlineSection {
  id: string;
  level: 2 | 3;
  title: string;
  purpose: string;
}

export interface ContentOutline {
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  metaTitle: string;
  metaDescription: string;
  sections: ContentOutlineSection[];
  faq: string[];
}

export interface ContentQualityCheck {
  key: string;
  label: string;
  passed: boolean;
  value: string;
}
