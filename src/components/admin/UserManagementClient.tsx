// src/components/admin/UserManagementClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/schemas';
import {
  Pencil, Trash, PersonPlus, ArrowRepeat, People, PersonVideo, Briefcase,
  Globe, CalendarRange, CheckCircleFill, Circle, Link45deg, Search // ✅ Search importiert
} from 'react-bootstrap-icons'; 
import { toast } from 'sonner';
import LogoManager from '@/app/admin/LogoManager';
import LoginLogbook from '@/app/admin/LoginLogbook';

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

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-blue-100 text-blue-800';
      case 'BENUTZER': return 'bg-green-100 text-green-800';
      case 'SUPERADMIN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,2fr)]">
        
      {/* CREATE FORMULAR */}
      <div className="admin-panel h-fit p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-heading">
          <PersonPlus size={18} className="text-blue-600" /> Neuen Nutzer anlegen
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zugangsdaten</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rolle</label>
                <select
                  name="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'BENUTZER' | 'ADMIN')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  disabled={isSubmitting}
                >
                  <option value="BENUTZER">Kunde (Benutzer)</option>
                  {isSuperAdmin && <option value="ADMIN">Admin</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                <input name="email" type="email" required placeholder="kunde@firma.at" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
                <input name="password" type="text" required placeholder="Sicheres Passwort" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
                <input name="mandant_id" type="text" required readOnly={!isSuperAdmin} defaultValue={!isSuperAdmin ? sessionUser.mandant_id || '' : undefined} placeholder={isSuperAdmin ? "z.B. max-online" : "Wird geerbt"} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 text-sm placeholder:text-gray-400" disabled={isSubmitting || !isSuperAdmin} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Ansprache</label>
                <input name="ansprache" type="text" placeholder="z.B. Herr Muster oder Frau Muster" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
              </div>
          </div>

          {isSuperAdmin && selectedRole === 'ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Berechtigungen</label>
              <input name="permissions" type="text" placeholder="z.B. label1, label2" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" disabled={isSubmitting} />
            </div>
          )}

          {selectedRole === 'BENUTZER' && (
            <>
              {/* PROJEKT ZEITPLAN */}
              <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <CalendarRange size={14} className="text-indigo-600"/>
                          Projekt-Zeitplan
                      </label>
                      <button
                          type="button"
                          onClick={() => setIsTimelineActive(!isTimelineActive)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isTimelineActive ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                          <span className="sr-only">Zeitplan aktivieren</span>
                          <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isTimelineActive ? 'translate-x-5' : 'translate-x-0'}`}>
                              {isTimelineActive && <CheckCircleFill className="text-green-500 w-3 h-3 absolute top-1 left-1" />}
                          </span>
                      </button>
                  </div>

                  {isTimelineActive ? (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 text-xs text-green-700 font-medium mb-1">
                              <CheckCircleFill /> Timeline aktiv
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Startdatum</label>
                              <input name="project_start_date" type="date" className="block w-full px-2 py-1.5 border border-green-200 rounded text-sm focus:border-green-500 focus:ring-green-500" />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Laufzeit (Monate)</label>
                              <input name="project_duration_months" type="number" defaultValue={6} min={1} className="block w-full px-2 py-1.5 border border-green-200 rounded text-sm focus:border-green-500 focus:ring-green-500" />
                          </div>
                      </div>
                  ) : (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                          <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
                              <Circle size={10} /> Zeitplan inaktiv (Standard)
                          </span>
                      </div>
                  )}
              </div>

              {/* WEB DATEN / APIs */}
              <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Globe size={14} className="text-indigo-600" /> Web-Daten & APIs
                  </h3>
                  
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-medium text-gray-700">Domain</label>
                          <div className="relative mt-1 rounded-md shadow-sm">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                  <Link45deg className="text-gray-400" size={14} />
                              </div>
                              <input name="domain" type="text" required placeholder="z.B. kundendomain.at" className="block w-full rounded-md border-gray-300 pl-9 focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2" disabled={isSubmitting} />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-gray-700">Favicon URL (Optional)</label>
                          <input name="favicon_url" type="text" placeholder="https://example.com/icon.png" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-gray-700">GSC Site URL</label>
                          <input name="gsc_site_url" type="text" placeholder="sc-domain:example.com" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                              <label className="block text-xs font-medium text-gray-700">GA4 ID</label>
                              <input name="ga4_property_id" type="text" placeholder="12345678" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-700">Semrush Project ID</label>
                              <input name="semrush_project_id" type="text" placeholder="123456" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                              <label className="block text-xs font-medium text-gray-700">Semrush Tracking-ID (Kampagne 1)</label>
                              <input name="semrush_tracking_id" type="text" placeholder="Tracking ID 1" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-700">Semrush Tracking-ID (Kampagne 2)</label>
                              <input name="semrush_tracking_id_02" type="text" placeholder="Tracking ID 2" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder:text-gray-400" disabled={isSubmitting} />
                          </div>
                      </div>
                  </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? <ArrowRepeat className="animate-spin" size={18} /> : <PersonPlus size={18} />}
            {isSubmitting ? 'Speichere...' : (selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen')}
          </button>
        </form>
      </div>

      {/* LISTE (Rechts) */}
      <div className="admin-panel min-w-0 p-5">
        
        {/* ✅ NEU: Header mit Suchfeld */}
        <div className="mb-5 flex flex-col items-start justify-between gap-4 border-b border-theme-border-subtle pb-4 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-base font-semibold text-heading">
                <People size={18} className="text-blue-600" /> Vorhandene Nutzer
                <span className="rounded-md bg-surface-tertiary px-2 py-0.5 text-[11px] text-muted">{filteredUsers.length}</span>
            </h2>
            
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Suchen..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-gray-50 focus:bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center text-gray-400 p-8">
            <People size={32} className="mx-auto mb-2" />
            <p>{users.length === 0 ? 'Keine Benutzer vorhanden.' : 'Keine Ergebnisse für deine Suche.'}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredUsers.map((user) => ( // ✅ Nutzt jetzt filteredUsers
                <li key={user.id} className="flex h-full flex-col justify-between gap-3 rounded-md bg-surface-secondary p-4 transition-colors hover:bg-surface-tertiary animate-in fade-in duration-300">
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-900 truncate" title={user.email}>{user.email}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${getRoleStyle(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    
                    {user.mandant_id && <p className="text-xs text-indigo-600 font-medium truncate">Label: {user.mandant_id}</p>}
                    {user.ansprache && <p className="text-xs text-gray-500 font-medium truncate">Ansprache: {user.ansprache}</p>}
                    {user.domain && <p className="text-sm text-blue-600 font-medium truncate mt-1">{user.domain}</p>}

                    {user.role === 'BENUTZER' && user.assigned_admins && (
                      <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                        <PersonVideo size={12} /> <span className="font-medium">Betreuer:</span> {user.assigned_admins}
                      </div>
                    )}

                    {user.role === 'ADMIN' && user.assigned_projects && (
                      <div className="mt-2 text-xs text-gray-600 flex items-start gap-1">
                        <Briefcase size={12} className="mt-0.5 flex-shrink-0" />
                        <span className="text-gray-500 line-clamp-2">{user.assigned_projects}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2 border-t border-theme-border-subtle pt-3">
                    <Link href={`/admin/edit/${user.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-theme-border-default bg-surface px-3 py-1.5 text-xs font-medium text-body transition hover:bg-surface-secondary">
                      <Pencil size={14} /> Bearbeiten
                    </Link>
                    {isSuperAdmin && (
                      <button onClick={() => void handleDelete(user.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-surface px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                        <Trash size={14} /> Löschen
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {isSuperAdmin && (
        <div className="col-span-full mt-1 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LogoManager />
          <LoginLogbook />
        </div>
      )}
    </div>
  );
}
