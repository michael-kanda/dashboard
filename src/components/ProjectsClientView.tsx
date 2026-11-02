// src/components/ProjectsClientView.tsx
'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, FileEarmarkText, Globe } from 'react-bootstrap-icons';
import { addMonths } from 'date-fns';
import type { ProjectStats } from '@/lib/schemas';
import { formatDate } from '@/lib/ui-labels';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SearchField } from '@/components/ui/SearchField';
import { ButtonLink } from '@/components/ui/Button';
import { DataList, DataListHead, EmptyRow, PrimaryCell, Td, Th, Tr } from '@/components/ui/DataList';
import { StackedStatusBar, StatusDot, TrendPill } from '@/components/ui/Status';
import { AvatarStack } from '@/components/ui/AvatarStack';

interface Props {
  initialProjects: ProjectStats[];
}

type ProjectFilter = 'alle' | 'aktiv' | 'ohne';

const FILTERS: { value: ProjectFilter; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'ohne', label: 'Ohne Landingpages' },
];

function timelineRange(user: ProjectStats): string | null {
  if (!user.project_timeline_active) return null;
  const start = user.project_start_date ? new Date(user.project_start_date) : new Date(user.createdAt || new Date());
  const end = addMonths(start, user.project_duration_months || 6);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default function ProjectsClientView({ initialProjects }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('alle');

  // Filter nur clientseitig auf den bereits geladenen Daten.
  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return initialProjects.filter((user) => {
      const matchesSearch = user.email.toLowerCase().includes(term)
        || (user.domain && user.domain.toLowerCase().includes(term));
      if (!matchesSearch) return false;
      const landingpages = user.landingpages_count || 0;
      if (filter === 'aktiv') return Boolean(user.project_timeline_active) || landingpages > 0;
      if (filter === 'ohne') return landingpages === 0;
      return true;
    });
  }, [initialProjects, searchTerm, filter]);

  const isFiltered = filteredProjects.length !== initialProjects.length;

  return (
    <PageContainer>
      <PageHeader
        title="Projekte"
        count={initialProjects.length}
        subtitle={isFiltered ? `${filteredProjects.length} von ${initialProjects.length} Projekten angezeigt` : undefined}
      >
        <SegmentedControl label="Projekte filtern" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchField
          label="Projekte durchsuchen"
          placeholder="Projekt, Domain oder E-Mail"
          value={searchTerm}
          onChange={setSearchTerm}
        />
      </PageHeader>

      <DataList label="Projekte" minWidth={1040}>
        <DataListHead>
          <Th>Projekt</Th>
          <Th>Trend</Th>
          <Th>Zeitplan</Th>
          <Th>Redaktionsplan</Th>
          <Th>Landingpages</Th>
          <Th>Betreuung</Th>
          <Th className="text-right"><span className="sr-only">Aktion</span></Th>
        </DataListHead>
        <tbody>
          {filteredProjects.map((user) => {
            const landingpages = user.landingpages_count || 0;
            const range = timelineRange(user);
            const admins = user.assigned_admins
              ? user.assigned_admins.split(', ')
              : user.creator_email ? [user.creator_email] : [];
            const change = user.total_impression_change;

            return (
              <Tr key={user.id}>
                <Td>
                  <PrimaryCell icon={<Globe size={16} />} title={user.domain || 'Keine Domain'} subtitle={user.email} />
                </Td>
                <Td title="Reichweiten-Trend (GSC)">
                  {change === undefined || change === null ? <span className="text-muted">–</span> : <TrendPill value={change} />}
                </Td>
                <Td>
                  {range ? <StatusDot tone="success">{range}</StatusDot> : <StatusDot tone="off">Deaktiviert</StatusDot>}
                </Td>
                <Td>
                  {landingpages > 0 ? (
                    <ButtonLink href={`/admin/redaktionsplan?id=${user.id}`} variant="plain" size="sm" className="-ml-3">
                      <FileEarmarkText size={14} aria-hidden="true" />
                      Öffnen
                    </ButtonLink>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </Td>
                <Td>
                  {landingpages > 0 ? (
                    <StackedStatusBar
                      approved={user.landingpages_freigegeben || 0}
                      review={user.landingpages_in_pruefung || 0}
                      open={user.landingpages_offen || 0}
                      blocked={user.landingpages_gesperrt || 0}
                      total={landingpages}
                    />
                  ) : (
                    <span className="text-muted">Keine</span>
                  )}
                </Td>
                <Td>
                  <AvatarStack emails={admins} emptyLabel="System" />
                </Td>
                <Td className="text-right">
                  <ButtonLink href={`/projekt/${user.id}`} aria-label={`${user.domain || user.email} öffnen`}>
                    Öffnen
                    <ChevronRight size={12} aria-hidden="true" />
                  </ButtonLink>
                </Td>
              </Tr>
            );
          })}
          {filteredProjects.length === 0 && <EmptyRow colSpan={7}>Keine Projekte gefunden</EmptyRow>}
        </tbody>
      </DataList>
    </PageContainer>
  );
}
