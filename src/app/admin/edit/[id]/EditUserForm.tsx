// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User, ProjectLocation } from '@/types';
import {
  DASHBOARD_WIDGET_DEFINITIONS,
  normalizeDashboardWidgetVisibility,
  type DashboardWidgetVisibility,
} from '@/lib/dashboard-widget-visibility';
import { 
  Pencil, 
  CheckCircle, 
  CalendarEvent, 
  ClockHistory,
  ToggleOn,
  ToggleOff,
  ConeStriped,         // NEU für Wartungsmodus
  ExclamationTriangle  // NEU für Warnung
} from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';
import { GA4_PROPERTY_ID_HINT, parseGa4PropertyId } from '@/lib/ga4-property-id';
import { normalizeGscSiteUrl } from '@/lib/gsc-site-url';
import GoogleConnectionCheck from '@/components/admin/GoogleConnectionCheck';
import { getPasswordError, MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

interface EditUserFormProps {
  user: User;
  onUserUpdated?: () => void;
  isSuperAdmin: boolean; 
}

const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch { 
    return '';
  }
};

interface ApiPayload {
  email: string;
  mandant_id: string | null;
  ansprache: string | null;
  permissions?: string[] | null; 
  domain: string | null;
  gsc_site_url: string | null;
  sitemap_url: string | null;
  ga4_property_id: string | null;
  favicon_url: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
  google_ads_sheet_id: string | null;
  project_start_date: string | null; 
  project_duration_months: number | null; 
  project_timeline_active: boolean;
  settings_show_landingpages: boolean;
  settings_show_google_ads: boolean;
  settings_show_prompt_tracking: boolean;
  dashboard_widget_visibility: DashboardWidgetVisibility;
  project_locations: ProjectLocation[];
  maintenance_mode: boolean; // NEU
  password?: string; 
}

const createEmptyLocation = (): ProjectLocation => ({
  id: `location-${Date.now()}`,
  name: '',
  postalCode: '',
  city: '',
  country: 'AT',
  lat: null,
  lng: null,
  mapX: null,
  mapY: null,
  googlePlaceId: null,
  googleBusinessProfileUrl: null,
  googleBusinessProfileImageUrl: null,
  landingPages: [],
  keywords: [],
});

function normalizeLocations(locations?: ProjectLocation[] | null): ProjectLocation[] {
  if (!Array.isArray(locations)) return [];
  return locations.map((location, index) => ({
    id: location.id || `location-${index + 1}`,
    name: location.name || '',
    postalCode: location.postalCode || '',
    city: location.city || '',
    country: location.country || 'AT',
    lat: typeof location.lat === 'number' ? location.lat : null,
    lng: typeof location.lng === 'number' ? location.lng : null,
    mapX: typeof location.mapX === 'number' ? location.mapX : null,
    mapY: typeof location.mapY === 'number' ? location.mapY : null,
    googlePlaceId: location.googlePlaceId || null,
    googleBusinessProfileUrl: location.googleBusinessProfileUrl || null,
    googleBusinessProfileImageUrl: location.googleBusinessProfileImageUrl || null,
    landingPages: Array.isArray(location.landingPages) ? location.landingPages : [],
    keywords: Array.isArray(location.keywords) ? location.keywords : [],
  }));
}

function listToCsv(items?: string[]) {
  return Array.isArray(items) ? items.join(', ') : '';
}

function csvToList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function extractGoogleSpreadsheetId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const sheetUrlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetUrlMatch?.[1]) return sheetUrlMatch[1];

  return trimmed;
}


export default function EditUserForm({ user, onUserUpdated, isSuperAdmin }: EditUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    mandantId: '',
    ansprache: '',
    permissions: '', 
    domain: '',
    gscSiteUrl: '',
    sitemapUrl: '',
    ga4PropertyId: '',
    semrushProjectId: '',
    semrushTrackingId: '',
    semrushTrackingId02: '',
    googleAdsSheetId: '',
    favicon_url: '',
    project_start_date: '',    
    project_duration_months: '6', 
    project_timeline_active: false,
    settings_show_landingpages: true,
    settings_show_google_ads: false,
    settings_show_prompt_tracking: false,
    maintenance_mode: false, // NEU
  });

  const [password, setPassword] = useState('');
  // Feld erst auf Klick zeigen: sonst trägt der Browser das gespeicherte Login-Passwort ein.
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>([]);
  const [widgetVisibility, setWidgetVisibility] = useState<DashboardWidgetVisibility>(
    normalizeDashboardWidgetVisibility(user.dashboard_widget_visibility, {
      landingPages: user.settings_show_landingpages,
      googleAds: user.settings_show_google_ads,
      promptTracking: user.settings_show_prompt_tracking,
    })
  );
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
      console.log('[EditUserForm] useEffect - user.project_timeline_active:', user.project_timeline_active);
      console.log('[EditUserForm] useEffect - user.maintenance_mode:', user.maintenance_mode);
      
      const newFormData = {
        email: user.email || '',
        mandantId: user.mandant_id || '',
        ansprache: user.ansprache || '',
        permissions: user.permissions?.join(', ') || '',
        domain: user.domain || '',
        gscSiteUrl: user.gsc_site_url || '',
        sitemapUrl: user.sitemap_url || '',
        ga4PropertyId: user.ga4_property_id || '',
        semrushProjectId: user.semrush_project_id || '',
        semrushTrackingId: user.semrush_tracking_id || '',
        semrushTrackingId02: user.semrush_tracking_id_02 || '',
        googleAdsSheetId: user.google_ads_sheet_id || '',
        favicon_url: user.favicon_url || '',
        project_start_date: formatDateForInput(user.project_start_date), 
        project_duration_months: String(user.project_duration_months || 6),
        project_timeline_active: Boolean(user.project_timeline_active),
        settings_show_landingpages: user.settings_show_landingpages !== false,
        settings_show_google_ads: Boolean(user.settings_show_google_ads),
        settings_show_prompt_tracking: Boolean(user.settings_show_prompt_tracking),
        maintenance_mode: Boolean(user.maintenance_mode), // NEU
      };
      
      setFormData(newFormData);
      setWidgetVisibility(normalizeDashboardWidgetVisibility(user.dashboard_widget_visibility, {
        landingPages: user.settings_show_landingpages,
        googleAds: user.settings_show_google_ads,
        promptTracking: user.settings_show_prompt_tracking,
      }));
      setProjectLocations(normalizeLocations(user.project_locations));
      setPassword('');
      setIsChangingPassword(false);
      setMessage('');
      setSuccessMessage('');
    }
  }, [user]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      const nextValue = name === 'googleAdsSheetId' ? extractGoogleSpreadsheetId(value) : value;
      setFormData(prev => ({
        ...prev,
        [name]: nextValue
      }));
    }
  };

  const updateProjectLocation = (
    index: number,
    field: keyof ProjectLocation,
    value: string | number | null | string[]
  ) => {
    setProjectLocations((prev) => prev.map((location, locationIndex) => (
      locationIndex === index ? { ...location, [field]: value } : location
    )));
  };

  const addProjectLocation = () => {
    setProjectLocations((prev) => [...prev, createEmptyLocation()]);
  };

  const removeProjectLocation = (index: number) => {
    setProjectLocations((prev) => prev.filter((_, locationIndex) => locationIndex !== index));
  };


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const passwordError = isChangingPassword && password.length > 0 ? getPasswordError(password) : null;
    if (passwordError) {
      setMessage(`❌ Fehler: ${passwordError}`);
      return;
    }
    setMessage('💾 Speichere Änderungen...');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const permissionsArray = formData.permissions.split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const payload: ApiPayload = {
        email: formData.email,
        mandant_id: formData.mandantId || null,
        ansprache: formData.ansprache.trim() || null,
        permissions: (isSuperAdmin && user.role === 'ADMIN') ? permissionsArray : null,
        domain: formData.domain || null,
        gsc_site_url: formData.gscSiteUrl || null,
        sitemap_url: formData.sitemapUrl || null,
        ga4_property_id: formData.ga4PropertyId || null,
        favicon_url: formData.favicon_url || null,
        semrush_project_id: formData.semrushProjectId || null,
        semrush_tracking_id: formData.semrushTrackingId || null,
        semrush_tracking_id_02: formData.semrushTrackingId02 || null,
        google_ads_sheet_id: extractGoogleSpreadsheetId(formData.googleAdsSheetId) || null,
        project_start_date: formData.project_start_date || null,
        project_duration_months: parseInt(formData.project_duration_months, 10) || 6,
        project_timeline_active: formData.project_timeline_active,
        settings_show_landingpages: widgetVisibility.landingPages,
        settings_show_google_ads: widgetVisibility.googleAds,
        settings_show_prompt_tracking: widgetVisibility.promptTracking,
        dashboard_widget_visibility: widgetVisibility,
        project_locations: projectLocations
          .map((location) => ({
            ...location,
            name: location.name.trim(),
            postalCode: location.postalCode?.trim() || '',
            city: location.city?.trim() || '',
            country: location.country?.trim() || 'AT',
            googlePlaceId: location.googlePlaceId?.trim() || null,
            googleBusinessProfileUrl: location.googleBusinessProfileUrl?.trim() || null,
            googleBusinessProfileImageUrl: location.googleBusinessProfileImageUrl?.trim() || null,
            landingPages: Array.isArray(location.landingPages) ? location.landingPages.filter(Boolean) : [],
            keywords: Array.isArray(location.keywords) ? location.keywords.filter(Boolean) : [],
          }))
          .filter((location) => location.name),
        maintenance_mode: formData.maintenance_mode, // NEU
      };
      
      if (!isSuperAdmin || user.role !== 'ADMIN') {
        delete payload.permissions;
      }
      
      if (isChangingPassword && password.trim().length > 0) {
        payload.password = password;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Ein Fehler ist aufgetreten.`;
        if (typeof result === 'object' && result !== null) {
            const errorObj = result as { message?: string; error?: string };
            errorMessage = errorObj.message || errorObj.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const updatedUser = result as User;

      setFormData({
        email: updatedUser.email || '',
        mandantId: updatedUser.mandant_id || '',
        ansprache: updatedUser.ansprache || '',
        permissions: updatedUser.permissions?.join(', ') || '',
        domain: updatedUser.domain || '',
        gscSiteUrl: updatedUser.gsc_site_url || '',
        sitemapUrl: updatedUser.sitemap_url || '',
        ga4PropertyId: updatedUser.ga4_property_id || '',
        semrushProjectId: updatedUser.semrush_project_id || '',
        semrushTrackingId: updatedUser.semrush_tracking_id || '',
        semrushTrackingId02: updatedUser.semrush_tracking_id_02 || '',
        googleAdsSheetId: updatedUser.google_ads_sheet_id || '',
        favicon_url: updatedUser.favicon_url || '',
        project_start_date: formatDateForInput(updatedUser.project_start_date),
        project_duration_months: String(updatedUser.project_duration_months || 6),
        project_timeline_active: Boolean(updatedUser.project_timeline_active),
        settings_show_landingpages: updatedUser.settings_show_landingpages !== false,
        settings_show_google_ads: Boolean(updatedUser.settings_show_google_ads),
        settings_show_prompt_tracking: Boolean(updatedUser.settings_show_prompt_tracking),
        maintenance_mode: Boolean(updatedUser.maintenance_mode), // NEU
      });
      setProjectLocations(normalizeLocations(updatedUser.project_locations));
      setWidgetVisibility(normalizeDashboardWidgetVisibility(updatedUser.dashboard_widget_visibility, {
        landingPages: updatedUser.settings_show_landingpages,
        googleAds: updatedUser.settings_show_google_ads,
        promptTracking: updatedUser.settings_show_prompt_tracking,
      }));
      setPassword('');
      setIsChangingPassword(false);
      setMessage('');
      setSuccessMessage('✅ Benutzer erfolgreich aktualisiert!');
      if (onUserUpdated) onUserUpdated();
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('❌ Update Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setMessage(`❌ Fehler: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prüfen ob Wartungsmodus für diesen User erlaubt ist
  const canSetMaintenanceMode = user.role !== 'SUPERADMIN';

  // --- Rendering des Formulars ---
  return (
    <div className="bg-surface p-6 rounded-lg border border-border">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Pencil size={20} /> Benutzerinformationen bearbeiten
      </h2>

      {/* WARTUNGSMODUS BANNER - wenn aktiv */}
      {formData.maintenance_mode && (
        <div className="mb-4 p-3 bg-warning-bg border border-border rounded-lg flex items-center gap-2 text-warning">
          <ConeStriped className="text-warning flex-shrink-0" size={20} />
          <div>
            <span className="font-semibold">Wartungsmodus aktiv</span>
            <span className="text-sm ml-2">– Dieser Benutzer sieht nur die Wartungsseite.</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* --- E-Mail --- */}
        <div>
          <label className="block text-sm font-medium text-body">E-Mail *</label>
          <div className="relative mt-1">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange} 
              required
              className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
              disabled={isSubmitting}
            />
            {formData.email && !isSubmitting && (
              <CheckCircle 
                className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                size={16}
              />
            )}
          </div>
        </div>

        {/* --- Passwort --- */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="new-user-password" className="block text-sm font-medium text-body">Passwort</label>
            <button
              type="button"
              onClick={() => { setIsChangingPassword(!isChangingPassword); setPassword(''); }}
              className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isChangingPassword ? 'Abbrechen' : 'Passwort ändern'}
            </button>
          </div>
          {isChangingPassword ? (
            <>
              <input
                id="new-user-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Neues Passwort, mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                disabled={isSubmitting}
                autoFocus
              />
              <p className={`mt-1 text-xs ${password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? 'text-danger' : 'text-muted'}`}>
                {password.length}/{MIN_PASSWORD_LENGTH} Zeichen. Leer lassen, um das Passwort nicht zu ändern.
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted">Das bestehende Passwort bleibt unverändert.</p>
          )}
        </div>

        {/* --- Mandant-ID --- */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-body">Mandant-ID (Label)</label>
          <div className="relative mt-1">
            <input
              type="text"
              name="mandantId"
              value={formData.mandantId}
              onChange={handleInputChange} 
              placeholder="z.B. max-online"
              className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
              disabled={isSubmitting || !isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
            {formData.mandantId && !isSubmitting && isSuperAdmin && (
              <CheckCircle 
                className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                size={16}
              />
            )}
          </div>
        </div>

        {/* --- Ansprache --- */}
        <div>
          <label className="block text-sm font-medium text-body">Ansprache</label>
          <div className="relative mt-1">
            <input
              type="text"
              name="ansprache"
              value={formData.ansprache}
              onChange={handleInputChange}
              placeholder="z.B. Herr Muster oder Frau Muster"
              className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
              disabled={isSubmitting}
            />
            {formData.ansprache && !isSubmitting && (
              <CheckCircle
                className="absolute top-1/2 right-3 -translate-y-1/2 text-success"
                size={16}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            Wird für Login-Meldung und DataMax-Begrüßung verwendet.
          </p>
        </div>

        {/* --- Admin-Berechtigungen --- */}
        {isSuperAdmin && user.role === 'ADMIN' && (
          <div>
            <label className="block text-sm font-medium text-body">
              Admin-Berechtigungen (kommagetrennt)
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="permissions"
                value={formData.permissions}
                onChange={handleInputChange} 
                placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
                className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                disabled={isSubmitting || !isSuperAdmin}
                readOnly={!isSuperAdmin}
              />
              {formData.permissions && !isSubmitting && (
                <CheckCircle 
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                  size={16}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              Labels mit Komma trennen.
            </p>
          </div>
        )}

        {/* =====================================================
            NEU: WARTUNGSMODUS SEKTION - für BENUTZER und ADMIN
            ===================================================== */}
        {canSetMaintenanceMode && (
          <fieldset className={`border-t pt-4 mt-4 ${formData.maintenance_mode ? 'bg-warning-bg -mx-6 px-6 pb-4 border-border' : ''}`}>
            <legend className="text-sm font-medium text-body mb-2 flex items-center gap-2">
              <ConeStriped className={formData.maintenance_mode ? 'text-warning' : 'text-muted'} size={16} />
              Wartungsmodus
            </legend>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label 
                  htmlFor="maintenance_mode" 
                  className="flex items-center gap-3 text-sm font-medium text-body cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="maintenance_mode"
                    name="maintenance_mode"
                    checked={formData.maintenance_mode}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="h-5 w-5 text-warning border-border rounded focus:ring-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    {formData.maintenance_mode ? (
                      <ToggleOn size={24} className="text-warning" />
                    ) : (
                      <ToggleOff size={24} className="text-muted" />
                    )}
                    <span className={formData.maintenance_mode ? 'text-warning font-semibold' : ''}>
                      {formData.maintenance_mode ? 'Wartungsmodus AKTIV' : 'Wartungsmodus deaktiviert'}
                    </span>
                  </div>
                </label>
                <p className="mt-1 text-xs text-muted ml-8">
                  {formData.maintenance_mode 
                    ? 'Der Benutzer sieht nur die Wartungsseite und der Header ist ausgeblendet.'
                    : 'Wenn aktiviert, sieht der Benutzer nur die Wartungsseite.'}
                </p>
              </div>
            </div>

            {/* Warnung wenn aktiviert */}
            {formData.maintenance_mode && (
              <div className="mt-3 p-2 bg-warning-bg border border-amber-300 rounded-md flex items-start gap-2 text-xs text-warning">
                <ExclamationTriangle className="flex-shrink-0 mt-0.5" size={14} />
                <span>
                  <strong>Achtung:</strong> Der Benutzer wird sofort gesperrt, sobald Sie speichern. 
                  Er kann sich zwar noch einloggen, sieht aber nur die Wartungsseite.
                </span>
              </div>
            )}
          </fieldset>
        )}

        {/* Info für SUPERADMINs */}
        {!canSetMaintenanceMode && (
          <div className="border-t pt-4 mt-4">
            <div className="p-3 bg-surface-secondary border border-border rounded-lg text-sm text-muted">
              <ConeStriped className="inline mr-2" size={16} />
              Superadmins können nicht in den Wartungsmodus gesetzt werden.
            </div>
          </div>
        )}

        {/* --- Wrapper für BENUTZER-spezifische Felder --- */}
        {user.role === 'BENUTZER' && (
          <>
            {/* --- Projekt-Timeline --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-body mb-2">Projekt-Timeline</legend>
              
              <div className="mb-4">
                <label 
                  htmlFor="project_timeline_active" 
                  className="flex items-center gap-2 text-sm font-medium text-body cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="project_timeline_active"
                    name="project_timeline_active"
                    checked={formData.project_timeline_active}
                    onChange={(e) => {
                      console.log('[EditUserForm] Checkbox onChange - checked:', e.target.checked);
                      handleInputChange(e);
                    }}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
                  />
                  {formData.project_timeline_active ? (
                    <ToggleOn size={20} className="text-success" />
                  ) : (
                    <ToggleOff size={20} className="text-muted" />
                  )}
                  Projekt-Timeline Widget auf Dashboard anzeigen
                </label>
              </div>

              {/* Startdatum & Dauer (nur sichtbar wenn Timeline aktiv ist) */}
              {formData.project_timeline_active && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Startdatum */}
                  <div>
                    <label className="block text-sm font-medium text-body flex items-center gap-1">
                      <CalendarEvent size={14} /> Projekt-Startdatum
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="date"
                        name="project_start_date"
                        value={formData.project_start_date}
                        onChange={handleInputChange} 
                        className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      />
                      {formData.project_start_date && !isSubmitting && (
                        <CheckCircle 
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-success pointer-events-none" 
                          size={16}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dauer */}
                  <div>
                    <label className="block text-sm font-medium text-body flex items-center gap-1">
                      <ClockHistory size={14} /> Projektdauer (Monate)
                    </label>
                    <div className="relative mt-1">
                      <select
                        name="project_duration_months"
                        value={formData.project_duration_months}
                        onChange={handleInputChange} 
                        className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      >
                        <option value="6">6 Monate</option>
                        <option value="12">12 Monate</option>
                        <option value="18">18 Monate</option>
                        <option value="24">24 Monate</option>
                      </select>
                      {formData.project_duration_months && !isSubmitting && (
                        <CheckCircle 
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-success pointer-events-none" 
                          size={16}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </fieldset>

            {/* --- Dashboard-Sichtbarkeit --- */}
            {user.role === 'BENUTZER' && (
              <fieldset className="border-t pt-4 mt-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <legend className="text-sm font-medium text-body">Dashboard-Sichtbarkeit</legend>
                    <p className="mt-1 text-xs text-muted">
                      Steuert die Kundenansicht. Admins sehen verfügbare Widgets weiterhin.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWidgetVisibility(normalizeDashboardWidgetVisibility(
                        Object.fromEntries(DASHBOARD_WIDGET_DEFINITIONS.map(({ key }) => [key, true]))
                      ))}
                      disabled={isSubmitting}
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-secondary disabled:opacity-50"
                    >
                      Alle anzeigen
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidgetVisibility(normalizeDashboardWidgetVisibility(
                        Object.fromEntries(DASHBOARD_WIDGET_DEFINITIONS.map(({ key }) => [key, false]))
                      ))}
                      disabled={isSubmitting}
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-secondary disabled:opacity-50"
                    >
                      Alle ausblenden
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {Array.from(new Set(DASHBOARD_WIDGET_DEFINITIONS.map(({ group }) => group))).map((group) => (
                    <section key={group}>
                      <h4 className="mb-2 text-xs font-semibold text-muted">{group}</h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {DASHBOARD_WIDGET_DEFINITIONS
                          .filter((widget) => widget.group === group)
                          .map((widget) => {
                            const enabled = widgetVisibility[widget.key];
                            return (
                              <label
                                key={widget.key}
                                htmlFor={`widget-${widget.key}`}
                                className="flex min-h-[72px] cursor-pointer items-start justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2.5"
                              >
                                <span>
                                  <span className="block text-sm font-medium text-body">{widget.label}</span>
                                  <span className="mt-0.5 block text-xs leading-4 text-muted">{widget.description}</span>
                                </span>
                                <span className="flex shrink-0 items-center">
                                  <input
                                    type="checkbox"
                                    id={`widget-${widget.key}`}
                                    checked={enabled}
                                    onChange={() => setWidgetVisibility((current) => ({
                                      ...current,
                                      [widget.key]: !current[widget.key],
                                    }))}
                                    disabled={isSubmitting}
                                    className="sr-only"
                                  />
                                  {enabled ? (
                                    <ToggleOn size={26} className="text-success" />
                                  ) : (
                                    <ToggleOff size={26} className="text-muted" />
                                  )}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </section>
                  ))}
                </div>
              </fieldset>
            )}

            {/* --- Standorte / Local SEO --- */}
            <fieldset className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <legend className="text-sm font-medium text-body">Standorte / Local SEO</legend>
                  <p className="mt-1 text-xs text-muted">
                    Optional: Standorte mit PLZ, Zielseiten und lokalen Keywords für das Local-SEO-Widget.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addProjectLocation}
                  disabled={isSubmitting}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-accent bg-accent-tint hover:bg-accent-tint disabled:opacity-50"
                >
                  Standort hinzufügen
                </button>
              </div>

              {projectLocations.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-secondary p-3 text-sm text-muted">
                  Noch keine Standorte hinterlegt. Ohne Standorte bleibt das Local-SEO-Widget ausgeblendet.
                </div>
              ) : (
                <div className="space-y-4">
                  {projectLocations.map((location, index) => (
                    <div key={location.id || index} className="rounded-lg border border-border bg-surface-secondary p-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs font-semibold text-muted">
                          Standort {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProjectLocation(index)}
                          disabled={isSubmitting}
                          className="text-xs font-medium text-danger hover:text-danger disabled:opacity-50"
                        >
                          Entfernen
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted">Name *</label>
                          <input
                            type="text"
                            value={location.name}
                            onChange={(event) => updateProjectLocation(index, 'name', event.target.value)}
                            placeholder="z.B. Wien Innenstadt"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted">PLZ</label>
                          <input
                            type="text"
                            value={location.postalCode || ''}
                            onChange={(event) => updateProjectLocation(index, 'postalCode', event.target.value)}
                            placeholder="z.B. 1010"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted">Stadt</label>
                          <input
                            type="text"
                            value={location.city || ''}
                            onChange={(event) => updateProjectLocation(index, 'city', event.target.value)}
                            placeholder="z.B. Wien"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted">Land</label>
                          <input
                            type="text"
                            value={location.country || 'AT'}
                            onChange={(event) => updateProjectLocation(index, 'country', event.target.value)}
                            placeholder="AT"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted">Latitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={location.lat ?? ''}
                            onChange={(event) => updateProjectLocation(index, 'lat', event.target.value === '' ? null : Number(event.target.value))}
                            placeholder="48.2082"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted">Longitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={location.lng ?? ''}
                            onChange={(event) => updateProjectLocation(index, 'lng', event.target.value === '' ? null : Number(event.target.value))}
                            placeholder="16.3738"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted">Google Place ID</label>
                          <input
                            type="text"
                            value={location.googlePlaceId || ''}
                            onChange={(event) => updateProjectLocation(index, 'googlePlaceId', event.target.value)}
                            placeholder="z.B. ChIJ..."
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                          <p className="mt-1 text-[12px] text-muted">
                            Optional, aber empfohlen. Echte Place IDs beginnen meist mit ChIJ. Reine Zahlen sind CIDs und werden ignoriert.
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted">Google Unternehmensprofil URL / Maps-Link</label>
                          <input
                            type="url"
                            value={location.googleBusinessProfileUrl || ''}
                            onChange={(event) => updateProjectLocation(index, 'googleBusinessProfileUrl', event.target.value)}
                            placeholder="https://maps.app.goo.gl/..."
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted">Google Unternehmensprofil Bild URL</label>
                          <input
                            type="url"
                            value={location.googleBusinessProfileImageUrl || ''}
                            onChange={(event) => updateProjectLocation(index, 'googleBusinessProfileImageUrl', event.target.value)}
                            placeholder="https://..."
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted">Landingpages (kommagetrennt)</label>
                          <input
                            type="text"
                            value={listToCsv(location.landingPages)}
                            onChange={(event) => updateProjectLocation(index, 'landingPages', csvToList(event.target.value))}
                            placeholder="/rechtsanwalt-wien/, /standort-wien/"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-muted">Keywords/Aliase (kommagetrennt)</label>
                          <input
                            type="text"
                            value={listToCsv(location.keywords)}
                            onChange={(event) => updateProjectLocation(index, 'keywords', csvToList(event.target.value))}
                            placeholder="wien, 1010, innere stadt, rechtsanwalt wien"
                            className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary placeholder:text-muted"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            {/* --- Konfiguration --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-body mb-2">Konfiguration</legend>
              
              {/* Domain */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">Domain</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange} 
                    placeholder="z.B. www.kundendomain.at"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.domain && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Favicon URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">Favicon URL</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="favicon_url"
                    value={formData.favicon_url}
                    onChange={handleInputChange} 
                    placeholder="Optional: https://example.com/favicon.png"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.favicon_url && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* GSC Site URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">GSC Site URL</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="gscSiteUrl"
                    value={formData.gscSiteUrl}
                    onChange={handleInputChange} 
                    placeholder="z.B. sc-domain:kundendomain.at"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.gscSiteUrl && !isSubmitting && normalizeGscSiteUrl(formData.gscSiteUrl).ok && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Sitemap URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">Sitemap URL</label>
                <div className="relative mt-1">
                  <input
                    type="url"
                    name="sitemapUrl"
                    value={formData.sitemapUrl}
                    onChange={handleInputChange}
                    placeholder="Optional: https://kundendomain.at/sitemap.xml"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.sitemapUrl && !isSubmitting && (
                    <CheckCircle
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success"
                      size={16}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Leer lassen für die automatische Erkennung über /sitemap.xml.
                </p>
              </div>

              {/* GA4 Property ID */}
              <div>
                <label className="block text-sm font-medium text-body">GA4 Property ID</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="ga4PropertyId"
                    value={formData.ga4PropertyId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 123456789"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.ga4PropertyId && !isSubmitting && parseGa4PropertyId(formData.ga4PropertyId).ok && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
                {(() => {
                  const check = parseGa4PropertyId(formData.ga4PropertyId);
                  return check.ok
                    ? <p className="mt-1 text-xs text-muted">{GA4_PROPERTY_ID_HINT}</p>
                    : <p className="mt-1 text-xs text-danger" role="alert">{check.message}</p>;
                })()}
              </div>

              <div className="mt-4">
                <GoogleConnectionCheck gscSiteUrl={formData.gscSiteUrl} ga4PropertyId={formData.ga4PropertyId} />
              </div>
            </fieldset>

            {/* --- GOOGLE ADS --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-body mb-2">Google Ads</legend>
              
              {/* Google Ads Sheet ID */}
              <div>
                <label className="block text-sm font-medium text-body">
                  Google Ads Sheet ID
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="googleAdsSheetId"
                    value={formData.googleAdsSheetId}
                    onChange={handleInputChange} 
                    placeholder="Google-Sheets-URL oder Spreadsheet-ID"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.googleAdsSheetId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Am besten die komplette Google-Sheets-URL einfügen. DataPeak extrahiert die ID automatisch. Wenn leer, werden Ads-Daten über GA4 geladen.
                </p>
              </div>
            </fieldset>

            {/* --- SEMRUSH --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-body mb-2">Semrush</legend>
              
              {/* Semrush Projekt ID */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">
                  Semrush Projekt ID
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushProjectId"
                    value={formData.semrushProjectId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 12920575"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.semrushProjectId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Semrush Tracking-ID (Kampagne 1) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-body">
                  Semrush Tracking-ID (Kampagne 1)
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushTrackingId"
                    value={formData.semrushTrackingId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 1209408"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.semrushTrackingId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Semrush Tracking-ID 02 (Kampagne 2) */}
              <div>
                <label className="block text-sm font-medium text-body">
                  Semrush Tracking-ID (Kampagne 2)
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushTrackingId02"
                    value={formData.semrushTrackingId02}
                    onChange={handleInputChange} 
                    placeholder="z.B. 1209491"
                    className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
                    disabled={isSubmitting}
                  />
                  {formData.semrushTrackingId02 && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                      size={16}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">Optional: Für eine zweite Kampagne/Tracking</p>
              </div>
            </fieldset>
          </>
        )}
        {/* --- ENDE Wrapper --- */}
        
        {/* (Button & Messages) */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 font-normal text-white bg-accent-solid border-[3px] border-accent rounded-[3px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Spinner size={18} className="" />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{isSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}</span>
        </button>

        {successMessage && (
          <p className="text-sm text-success font-medium mt-4 p-3 bg-success-bg rounded border border-border">
            {successMessage}
          </p>
        )}
        {message && !successMessage && (
          <p className="text-sm text-danger font-medium mt-4 p-3 bg-danger-bg rounded border border-border">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
