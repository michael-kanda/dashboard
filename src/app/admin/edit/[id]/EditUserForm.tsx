// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState, FormEvent, useEffect, ChangeEvent } from 'react';
import { User, ProjectLocation } from '@/types';
import { 
  Pencil, 
  ArrowRepeat, 
  CheckCircle, 
  CalendarEvent, 
  ClockHistory,
  ToggleOn,
  ToggleOff,
  ConeStriped,         // NEU für Wartungsmodus
  ExclamationTriangle  // NEU für Warnung
} from 'react-bootstrap-icons';

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
  ga4_property_id: string | null;
  favicon_url: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
  google_ads_sheet_id: string | null;
  project_start_date: string | null; 
  project_duration_months: number | null; 
  project_timeline_active: boolean;
  settings_show_prompt_tracking: boolean;
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


export default function EditUserForm({ user, onUserUpdated, isSuperAdmin }: EditUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    mandantId: '',
    ansprache: '',
    permissions: '', 
    domain: '',
    gscSiteUrl: '',
    ga4PropertyId: '',
    semrushProjectId: '',
    semrushTrackingId: '',
    semrushTrackingId02: '',
    googleAdsSheetId: '',
    favicon_url: '',
    project_start_date: '',    
    project_duration_months: '6', 
    project_timeline_active: false,
    settings_show_prompt_tracking: false,
    maintenance_mode: false, // NEU
  });

  const [password, setPassword] = useState('');
  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>([]);
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
        ga4PropertyId: user.ga4_property_id || '',
        semrushProjectId: user.semrush_project_id || '',
        semrushTrackingId: user.semrush_tracking_id || '',
        semrushTrackingId02: user.semrush_tracking_id_02 || '',
        googleAdsSheetId: user.google_ads_sheet_id || '',
        favicon_url: user.favicon_url || '',
        project_start_date: formatDateForInput(user.project_start_date), 
        project_duration_months: String(user.project_duration_months || 6),
        project_timeline_active: Boolean(user.project_timeline_active),
        settings_show_prompt_tracking: Boolean(user.settings_show_prompt_tracking),
        maintenance_mode: Boolean(user.maintenance_mode), // NEU
      };
      
      setFormData(newFormData);
      setProjectLocations(normalizeLocations(user.project_locations));
      setPassword('');
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
      setFormData(prev => ({
        ...prev,
        [name]: value
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
        ga4_property_id: formData.ga4PropertyId || null,
        favicon_url: formData.favicon_url || null,
        semrush_project_id: formData.semrushProjectId || null,
        semrush_tracking_id: formData.semrushTrackingId || null,
        semrush_tracking_id_02: formData.semrushTrackingId02 || null,
        google_ads_sheet_id: formData.googleAdsSheetId || null,
        project_start_date: formData.project_start_date || null,
        project_duration_months: parseInt(formData.project_duration_months, 10) || 6,
        project_timeline_active: formData.project_timeline_active,
        settings_show_prompt_tracking: formData.settings_show_prompt_tracking,
        project_locations: projectLocations
          .map((location) => ({
            ...location,
            name: location.name.trim(),
            postalCode: location.postalCode?.trim() || '',
            city: location.city?.trim() || '',
            country: location.country?.trim() || 'AT',
            landingPages: Array.isArray(location.landingPages) ? location.landingPages.filter(Boolean) : [],
            keywords: Array.isArray(location.keywords) ? location.keywords.filter(Boolean) : [],
          }))
          .filter((location) => location.name),
        maintenance_mode: formData.maintenance_mode, // NEU
      };
      
      if (!isSuperAdmin || user.role !== 'ADMIN') {
        delete payload.permissions;
      }
      
      if (password && password.trim().length > 0) {
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
        ga4PropertyId: updatedUser.ga4_property_id || '',
        semrushProjectId: updatedUser.semrush_project_id || '',
        semrushTrackingId: updatedUser.semrush_tracking_id || '',
        semrushTrackingId02: updatedUser.semrush_tracking_id_02 || '',
        googleAdsSheetId: updatedUser.google_ads_sheet_id || '',
        favicon_url: updatedUser.favicon_url || '',
        project_start_date: formatDateForInput(updatedUser.project_start_date),
        project_duration_months: String(updatedUser.project_duration_months || 6),
        project_timeline_active: Boolean(updatedUser.project_timeline_active),
        settings_show_prompt_tracking: Boolean(updatedUser.settings_show_prompt_tracking),
        maintenance_mode: Boolean(updatedUser.maintenance_mode), // NEU
      });
      setProjectLocations(normalizeLocations(updatedUser.project_locations));
      setPassword('');
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
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Pencil size={20} /> Benutzerinformationen bearbeiten
      </h2>

      {/* WARTUNGSMODUS BANNER - wenn aktiv */}
      {formData.maintenance_mode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
          <ConeStriped className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <span className="font-semibold">Wartungsmodus aktiv</span>
            <span className="text-sm ml-2">– Dieser Benutzer sieht nur die Wartungsseite.</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* --- E-Mail --- */}
        <div>
          <label className="block text-sm font-medium text-gray-700">E-Mail *</label>
          <div className="relative mt-1">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange} 
              required
              className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            />
            {formData.email && !isSubmitting && (
              <CheckCircle 
                className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                size={16}
              />
            )}
          </div>
        </div>

        {/* --- Passwort --- */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Passwort (Optional - leer lassen um nicht zu ändern)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nur ausfüllen wenn Passwort geändert werden soll"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
            disabled={isSubmitting}
          />
        </div>

        {/* --- Mandant-ID --- */}
        <div className="border-t pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
          <div className="relative mt-1">
            <input
              type="text"
              name="mandantId"
              value={formData.mandantId}
              onChange={handleInputChange} 
              placeholder="z.B. max-online"
              className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
              disabled={isSubmitting || !isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
            {formData.mandantId && !isSubmitting && isSuperAdmin && (
              <CheckCircle 
                className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                size={16}
              />
            )}
          </div>
        </div>

        {/* --- Ansprache --- */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Ansprache</label>
          <div className="relative mt-1">
            <input
              type="text"
              name="ansprache"
              value={formData.ansprache}
              onChange={handleInputChange}
              placeholder="z.B. Herr Muster oder Frau Muster"
              className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
              disabled={isSubmitting}
            />
            {formData.ansprache && !isSubmitting && (
              <CheckCircle
                className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500"
                size={16}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Wird für Login-Meldung und DataMax-Begrüßung verwendet.
          </p>
        </div>

        {/* --- Admin-Berechtigungen --- */}
        {isSuperAdmin && user.role === 'ADMIN' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Admin-Berechtigungen (kommagetrennt)
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="permissions"
                value={formData.permissions}
                onChange={handleInputChange} 
                placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
                className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                disabled={isSubmitting || !isSuperAdmin}
                readOnly={!isSuperAdmin}
              />
              {formData.permissions && !isSubmitting && (
                <CheckCircle 
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                  size={16}
                />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Labels mit Komma trennen.
            </p>
          </div>
        )}

        {/* =====================================================
            NEU: WARTUNGSMODUS SEKTION - für BENUTZER und ADMIN
            ===================================================== */}
        {canSetMaintenanceMode && (
          <fieldset className={`border-t pt-4 mt-4 ${formData.maintenance_mode ? 'bg-amber-50 -mx-6 px-6 pb-4 border-amber-200' : ''}`}>
            <legend className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ConeStriped className={formData.maintenance_mode ? 'text-amber-600' : 'text-gray-400'} size={16} />
              Wartungsmodus
            </legend>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label 
                  htmlFor="maintenance_mode" 
                  className="flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="maintenance_mode"
                    name="maintenance_mode"
                    checked={formData.maintenance_mode}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="h-5 w-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    {formData.maintenance_mode ? (
                      <ToggleOn size={24} className="text-amber-500" />
                    ) : (
                      <ToggleOff size={24} className="text-gray-400" />
                    )}
                    <span className={formData.maintenance_mode ? 'text-amber-700 font-semibold' : ''}>
                      {formData.maintenance_mode ? 'Wartungsmodus AKTIV' : 'Wartungsmodus deaktiviert'}
                    </span>
                  </div>
                </label>
                <p className="mt-1 text-xs text-gray-500 ml-8">
                  {formData.maintenance_mode 
                    ? 'Der Benutzer sieht nur die Wartungsseite und der Header ist ausgeblendet.'
                    : 'Wenn aktiviert, sieht der Benutzer nur die Wartungsseite.'}
                </p>
              </div>
            </div>

            {/* Warnung wenn aktiviert */}
            {formData.maintenance_mode && (
              <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded-md flex items-start gap-2 text-xs text-amber-800">
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
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
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
              <legend className="text-sm font-medium text-gray-700 mb-2">Projekt-Timeline</legend>
              
              <div className="mb-4">
                <label 
                  htmlFor="project_timeline_active" 
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"
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
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  {formData.project_timeline_active ? (
                    <ToggleOn size={20} className="text-green-500" />
                  ) : (
                    <ToggleOff size={20} className="text-gray-400" />
                  )}
                  Projekt-Timeline Widget auf Dashboard anzeigen
                </label>
              </div>

              {/* Startdatum & Dauer (nur sichtbar wenn Timeline aktiv ist) */}
              {formData.project_timeline_active && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Startdatum */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                      <CalendarEvent size={14} /> Projekt-Startdatum
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="date"
                        name="project_start_date"
                        value={formData.project_start_date}
                        onChange={handleInputChange} 
                        className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      />
                      {formData.project_start_date && !isSubmitting && (
                        <CheckCircle 
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500 pointer-events-none" 
                          size={16}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dauer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                      <ClockHistory size={14} /> Projektdauer (Monate)
                    </label>
                    <div className="relative mt-1">
                      <select
                        name="project_duration_months"
                        value={formData.project_duration_months}
                        onChange={handleInputChange} 
                        className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      >
                        <option value="6">6 Monate</option>
                        <option value="12">12 Monate</option>
                        <option value="18">18 Monate</option>
                        <option value="24">24 Monate</option>
                      </select>
                      {formData.project_duration_months && !isSubmitting && (
                        <CheckCircle 
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500 pointer-events-none" 
                          size={16}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </fieldset>

            {/* --- Prompt Tracking --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Prompt Tracking</legend>

              <label
                htmlFor="settings_show_prompt_tracking"
                className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="settings_show_prompt_tracking"
                  name="settings_show_prompt_tracking"
                  checked={formData.settings_show_prompt_tracking}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                {formData.settings_show_prompt_tracking ? (
                  <ToggleOn size={20} className="text-green-500" />
                ) : (
                  <ToggleOff size={20} className="text-gray-400" />
                )}
                Prompt-Tracking Widget im Kunden-Dashboard anzeigen
              </label>
              <p className="mt-1 text-xs text-gray-400">
                Admins sehen Prompt Tracking weiterhin, wenn GSC-Daten vorhanden sind. Diese Einstellung steuert die Kundenansicht.
              </p>
            </fieldset>

            {/* --- Standorte / Local SEO --- */}
            <fieldset className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <legend className="text-sm font-medium text-gray-700">Standorte / Local SEO</legend>
                  <p className="mt-1 text-xs text-gray-400">
                    Optional: Standorte mit PLZ, Zielseiten und lokalen Keywords für das Local-SEO-Widget.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addProjectLocation}
                  disabled={isSubmitting}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Standort hinzufügen
                </button>
              </div>

              {projectLocations.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">
                  Noch keine Standorte hinterlegt. Ohne Standorte bleibt das Local-SEO-Widget ausgeblendet.
                </div>
              ) : (
                <div className="space-y-4">
                  {projectLocations.map((location, index) => (
                    <div key={location.id || index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Standort {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProjectLocation(index)}
                          disabled={isSubmitting}
                          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Entfernen
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Name *</label>
                          <input
                            type="text"
                            value={location.name}
                            onChange={(event) => updateProjectLocation(index, 'name', event.target.value)}
                            placeholder="z.B. Wien Innenstadt"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">PLZ</label>
                          <input
                            type="text"
                            value={location.postalCode || ''}
                            onChange={(event) => updateProjectLocation(index, 'postalCode', event.target.value)}
                            placeholder="z.B. 1010"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Stadt</label>
                          <input
                            type="text"
                            value={location.city || ''}
                            onChange={(event) => updateProjectLocation(index, 'city', event.target.value)}
                            placeholder="z.B. Wien"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Land</label>
                          <input
                            type="text"
                            value={location.country || 'AT'}
                            onChange={(event) => updateProjectLocation(index, 'country', event.target.value)}
                            placeholder="AT"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Latitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={location.lat ?? ''}
                            onChange={(event) => updateProjectLocation(index, 'lat', event.target.value === '' ? null : Number(event.target.value))}
                            placeholder="48.2082"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Longitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={location.lng ?? ''}
                            onChange={(event) => updateProjectLocation(index, 'lng', event.target.value === '' ? null : Number(event.target.value))}
                            placeholder="16.3738"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600">Landingpages (kommagetrennt)</label>
                          <input
                            type="text"
                            value={listToCsv(location.landingPages)}
                            onChange={(event) => updateProjectLocation(index, 'landingPages', csvToList(event.target.value))}
                            placeholder="/rechtsanwalt-wien/, /standort-wien/"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600">Keywords/Aliase (kommagetrennt)</label>
                          <input
                            type="text"
                            value={listToCsv(location.keywords)}
                            onChange={(event) => updateProjectLocation(index, 'keywords', csvToList(event.target.value))}
                            placeholder="wien, 1010, innere stadt, rechtsanwalt wien"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
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
              <legend className="text-sm font-medium text-gray-700 mb-2">Konfiguration</legend>
              
              {/* Domain */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Domain</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange} 
                    placeholder="z.B. www.kundendomain.at"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.domain && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Favicon URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Favicon URL</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="favicon_url"
                    value={formData.favicon_url}
                    onChange={handleInputChange} 
                    placeholder="Optional: https://example.com/favicon.png"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.favicon_url && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* GSC Site URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">GSC Site URL</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="gscSiteUrl"
                    value={formData.gscSiteUrl}
                    onChange={handleInputChange} 
                    placeholder="z.B. sc-domain:kundendomain.at"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.gscSiteUrl && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* GA4 Property ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700">GA4 Property ID</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="ga4PropertyId"
                    value={formData.ga4PropertyId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 123456789"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.ga4PropertyId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>
            </fieldset>

            {/* --- GOOGLE ADS --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Google Ads</legend>
              
              {/* Google Ads Sheet ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Google Ads Sheet ID
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="googleAdsSheetId"
                    value={formData.googleAdsSheetId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.googleAdsSheetId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Die Spreadsheet-ID aus der Sheet-URL. Wird vom Google Ads Script befüllt. Wenn leer, werden Ads-Daten über GA4 geladen.
                </p>
              </div>
            </fieldset>

            {/* --- SEMRUSH --- */}
            <fieldset className="border-t pt-4 mt-4">
              <legend className="text-sm font-medium text-gray-700 mb-2">Semrush</legend>
              
              {/* Semrush Projekt ID */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Projekt ID
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushProjectId"
                    value={formData.semrushProjectId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 12920575"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.semrushProjectId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Semrush Tracking-ID (Kampagne 1) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 1)
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushTrackingId"
                    value={formData.semrushTrackingId}
                    onChange={handleInputChange} 
                    placeholder="z.B. 1209408"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.semrushTrackingId && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
              </div>

              {/* Semrush Tracking-ID 02 (Kampagne 2) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semrush Tracking-ID (Kampagne 2)
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="semrushTrackingId02"
                    value={formData.semrushTrackingId02}
                    onChange={handleInputChange} 
                    placeholder="z.B. 1209491"
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                  {formData.semrushTrackingId02 && !isSubmitting && (
                    <CheckCircle 
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-green-500" 
                      size={16}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Optional: Für eine zweite Kampagne/Tracking</p>
              </div>
            </fieldset>
          </>
        )}
        {/* --- ENDE Wrapper --- */}
        
        {/* (Button & Messages) */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <ArrowRepeat className="animate-spin" size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{isSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}</span>
        </button>

        {successMessage && (
          <p className="text-sm text-green-600 font-medium mt-4 p-3 bg-green-50 rounded border border-green-200">
            {successMessage}
          </p>
        )}
        {message && !successMessage && (
          <p className="text-sm text-red-600 font-medium mt-4 p-3 bg-red-50 rounded border border-red-200">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
