// src/app/admin/edit/[id]/sections/SemrushSection.tsx
'use client';

import { CheckCircle } from 'react-bootstrap-icons';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface SemrushSectionProps {
  formData: Pick<EditUserFormData, 'semrushProjectId' | 'semrushTrackingId' | 'semrushTrackingId02'>;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

export default function SemrushSection({
  formData,
  handleInputChange,
  isSubmitting,
}: SemrushSectionProps) {
  return (
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
  );
}
