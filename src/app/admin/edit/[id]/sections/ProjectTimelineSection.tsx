// src/app/admin/edit/[id]/sections/ProjectTimelineSection.tsx
'use client';

import {
  CheckCircle,
  CalendarEvent,
  ClockHistory,
  ToggleOn,
  ToggleOff,
} from 'react-bootstrap-icons';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface ProjectTimelineSectionProps {
  formData: Pick<EditUserFormData, 'project_timeline_active' | 'project_start_date' | 'project_duration_months'>;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

export default function ProjectTimelineSection({
  formData,
  handleInputChange,
  isSubmitting,
}: ProjectTimelineSectionProps) {
  return (
    <fieldset className="border-t pt-4 mt-4">
      <legend className="text-sm font-medium text-body mb-2">Projekt-Timeline</legend>
  
      <div className="mb-4">
        <label 
          htmlFor="project_timeline_active" 
          className="flex items-center gap-2 text-sm font-medium text-body cursor-pointer"
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
            className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
          />
          {formData.project_timeline_active ? (
            <ToggleOn size={20} className="text-success" />
          ) : (
            <ToggleOff size={20} className="text-muted" />
          )}
          Projekt-Timeline Widget auf Dashboard anzeigen
        </label>
      </div>

      {/* Startdatum & Dauer (nur sichtbar wenn Timeline aktiv ist) */}
      {formData.project_timeline_active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Startdatum */}
          <div>
            <label className="block text-sm font-medium text-body flex items-center gap-1">
              <CalendarEvent size={14} /> Projekt-Startdatum
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                name="project_start_date"
                value={formData.project_start_date}
                onChange={handleInputChange} 
                className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
                disabled={isSubmitting}
              />
              {formData.project_start_date && !isSubmitting && (
                <CheckCircle 
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-success pointer-events-none" 
                  size={16}
                />
              )}
            </div>
          </div>

          {/* Dauer */}
          <div>
            <label className="block text-sm font-medium text-body flex items-center gap-1">
              <ClockHistory size={14} /> Projektdauer (Monate)
            </label>
            <div className="relative mt-1">
              <select
                name="project_duration_months"
                value={formData.project_duration_months}
                onChange={handleInputChange} 
                className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                <option value="6">6 Monate</option>
                <option value="12">12 Monate</option>
                <option value="18">18 Monate</option>
                <option value="24">24 Monate</option>
              </select>
              {formData.project_duration_months && !isSubmitting && (
                <CheckCircle 
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-success pointer-events-none" 
                  size={16}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
