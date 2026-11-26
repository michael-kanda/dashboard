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
    <fieldset className="mt-8">
      <legend className="dp-section-title">Semrush</legend>
  
      {/* Semrush Projekt ID */}
      <div className="mb-4">
        <label className="dp-label">
          Semrush Projekt ID
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            name="semrushProjectId"
            value={formData.semrushProjectId}
            onChange={handleInputChange} 
            placeholder="12920575"
            className="dp-field pr-10"
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
        <label className="dp-label">
          Semrush Tracking-ID (Kampagne 1)
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            name="semrushTrackingId"
            value={formData.semrushTrackingId}
            onChange={handleInputChange} 
            placeholder="1209408"
            className="dp-field pr-10"
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
        <label className="dp-label">
          Semrush Tracking-ID (Kampagne 2)
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            name="semrushTrackingId02"
            value={formData.semrushTrackingId02}
            onChange={handleInputChange} 
            placeholder="1209491"
            className="dp-field pr-10"
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
