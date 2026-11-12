// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User, ProjectLocation } from '@/types';
import {
  normalizeDashboardWidgetVisibility,
  type DashboardWidgetVisibility,
} from '@/lib/dashboard-widget-visibility';
import {
  Pencil,
  CheckCircle,
  ConeStriped,
} from 'react-bootstrap-icons';
import { Spinner } from '@/components/ui/Spinner';
import { getPasswordError } from '@/lib/password-policy';
import {
  formatDateForInput,
  createEmptyLocation,
  normalizeLocations,
  extractGoogleSpreadsheetId,
  type ApiPayload,
} from './sections/edit-user-form-helpers';
import AccountSection from './sections/AccountSection';
import MaintenanceModeSection from './sections/MaintenanceModeSection';
import ProjectTimelineSection from './sections/ProjectTimelineSection';
import DashboardVisibilitySection from './sections/DashboardVisibilitySection';
import LocalSeoSection from './sections/LocalSeoSection';
import ConfigurationSection from './sections/ConfigurationSection';
import GoogleAdsSection from './sections/GoogleAdsSection';
import SemrushSection from './sections/SemrushSection';
import { logger } from '@/lib/logger';

interface EditUserFormProps {
  user: User;
  onUserUpdated?: () => void;
  isSuperAdmin: boolean; 
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
      logger.debug('[EditUserForm] useEffect - user.project_timeline_active:', user.project_timeline_active);
      logger.debug('[EditUserForm] useEffect - user.maintenance_mode:', user.maintenance_mode);
      
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
        
        <AccountSection
          user={user}
          isSuperAdmin={isSuperAdmin}
          formData={formData}
          handleInputChange={handleInputChange}
          password={password}
          setPassword={setPassword}
          isChangingPassword={isChangingPassword}
          setIsChangingPassword={setIsChangingPassword}
          isSubmitting={isSubmitting}
        />

        <MaintenanceModeSection
          canSetMaintenanceMode={canSetMaintenanceMode}
          formData={formData}
          handleInputChange={handleInputChange}
          isSubmitting={isSubmitting}
        />

        {/* --- Wrapper für BENUTZER-spezifische Felder --- */}
        {user.role === 'BENUTZER' && (
          <>
            {/* --- Projekt-Timeline --- */}
            <ProjectTimelineSection
              formData={formData}
              handleInputChange={handleInputChange}
              isSubmitting={isSubmitting}
            />

            {/* --- Dashboard-Sichtbarkeit --- */}
            {user.role === 'BENUTZER' && (
              <DashboardVisibilitySection
                widgetVisibility={widgetVisibility}
                setWidgetVisibility={setWidgetVisibility}
                isSubmitting={isSubmitting}
              />
            )}

            {/* --- Standorte / Local SEO --- */}
            <LocalSeoSection
              projectLocations={projectLocations}
              addProjectLocation={addProjectLocation}
              removeProjectLocation={removeProjectLocation}
              updateProjectLocation={updateProjectLocation}
              isSubmitting={isSubmitting}
            />

            {/* --- Konfiguration --- */}
            <ConfigurationSection
              formData={formData}
              handleInputChange={handleInputChange}
              isSubmitting={isSubmitting}
            />

            {/* --- GOOGLE ADS --- */}
            <GoogleAdsSection
              formData={formData}
              handleInputChange={handleInputChange}
              isSubmitting={isSubmitting}
            />

            {/* --- SEMRUSH --- */}
            <SemrushSection
              formData={formData}
              handleInputChange={handleInputChange}
              isSubmitting={isSubmitting}
            />
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
