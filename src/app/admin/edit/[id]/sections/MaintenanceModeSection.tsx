// src/app/admin/edit/[id]/sections/MaintenanceModeSection.tsx
'use client';

import {
  ToggleOn,
  ToggleOff,
  ConeStriped,
  ExclamationTriangle,
} from 'react-bootstrap-icons';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface MaintenanceModeSectionProps {
  canSetMaintenanceMode: boolean;
  formData: Pick<EditUserFormData, 'maintenance_mode'>;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

// Wartungsmodus-Schalter bzw. Hinweis für Superadmins.
export default function MaintenanceModeSection({
  canSetMaintenanceMode,
  formData,
  handleInputChange,
  isSubmitting,
}: MaintenanceModeSectionProps) {
  return (
    <>
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
    </>
  );
}
