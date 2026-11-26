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
  'dp-field';

// Wahl der Website-Analytics: GA4 (Standard) oder Vercel Web Analytics.
export default function AnalyticsSourceSection({
  formData,
  handleInputChange,
  isSubmitting,
}: AnalyticsSourceSectionProps) {
  const isVercel = formData.analyticsSource === 'vercel';

  return (
    <fieldset className="mt-8">
      <legend className="dp-section-title">Website-Analytics</legend>

      <div className="mb-4">
        <label htmlFor="analyticsSource" className="dp-label">Quelle</label>
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
            <label htmlFor="vercelProjectId" className="dp-label">Vercel-Projekt</label>
            <input
              id="vercelProjectId"
              type="text"
              name="vercelProjectId"
              value={formData.vercelProjectId}
              onChange={handleInputChange}
              placeholder="designare oder prj_…"
              className={`mt-1 ${inputClassName}`}
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="vercelTeamId" className="dp-label">Vercel-Team <span className="dp-label-optional">· optional</span></label>
            <input
              id="vercelTeamId"
              type="text"
              name="vercelTeamId"
              value={formData.vercelTeamId}
              onChange={handleInputChange}
              placeholder="team_…"
              className={`mt-1 ${inputClassName}`}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-muted">Team-Slug oder ID. Leer lassen für das Standard-Team von DataPeak.</p>
          </div>

          <div className="mb-4">
            <label htmlFor="vercelConversionEvents" className="dp-label">
              Conversion-Events <span className="dp-label-optional">· optional</span>
            </label>
            <input
              id="vercelConversionEvents"
              type="text"
              name="vercelConversionEvents"
              value={formData.vercelConversionEvents}
              onChange={handleInputChange}
              placeholder="kontakt_gesendet, anruf"
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
