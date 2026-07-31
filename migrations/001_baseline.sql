CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BENUTZER')),
  mandant_id VARCHAR(255),
  ansprache VARCHAR(255),
  permissions TEXT[] DEFAULT '{}',
  domain VARCHAR(255),
  gsc_site_url VARCHAR(255),
  sitemap_url TEXT,
  ga4_property_id VARCHAR(255),
  semrush_project_id VARCHAR(255),
  semrush_tracking_id VARCHAR(255),
  semrush_tracking_id_02 VARCHAR(255),
  google_ads_sheet_id VARCHAR(255),
  favicon_url TEXT,
  brand_keywords TEXT[],
  dashboard_info_text TEXT,
  google_genai_manual_data JSONB,
  settings_show_landingpages BOOLEAN DEFAULT TRUE,
  settings_show_google_ads BOOLEAN DEFAULT FALSE,
  settings_show_prompt_tracking BOOLEAN DEFAULT FALSE,
  dashboard_widget_visibility JSONB DEFAULT '{}'::jsonb,
  project_locations JSONB DEFAULT '[]'::jsonb,
  project_start_date TIMESTAMPTZ,
  project_duration_months INTEGER DEFAULT 6,
  project_timeline_active BOOLEAN DEFAULT FALSE,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  data_max_enabled BOOLEAN DEFAULT FALSE,
  ki_tool_enabled BOOLEAN DEFAULT FALSE,
  last_admin_notification_sent TIMESTAMPTZ,
  "createdByAdminId" UUID REFERENCES users(id),
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ansprache VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sitemap_url TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_sheet_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS dashboard_info_text TEXT,
  ADD COLUMN IF NOT EXISTS google_genai_manual_data JSONB,
  ADD COLUMN IF NOT EXISTS settings_show_landingpages BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS settings_show_google_ads BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settings_show_prompt_tracking BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dashboard_widget_visibility JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_locations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS project_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_duration_months INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS project_timeline_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_max_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ki_tool_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_admin_notification_sent TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS landingpages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  haupt_keyword TEXT,
  weitere_keywords TEXT,
  suchvolumen INTEGER,
  aktuelle_position INTEGER,
  status VARCHAR(50) DEFAULT 'Offen',
  comment TEXT,
  gsc_klicks INTEGER,
  gsc_klicks_change INTEGER,
  gsc_impressionen INTEGER,
  gsc_impressionen_change INTEGER,
  gsc_position DECIMAL(7, 2),
  gsc_position_change DECIMAL(7, 2),
  gsc_last_updated TIMESTAMPTZ,
  gsc_last_range VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url, user_id)
);

ALTER TABLE landingpages
  ADD COLUMN IF NOT EXISTS suchvolumen INTEGER,
  ADD COLUMN IF NOT EXISTS aktuelle_position INTEGER,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS content_markdown TEXT,
  ADD COLUMN IF NOT EXISTS content_outline JSONB,
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS internal_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_brief JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
UPDATE landingpages SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS landingpage_logs (
  id SERIAL PRIMARY KEY,
  landingpage_id INTEGER NOT NULL REFERENCES landingpages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  related_landingpage_id INTEGER REFERENCES landingpages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS semrush_keywords_cache (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign VARCHAR(50) NOT NULL,
  keywords_data JSONB NOT NULL,
  last_fetched TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, campaign)
);

CREATE TABLE IF NOT EXISTS semrush_data_cache (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_fetched TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_data_cache (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_range VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  last_fetched TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, date_range)
);
ALTER TABLE google_data_cache ALTER COLUMN date_range TYPE VARCHAR(50);

CREATE TABLE IF NOT EXISTS project_data_sync_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source)
);

CREATE TABLE IF NOT EXISTS prompt_cluster_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_range VARCHAR(20) NOT NULL,
  queries_hash VARCHAR(64) NOT NULL,
  result JSONB NOT NULL,
  query_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_indexing_sync (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sitemap_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sitemap_fingerprint TEXT,
  sitemap_checked_at TIMESTAMPTZ,
  lock_until TIMESTAMPTZ,
  sitemap_entry_count INTEGER NOT NULL DEFAULT 0,
  excluded_url_count INTEGER NOT NULL DEFAULT 0,
  excluded_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  sync_warning TEXT,
  progress_stage VARCHAR(20) NOT NULL DEFAULT 'idle',
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_completed INTEGER NOT NULL DEFAULT 0,
  progress_due_total INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_indexing_urls (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_sitemap TEXT,
  sitemap_lastmod TIMESTAMPTZ,
  is_in_sitemap BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  verdict TEXT,
  coverage_state TEXT,
  robots_txt_state TEXT,
  indexing_state TEXT,
  page_fetch_state TEXT,
  google_canonical TEXT,
  user_canonical TEXT,
  last_crawl_time TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  next_inspection_at TIMESTAMPTZ,
  inspection_attempts INTEGER NOT NULL DEFAULT 0,
  change_detected_at TIMESTAMPTZ,
  inspection_error TEXT,
  clicks DOUBLE PRECISION NOT NULL DEFAULT 0,
  impressions DOUBLE PRECISION NOT NULL DEFAULT 0,
  ctr DOUBLE PRECISION NOT NULL DEFAULT 0,
  position DOUBLE PRECISION,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, url)
);

CREATE TABLE IF NOT EXISTS mandanten_logos (
  mandant_id VARCHAR(255) PRIMARY KEY,
  logo_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_range VARCHAR(50) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ki_tool_runs (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  tool VARCHAR(80) NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_sources TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  content_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_text TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gsc_daily_data (
  site_url TEXT NOT NULL,
  date DATE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_url, date)
);

CREATE TABLE IF NOT EXISTS ga4_ai_traffic_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ga4_quota_cooldown (
  property_id TEXT PRIMARY KEY,
  cooldown_until TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ga4_request_locks (
  lock_key TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landingpages_user_id ON landingpages(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_google_data_cache_user_id ON google_data_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_project_data_sync_due ON project_data_sync_state(source, next_sync_at, last_attempt_at);
CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_user_created ON prompt_cluster_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_hash ON prompt_cluster_history(user_id, queries_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_indexing_urls_project_status ON project_indexing_urls(user_id, status);
CREATE INDEX IF NOT EXISTS idx_indexing_urls_inspected ON project_indexing_urls(user_id, inspected_at);
CREATE INDEX IF NOT EXISTS idx_indexing_urls_due ON project_indexing_urls(user_id, next_inspection_at) WHERE is_in_sitemap = TRUE;
CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_analysis_cache(user_id, date_range, input_hash);
CREATE INDEX IF NOT EXISTS idx_ki_tool_runs_project_created ON ki_tool_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_site_date ON gsc_daily_data(site_url, date DESC);
