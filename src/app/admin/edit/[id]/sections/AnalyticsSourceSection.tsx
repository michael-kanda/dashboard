// src/app/admin/edit/[id]/sections/AnalyticsSourceSection.tsx
'use client';

import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface AnalyticsSourceSectionProps {
  formData: Pick<
    EditUserFormData,
    'analyticsSource' | 'vercelProjectId' | 'vercelTeamId' | 'vercelConversionEvents'
  >;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

const inputClassName =
  'block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted';

// Wahl der Website-Analytics: GA4 (Standard) oder Vercel Web Analytics.
export default function AnalyticsSourceSection({
  formData,
  handleInputChange,
  isSubmitting,
}: AnalyticsSourceSectionProps) {
  const isVercel = formData.analyticsSource === 'vercel';

  return (
    <fieldset className="border-t pt-4 mt-4">
      <legend className="text-sm font-medium text-body mb-2">Website-Analytics</legend>

      <div className="mb-4">
        <label htmlFor="analyticsSource" className="block text-sm font-medium text-body">Quelle</label>
        <select
          id="analyticsSource"
          name="analyticsSource"
          value={formData.analyticsSource}
          onChange={handleInputChange}
          className={`mt-1 ${inputClassName}`}
          disabled={isSubmitting}
        >
          <option value="ga4">Google Analytics 4 (Standard)</option>
          <option value="vercel">Vercel Web Analytics</option>
        </select>
        {isVercel && (
          <p className="mt-1 text-xs text-muted">
            Vercel liefert Besucher, Seitenaufrufe, Referrer, Länder, Geräte und eigene Events. Sitzungen,
            neue Besucher, Interaktionsrate, Verweildauer und Absprungrate gibt es dort nicht; diese Kennzahlen
            werden im Dashboard ausgeblendet. Die GA4 Property ID wird in diesem Modus nicht abgefragt.
          </p>
        )}
      </div>

      {isVercel && (
        <>
          <div className="mb-4">
            <label htmlFor="vercelProjectId" className="block text-sm font-medium text-body">Vercel-Projekt</label>
            <input
              id="vercelProjectId"
              type="text"
              name="vercelProjectId"
              value={formData.vercelProjectId}
              onChange={handleInputChange}
              placeholder="Projektname oder ID, z. B. designare oder prj_…"
              className={`mt-1 ${inputClassName}`}
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="vercelTeamId" className="block text-sm font-medium text-body">Vercel-Team (optional)</label>
            <input
              id="vercelTeamId"
              type="text"
              name="vercelTeamId"
              value={formData.vercelTeamId}
              onChange={handleInputChange}
              placeholder="Team-Slug oder team_…; leer = Standard-Team von DataPeak"
              className={`mt-1 ${inputClassName}`}
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="vercelConversionEvents" className="block text-sm font-medium text-body">
              Conversion-Events (optional)
            </label>
            <input
              id="vercelConversionEvents"
              type="text"
              name="vercelConversionEvents"
              value={formData.vercelConversionEvents}
              onChange={handleInputChange}
              placeholder="Event-Namen mit Komma getrennt, z. B. kontakt_gesendet, anruf"
              className={`mt-1 ${inputClassName}`}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-muted">
              Eigene Events aus <code>track()</code>, die als Conversion zählen. Leer = keine Conversions im Dashboard.
            </p>
          </div>
        </>
      )}
    </fieldset>
  );
}
