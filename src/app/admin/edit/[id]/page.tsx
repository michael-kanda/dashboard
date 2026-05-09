// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager';
import UserLogbook from '@/components/UserLogbook'; 

type PageProps = {
  params: Promise<{ id: string }>;
};

// Projekt-Interface (Kunde)
interface Project {
  id: string;
  name: string;
  mandant_id: string | null;
}

// KORREKTUR: Omit verwenden, um den Typ-Konflikt mit 'string' aus dem User-Interface zu lösen
interface UserWithAssignments extends Omit<User, 'assigned_projects'> {
  assigned_projects: { project_id: string }[];
}

// Lädt den Benutzer UND seine Zuweisungen
async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    console.log('[getUserData] 🔍 Suche Benutzer mit ID:', id);
    // 1. Benutzerdaten laden
    const { rows: users } = await sql`
      SELECT
        id::text as id,
        email,
        role,
        mandant_id,
        permissions,
        COALESCE(domain, '') as domain,
        COALESCE(gsc_site_url, '') as gsc_site_url,
        COALESCE(ga4_property_id, '') as ga4_property_id,
        COALESCE(semrush_project_id, '') as semrush_project_id,
        COALESCE(semrush_tracking_id, '') as semrush_tracking_id,
        COALESCE(semrush_tracking_id_02, '') as semrush_tracking_id_02,
        COALESCE(google_ads_sheet_id, '') as google_ads_sheet_id,
        favicon_url,
        project_start_date,
        project_duration_months,
        project_timeline_active::boolean as project_timeline_active,
        settings_show_prompt_tracking::boolean as settings_show_prompt_tracking,
        brand_keywords
      FROM users
      WHERE id::text = ${id}`;
      
    if (users.length === 0) {
      console.error('[getUserData] ❌ Benutzer nicht gefunden!');
      return null;
    }
    // Cast to unknown first to avoid intersection type issues with Omit
    const user = users[0] as unknown as Omit<User, 'assigned_projects'>;
    
    // 2. Projekt-Zuweisungen (Ausnahmen) laden
    let assigned_projects: { project_id: string }[] = [];
    try {
      const { rows } = await sql<{ project_id: string }>`
        SELECT project_id::text as project_id
        FROM project_assignments
        WHERE user_id::text = ${id};`;
      assigned_projects = rows;
    } catch (paError) {
      console.warn('[getUserData] ⚠️ Projektzuweisungen konnten nicht geladen werden:', paError);
    }
    
    return { ...user, assigned_projects } as UserWithAssignments;
  } catch (error) {
    console.error('[getUserData] ❌ FEHLER:', error);
    throw error;
  }
}

// Lädt ALLE Projekte (Kunden)
async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql<{ id: string; email: string; domain: string | null; mandant_id: string | null }>`
      SELECT
        id::text as id,
        email,
        COALESCE(domain, email) as domain,
        mandant_id
      FROM users
      WHERE role = 'BENUTZER'
      ORDER BY mandant_id ASC, email ASC;`;
    return rows.map(p => ({
      id: p.id,
      name: p.domain || p.email,
      mandant_id: p.mandant_id
    }));
  } catch (error) {
    console.error('[getAllProjects] ❌ Fehler:', error);
    return [];
  }
}

// --- Hauptkomponente der Seite ---

export default async function EditUserPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;

  if (!id || typeof id !== 'string' || id.length !== 36) {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">❌ Ungültige ID</h2>
                <p>Die angegebene Benutzer-ID ist ungültig.</p>
            </div>
        </div>
    );
  }

  let user: UserWithAssignments | null = null;
  let allProjects: Project[] = [];
  let loadError: string | null = null;

  try {
    [user, allProjects] = await Promise.all([
      getUserData(id),
      getAllProjects()
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unbekannter Fehler';
  }

  if (!user || loadError) {
     return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">Benutzer nicht gefunden</h2>
                <p>Der Benutzer mit der ID {id} konnte nicht geladen werden.</p>
                {loadError && <p className="text-sm text-gray-500 mt-2">{loadError}</p>}
            </div>
        </div>
    );
  }

  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const currentUserIsKlasse1 = session.user.permissions?.includes('kann_admins_verwalten');
  const canManageAssignments = currentUserIsSuperAdmin || currentUserIsKlasse1;
  
  const userBeingEditedIsAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Benutzerdetails bearbeiten */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
             <div className="flex gap-2 items-center">
              {user.mandant_id && (
                <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-medium">
                  {user.mandant_id}
                </span>
              )}
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {user.role}
              </span>
            </div>
          </div>
         {/* Hier muss Cast verwendet werden, da EditUserForm das normale User Interface erwartet */}
         <EditUserForm 
           user={user as unknown as User}
           isSuperAdmin={currentUserIsSuperAdmin}
         />
        </div>

        {/* Landingpage Manager UND Logbuch (Nur für Kunden) */}
        {user.role === 'BENUTZER' && (
          <>
            <LandingpageManager userId={id} />
            <UserLogbook userId={id} />
          </>
        )}

        {/* Projektzuweisungen */}
        {canManageAssignments && userBeingEditedIsAdmin && (
          <ProjectAssignmentManager 
            user={user} 
            allProjects={allProjects} 
            availableProjects={currentUserIsSuperAdmin 
                ? allProjects 
                : allProjects.filter(p => p.mandant_id === session.user.mandant_id)
            }
          />
        )}
      </div>
    </div>
  );
}
