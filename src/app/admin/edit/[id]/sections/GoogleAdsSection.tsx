// src/app/admin/edit/[id]/sections/GoogleAdsSection.tsx
'use client';

import { CheckCircle } from 'react-bootstrap-icons';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface GoogleAdsSectionProps {
  formData: Pick<EditUserFormData, 'googleAdsSheetId'>;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

export default function GoogleAdsSection({
  formData,
  handleInputChange,
  isSubmitting,
}: GoogleAdsSectionProps) {
  return (
    <fieldset className="mt-8">
      <legend className="dp-section-title">Google Ads</legend>
  
      {/* Google Ads Sheet ID */}
      <div>
        <label className="dp-label">
          Google Ads Sheet ID
        </label>
        <div className="relative mt-1">
          <input
            type="text"
            name="googleAdsSheetId"
            value={formData.googleAdsSheetId}
            onChange={handleInputChange} 
            placeholder="Google-Sheets-URL oder Spreadsheet-ID"
            className="dp-field pr-10"
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
  );
}
