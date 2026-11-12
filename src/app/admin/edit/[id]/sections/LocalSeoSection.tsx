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
  );
}
