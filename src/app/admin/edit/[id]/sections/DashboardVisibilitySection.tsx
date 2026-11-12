// src/app/admin/edit/[id]/sections/DashboardVisibilitySection.tsx
'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ToggleOn, ToggleOff } from 'react-bootstrap-icons';
import {
  DASHBOARD_WIDGET_DEFINITIONS,
  normalizeDashboardWidgetVisibility,
  type DashboardWidgetVisibility,
} from '@/lib/dashboard-widget-visibility';

interface DashboardVisibilitySectionProps {
  widgetVisibility: DashboardWidgetVisibility;
  setWidgetVisibility: Dispatch<SetStateAction<DashboardWidgetVisibility>>;
  isSubmitting: boolean;
}

export default function DashboardVisibilitySection({
  widgetVisibility,
  setWidgetVisibility,
  isSubmitting,
}: DashboardVisibilitySectionProps) {
  return (
    <fieldset className="border-t pt-4 mt-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <legend className="text-sm font-medium text-body">Dashboard-Sichtbarkeit</legend>
          <p className="mt-1 text-xs text-muted">
            Steuert die Kundenansicht. Admins sehen verfügbare Widgets weiterhin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWidgetVisibility(normalizeDashboardWidgetVisibility(
              Object.fromEntries(DASHBOARD_WIDGET_DEFINITIONS.map(({ key }) => [key, true]))
            ))}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-secondary disabled:opacity-50"
          >
            Alle anzeigen
          </button>
          <button
            type="button"
            onClick={() => setWidgetVisibility(normalizeDashboardWidgetVisibility(
              Object.fromEntries(DASHBOARD_WIDGET_DEFINITIONS.map(({ key }) => [key, false]))
            ))}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-body hover:bg-surface-secondary disabled:opacity-50"
          >
            Alle ausblenden
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {Array.from(new Set(DASHBOARD_WIDGET_DEFINITIONS.map(({ group }) => group))).map((group) => (
          <section key={group}>
            <h4 className="mb-2 text-xs font-semibold text-muted">{group}</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DASHBOARD_WIDGET_DEFINITIONS
                .filter((widget) => widget.group === group)
                .map((widget) => {
                  const enabled = widgetVisibility[widget.key];
                  return (
                    <label
                      key={widget.key}
                      htmlFor={`widget-${widget.key}`}
                      className="flex min-h-[72px] cursor-pointer items-start justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2.5"
                    >
                      <span>
                        <span className="block text-sm font-medium text-body">{widget.label}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-muted">{widget.description}</span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          id={`widget-${widget.key}`}
                          checked={enabled}
                          onChange={() => setWidgetVisibility((current) => ({
                            ...current,
                            [widget.key]: !current[widget.key],
                          }))}
                          disabled={isSubmitting}
                          className="sr-only"
                        />
                        {enabled ? (
                          <ToggleOn size={26} className="text-success" />
                        ) : (
                          <ToggleOff size={26} className="text-muted" />
                        )}
                      </span>
                    </label>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </fieldset>
  );
}
