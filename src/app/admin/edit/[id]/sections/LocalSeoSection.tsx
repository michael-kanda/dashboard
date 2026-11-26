// src/app/admin/edit/[id]/sections/LocalSeoSection.tsx
'use client';

import type { ProjectLocation } from '@/types';
import { listToCsv, csvToList } from './edit-user-form-helpers';

interface LocalSeoSectionProps {
  projectLocations: ProjectLocation[];
  addProjectLocation: () => void;
  removeProjectLocation: (index: number) => void;
  updateProjectLocation: (
    index: number,
    field: keyof ProjectLocation,
    value: string | number | null | string[]
  ) => void;
  isSubmitting: boolean;
}

export default function LocalSeoSection({
  projectLocations,
  addProjectLocation,
  removeProjectLocation,
  updateProjectLocation,
  isSubmitting,
}: LocalSeoSectionProps) {
  return (
    <fieldset className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <legend className="dp-section-title mb-0">Standorte / Local SEO</legend>
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
                  <label className="dp-label text-[13px]">Name *</label>
                  <input
                    type="text"
                    value={location.name}
                    onChange={(event) => updateProjectLocation(index, 'name', event.target.value)}
                    placeholder="Wien Innenstadt"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="dp-label text-[13px]">PLZ</label>
                  <input
                    type="text"
                    value={location.postalCode || ''}
                    onChange={(event) => updateProjectLocation(index, 'postalCode', event.target.value)}
                    placeholder="1010"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="dp-label text-[13px]">Stadt</label>
                  <input
                    type="text"
                    value={location.city || ''}
                    onChange={(event) => updateProjectLocation(index, 'city', event.target.value)}
                    placeholder="Wien"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="dp-label text-[13px]">Land</label>
                  <input
                    type="text"
                    value={location.country || 'AT'}
                    onChange={(event) => updateProjectLocation(index, 'country', event.target.value)}
                    placeholder="AT"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="dp-label text-[13px]">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={location.lat ?? ''}
                    onChange={(event) => updateProjectLocation(index, 'lat', event.target.value === '' ? null : Number(event.target.value))}
                    placeholder="48.2082"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="dp-label text-[13px]">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={location.lng ?? ''}
                    onChange={(event) => updateProjectLocation(index, 'lng', event.target.value === '' ? null : Number(event.target.value))}
                    placeholder="16.3738"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dp-label text-[13px]">Google Place ID</label>
                  <input
                    type="text"
                    value={location.googlePlaceId || ''}
                    onChange={(event) => updateProjectLocation(index, 'googlePlaceId', event.target.value)}
                    placeholder="ChIJ..."
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-[12px] text-muted">
                    Optional, aber empfohlen. Echte Place IDs beginnen meist mit ChIJ. Reine Zahlen sind CIDs und werden ignoriert.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="dp-label text-[13px]">Google Unternehmensprofil URL / Maps-Link</label>
                  <input
                    type="url"
                    value={location.googleBusinessProfileUrl || ''}
                    onChange={(event) => updateProjectLocation(index, 'googleBusinessProfileUrl', event.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dp-label text-[13px]">Google Unternehmensprofil Bild URL</label>
                  <input
                    type="url"
                    value={location.googleBusinessProfileImageUrl || ''}
                    onChange={(event) => updateProjectLocation(index, 'googleBusinessProfileImageUrl', event.target.value)}
                    placeholder="https://..."
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dp-label text-[13px]">Landingpages (kommagetrennt)</label>
                  <input
                    type="text"
                    value={listToCsv(location.landingPages)}
                    onChange={(event) => updateProjectLocation(index, 'landingPages', csvToList(event.target.value))}
                    placeholder="/rechtsanwalt-wien/, /standort-wien/"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="dp-label text-[13px]">Keywords/Aliase (kommagetrennt)</label>
                  <input
                    type="text"
                    value={listToCsv(location.keywords)}
                    onChange={(event) => updateProjectLocation(index, 'keywords', csvToList(event.target.value))}
                    placeholder="wien, 1010, innere stadt, rechtsanwalt wien"
                    className="dp-field mt-1"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
