// src/app/admin/edit/[id]/ProjectEditTabs.tsx
// Tab-Ansicht zum Bearbeiten eines Projekts (Rolle BENUTZER): Statuszeile oben,
// darunter Tabs. Alle Panels bleiben gerendert und werden nur per `hidden`
// ausgeblendet, damit ungespeicherte Eingaben beim Tab-Wechsel erhalten bleiben.
'use client';

import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { StatusDot } from '@/components/ui/Status';
import UserLogbook from '@/components/UserLogbook';
import LandingpageManager from './LandingpageManager';
import ProjectSupportManager, { type SupportStaff } from './ProjectSupportManager';

const TABS = [
  { id: 'zugang', label: 'Zugang' },
  { id: 'datenquellen', label: 'Datenquellen' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'localseo', label: 'Local SEO' },
  { id: 'betreuung', label: 'Betreuung' },
  { id: 'verlauf', label: 'Verlauf' },
] as const;

export type ProjectTabId = (typeof TABS)[number]['id'];
type FormTabId = Extract<ProjectTabId, 'zugang' | 'datenquellen' | 'dashboard' | 'localseo'>;

const DEFAULT_TAB: ProjectTabId = 'zugang';
const TAB_PARAM = 'tab';

export interface ProjectSupportData {
  staff: SupportStaff[];
  assignedIds: string[];
  creatorEmail: string | null;
}

export interface ProjectStatus {
  gscConnected: boolean;
  /** 'GA4' bzw. 'Vercel', wenn die gewählte Quelle konfiguriert ist, sonst null. */
  analytics: 'GA4' | 'Vercel' | null;
  googleAdsConnected: boolean;
}

interface ProjectEditTabsProps {
  projectId: string;
  /** Roher Wert aus `?tab=`; unbekannte Werte fallen auf „Zugang“ zurück. */
  initialTab?: string;
  /** Nur gesetzt, wenn der Betrachter die Betreuung verwalten darf. */
  support: ProjectSupportData | null;
  status: ProjectStatus;
  formId: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formPanels: Record<FormTabId, ReactNode>;
  /** Bereich oberhalb der Tabs, z. B. der Wartungsmodus-Hinweis. */
  banner?: ReactNode;
  /** Speichern-Leiste; bleibt unabhängig vom aktiven Tab sichtbar. */
  footer: ReactNode;
}

const tabDomId = (id: ProjectTabId) => `projekt-tab-${id}`;
const panelDomId = (id: ProjectTabId) => `projekt-tab-${id}-panel`;

function StatusTile({ label, value, ok, title }: { label: string; value: string; ok: boolean; title?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-secondary px-4 py-3">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 min-w-0 truncate" title={title ?? value}>
        <StatusDot tone={ok ? 'success' : 'off'}>{value}</StatusDot>
      </dd>
    </div>
  );
}

function TabPanel({ id, active, children }: { id: ProjectTabId; active: boolean; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={panelDomId(id)}
      aria-labelledby={tabDomId(id)}
      data-project-tab={id}
      hidden={!active}
      className="space-y-4 [&>:first-child]:mt-0 [&>fieldset:first-child]:border-t-0 [&>fieldset:first-child]:pt-0"
    >
      {children}
    </div>
  );
}

export default function ProjectEditTabs({
  projectId,
  initialTab,
  support,
  status,
  formId,
  onSubmit,
  formPanels,
  banner,
  footer,
}: ProjectEditTabsProps) {
  const tabs = TABS.filter((tab) => tab.id !== 'betreuung' || support !== null);
  const isTab = (value: unknown): value is ProjectTabId => tabs.some((tab) => tab.id === value);

  const [active, setActive] = useState<ProjectTabId>(() => (isTab(initialTab) ? initialTab : DEFAULT_TAB));
  const [assignedCount, setAssignedCount] = useState(support?.assignedIds.length ?? 0);
  const tabRefs = useRef<Partial<Record<ProjectTabId, HTMLButtonElement | null>>>({});
  const invalidHandled = useRef(false);

  const select = (id: ProjectTabId) => {
    setActive(id);
    // Tab in der URL merken (ohne Navigation), damit ein Reload ihn behält.
    const url = new URL(window.location.href);
    if (id === DEFAULT_TAB) url.searchParams.delete(TAB_PARAM);
    else url.searchParams.set(TAB_PARAM, id);
    window.history.replaceState(window.history.state, '', url);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    const id = tabs[next].id;
    select(id);
    tabRefs.current[id]?.focus();
  };

  // Ein ungültiges Feld in einem ausgeblendeten Tab würde das Absenden still blockieren
  // (der Browser kann es nicht fokussieren). Deshalb vorher zu dessen Tab wechseln.
  const handleInvalid = (event: FormEvent<HTMLFormElement>) => {
    if (invalidHandled.current) return;
    invalidHandled.current = true;
    window.setTimeout(() => {
      invalidHandled.current = false;
    }, 0);
    const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-project-tab]');
    const tab = panel?.dataset.projectTab;
    if (panel?.hidden && isTab(tab)) flushSync(() => select(tab));
  };

  const analyticsValue = status.analytics ?? 'nicht verbunden';
  const supportValue =
    assignedCount > 0 ? `${assignedCount} zugewiesen` : support?.creatorEmail ?? 'niemand zugewiesen';

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Projektstatus">
        <StatusTile label="GSC" value={status.gscConnected ? 'verbunden' : 'nicht verbunden'} ok={status.gscConnected} />
        <StatusTile label="Analytics" value={analyticsValue} ok={status.analytics !== null} />
        <StatusTile
          label="Google Ads"
          value={status.googleAdsConnected ? 'Sheet' : 'nicht verbunden'}
          ok={status.googleAdsConnected}
        />
        {support && (
          <StatusTile
            label="Betreuung"
            value={supportValue}
            ok={assignedCount > 0 || support.creatorEmail !== null}
            title={assignedCount === 0 && support.creatorEmail ? `Ersteller: ${support.creatorEmail}` : undefined}
          />
        )}
      </dl>

      {banner}

      <div className="max-w-full overflow-x-auto">
        <div role="tablist" aria-label="Projekt bearbeiten" className="inline-flex rounded-[9px] bg-fill p-0.5">
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[tab.id] = element;
                }}
                type="button"
                role="tab"
                id={tabDomId(tab.id)}
                aria-selected={selected}
                aria-controls={panelDomId(tab.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={handleKeyDown}
                className={`h-8 whitespace-nowrap rounded-[7px] px-3 text-[14px] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent
                  ${selected ? 'bg-surface font-semibold text-heading shadow-segment' : 'font-medium text-secondary hover:text-heading'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <form id={formId} onSubmit={onSubmit} onInvalidCapture={handleInvalid}>
        <TabPanel id="zugang" active={active === 'zugang'}>{formPanels.zugang}</TabPanel>
        <TabPanel id="datenquellen" active={active === 'datenquellen'}>{formPanels.datenquellen}</TabPanel>
        <TabPanel id="dashboard" active={active === 'dashboard'}>{formPanels.dashboard}</TabPanel>
        <TabPanel id="localseo" active={active === 'localseo'}>{formPanels.localseo}</TabPanel>
      </form>

      {/* Betreuung und Verlauf speichern sofort über eigene Aktionen und liegen daher außerhalb des Formulars. */}
      {support && (
        <TabPanel id="betreuung" active={active === 'betreuung'}>
          <ProjectSupportManager
            projectId={projectId}
            staff={support.staff}
            assignedIds={support.assignedIds}
            creatorEmail={support.creatorEmail}
            onAssignedCountChange={setAssignedCount}
          />
        </TabPanel>
      )}
      <TabPanel id="verlauf" active={active === 'verlauf'}>
        <LandingpageManager userId={projectId} />
        <UserLogbook userId={projectId} />
      </TabPanel>

      {footer}
    </div>
  );
}
