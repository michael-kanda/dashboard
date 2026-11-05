// src/components/admin/UserManagementClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent, type ReactNode } from 'react';
import type { User } from '@/lib/schemas';
import { PersonCircle, PersonPlus } from 'react-bootstrap-icons';
import { toast } from 'sonner';
import LogoManager from '@/app/admin/LogoManager';
import LoginLogbook from '@/app/admin/LoginLogbook';
import { roleLabel } from '@/lib/ui-labels';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { SearchField } from '@/components/ui/SearchField';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataList, DataListHead, EmptyRow, PrimaryCell, Td, Th, Tr } from '@/components/ui/DataList';
import { GroupedSection } from '@/components/ui/GroupedList';
import { StatusPill } from '@/components/ui/Status';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { Toggle } from '@/components/ui/Toggle';
import { Dialog } from '@/components/ui/Dialog';
import { inputClasses } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';

// Formularzeile einer Grouped List: Label links, Feld rechts.
function FormRow({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border-subtle px-[18px] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor={id} className="text-[14px] text-heading sm:w-44 sm:flex-shrink-0">{label}</label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface Props {
  initialUsers: User[];
  sessionUser: {
    role: string;
    mandant_id?: string | null;
  };
}

export default function UserManagementClient({ initialUsers, sessionUser }: Props) {
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selectedRole, setSelectedRole] = useState<'BENUTZER' | 'ADMIN'>('BENUTZER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimelineActive, setIsTimelineActive] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // ✅ NEU: Such-State
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = sessionUser.role === 'SUPERADMIN';

  // ✅ NEU: Filter-Logik (wie in ProjectsClientView)
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.ansprache && user.ansprache.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.domain && user.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.mandant_id && user.mandant_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const refreshUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const loadingToast = toast.loading('Erstelle Benutzer...');
    setIsSubmitting(true); 

    const formData = new FormData(e.currentTarget);
    formData.set('project_timeline_active', isTimelineActive ? 'true' : 'false');
    const rawData = Object.fromEntries(formData) as Record<string, unknown>;

    const payload = { 
      ...rawData, 
      role: selectedRole,
      project_timeline_active: isTimelineActive,
      permissions: (isSuperAdmin && selectedRole === 'ADMIN') 
        ? (rawData.permissions as string || '').split(',').map(p => p.trim()).filter(p => p.length > 0) 
        : [] 
    };

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Fehler');

      toast.dismiss(loadingToast);
      toast.success(`Benutzer "${result.email}" erstellt!`);

      (e.target as HTMLFormElement).reset();
      setIsTimelineActive(false);
      setSelectedRole('BENUTZER');
      setIsCreateOpen(false);
      await refreshUsers();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Fehler beim Erstellen', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    } finally {
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Nutzer wirklich löschen?')) return;
    
    const previousUsers = [...users];
    setUsers(users.filter(u => u.id !== userId));
    
    const loadingToast = toast.loading('Lösche Benutzer...');

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Fehler beim Löschen');
      
      toast.dismiss(loadingToast);
      toast.success('Benutzer gelöscht');
      router.refresh();
    } catch (error) {
      setUsers(previousUsers);
      toast.dismiss(loadingToast);
      toast.error('Löschen fehlgeschlagen', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Admin-Bereich" count={users.length} subtitle="Benutzer, Projekte und Mandanten verwalten">
        <SearchField
          label="Nutzer durchsuchen"
          placeholder="E-Mail, Ansprache, Domain oder Label"
          value={searchTerm}
          onChange={setSearchTerm}
        />
        <Button onClick={() => setIsCreateOpen(true)}>
          <PersonPlus size={16} aria-hidden="true" />
          Neuer Nutzer
        </Button>
      </PageHeader>

      <DataList label="Nutzer" minWidth={960}>
        <DataListHead>
          <Th>Nutzer</Th>
          <Th>Rolle</Th>
          <Th>Label</Th>
          <Th>Domain</Th>
          <Th>Betreuung</Th>
          <Th className="text-right"><span className="sr-only">Aktionen</span></Th>
        </DataListHead>
        <tbody>
          {filteredUsers.map((user) => {
            const projects = user.assigned_projects ? user.assigned_projects.split(', ').filter(Boolean) : [];
            return (
              <Tr key={user.id}>
                <Td>
                  <PrimaryCell icon={<PersonCircle size={16} />} title={user.email} subtitle={user.ansprache || undefined} />
                </Td>
                <Td><StatusPill>{roleLabel(user.role)}</StatusPill></Td>
                <Td className="text-muted">{user.mandant_id || '–'}</Td>
                <Td>
                  {user.domain ? (
                    <a
                      href={/^https?:\/\//.test(user.domain) ? user.domain : `https://${user.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {user.domain}
                    </a>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </Td>
                <Td>
                  {user.role === 'ADMIN' ? (
                    projects.length > 0 ? (
                      <span className="text-muted tabular-nums" title={projects.join(', ')}>
                        {projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'}
                      </span>
                    ) : (
                      <span className="text-muted">–</span>
                    )
                  ) : (
                    <AvatarStack emails={user.assigned_admins ? user.assigned_admins.split(', ') : []} />
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <ButtonLink href={`/admin/edit/${user.id}`} aria-label={`${user.email} bearbeiten`}>Bearbeiten</ButtonLink>
                    {isSuperAdmin && (
                      <Button variant="destructive" size="sm" onClick={() => void handleDelete(user.id)} aria-label={`${user.email} löschen`}>
                        Löschen
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
          {filteredUsers.length === 0 && (
            <EmptyRow colSpan={6}>{users.length === 0 ? 'Keine Benutzer vorhanden' : 'Keine Ergebnisse für die Suche'}</EmptyRow>
          )}
        </tbody>
      </DataList>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-2">
          <LogoManager />
          <LoginLogbook />
        </div>
      )}

      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Neuen Nutzer anlegen"
        variant="sheet"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Abbrechen</Button>
            <Button type="submit" form="create-user-form" disabled={isSubmitting}>
              {isSubmitting && <Spinner size={14} className="" />}
              {isSubmitting ? 'Speichere …' : (selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen')}
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
          <GroupedSection title="Zugangsdaten">
            <FormRow id="new-role" label="Rolle">
              <select
                id="new-role"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'BENUTZER' | 'ADMIN')}
                className={inputClasses}
                disabled={isSubmitting}
              >
                <option value="BENUTZER">Kunde (Benutzer)</option>
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
              </select>
            </FormRow>
            <FormRow id="new-email" label="E-Mail">
              <input id="new-email" name="email" type="email" required placeholder="kunde@firma.at" className={inputClasses} disabled={isSubmitting} />
            </FormRow>
            <FormRow id="new-password" label="Initial-Passwort">
              <input id="new-password" name="password" type="text" autoComplete="new-password" required minLength={10} placeholder="Mindestens 10 Zeichen" className={inputClasses} disabled={isSubmitting} />
            </FormRow>
            <FormRow id="new-mandant" label="Mandant-ID (Label)">
              <input
                id="new-mandant"
                name="mandant_id"
                type="text"
                required
                readOnly={!isSuperAdmin}
                defaultValue={!isSuperAdmin ? sessionUser.mandant_id || '' : undefined}
                placeholder={isSuperAdmin ? 'z. B. max-online' : 'Wird geerbt'}
                className={inputClasses}
                disabled={isSubmitting || !isSuperAdmin}
              />
            </FormRow>
            <FormRow id="new-ansprache" label="Ansprache">
              <input id="new-ansprache" name="ansprache" type="text" placeholder="z. B. Herr Muster oder Frau Muster" className={inputClasses} disabled={isSubmitting} />
            </FormRow>
            {isSuperAdmin && selectedRole === 'ADMIN' && (
              <FormRow id="new-permissions" label="Berechtigungen">
                <input id="new-permissions" name="permissions" type="text" placeholder="z. B. label1, label2" className={inputClasses} disabled={isSubmitting} />
              </FormRow>
            )}
          </GroupedSection>

          {selectedRole === 'BENUTZER' && (
            <>
              <GroupedSection title="Projekt-Zeitplan" help={isTimelineActive ? 'Timeline aktiv' : 'Zeitplan inaktiv (Standard)'}>
                <div className="flex min-h-11 items-center justify-between gap-4 border-b border-border-subtle px-[18px] py-2.5 last:border-b-0">
                  <span className="text-[14px] text-heading">Zeitplan aktivieren</span>
                  <Toggle checked={isTimelineActive} onChange={setIsTimelineActive} label="Zeitplan aktivieren" />
                </div>
                {isTimelineActive && (
                  <>
                    <FormRow id="new-start" label="Startdatum">
                      <input id="new-start" name="project_start_date" type="date" className={inputClasses} />
                    </FormRow>
                    <FormRow id="new-duration" label="Laufzeit (Monate)">
                      <input id="new-duration" name="project_duration_months" type="number" defaultValue={6} min={1} className={inputClasses} />
                    </FormRow>
                  </>
                )}
              </GroupedSection>

              <GroupedSection title="Web-Daten & APIs">
                <FormRow id="new-domain" label="Domain">
                  <input id="new-domain" name="domain" type="text" required placeholder="z. B. kundendomain.at" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-favicon" label="Favicon URL (optional)">
                  <input id="new-favicon" name="favicon_url" type="text" placeholder="https://example.com/icon.png" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-gsc" label="GSC Site URL">
                  <input id="new-gsc" name="gsc_site_url" type="text" placeholder="sc-domain:example.com" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-ga4" label="GA4 ID">
                  <input id="new-ga4" name="ga4_property_id" type="text" placeholder="12345678" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-semrush" label="Semrush Project ID">
                  <input id="new-semrush" name="semrush_project_id" type="text" placeholder="123456" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-semrush-1" label="Semrush Tracking-ID (Kampagne 1)">
                  <input id="new-semrush-1" name="semrush_tracking_id" type="text" placeholder="Tracking ID 1" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
                <FormRow id="new-semrush-2" label="Semrush Tracking-ID (Kampagne 2)">
                  <input id="new-semrush-2" name="semrush_tracking_id_02" type="text" placeholder="Tracking ID 2" className={inputClasses} disabled={isSubmitting} />
                </FormRow>
              </GroupedSection>
            </>
          )}
        </form>
      </Dialog>
    </PageContainer>
  );
}
