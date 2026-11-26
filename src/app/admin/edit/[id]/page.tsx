// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import ProjectAssignmentManager from './ProjectAssignmentManager';
import type { SupportStaff } from './ProjectSupportManager';
import { roleLabel } from '@/lib/ui-labels';
import { logger } from '@/lib/logger';
import { loadAnalyticsSettingsColumns } from '@/lib/vercel-analytics/settings-repository';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
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
    logger.debug('[getUserData] 🔍 Suche Benutzer mit ID:', id);
    // 1. Benutzerdaten laden
    const { rows: users } = await sql`
      SELECT
        id::text as id,
        email,
        role,
        mandant_id,
        ansprache,
        permissions,
        COALESCE(domain, '') as domain,
        COALESCE(gsc_site_url, '') as gsc_site_url,
        COALESCE(sitemap_url, '') as sitemap_url,
        COALESCE(ga4_property_id, '') as ga4_property_id,
        COALESCE(semrush_project_id, '') as semrush_project_id,
        COALESCE(semrush_tracking_id, '') as semrush_tracking_id,
        COALESCE(semrush_tracking_id_02, '') as semrush_tracking_id_02,
        COALESCE(google_ads_sheet_id, '') as google_ads_sheet_id,
        favicon_url,
        project_start_date,
        project_duration_months,
        project_timeline_active::boolean as project_timeline_active,
        settings_show_landingpages::boolean as settings_show_landingpages,
        settings_show_google_ads::boolean as settings_show_google_ads,
        settings_show_prompt_tracking::boolean as settings_show_prompt_tracking,
        COALESCE(dashboard_widget_visibility, '{}'::jsonb) as dashboard_widget_visibility,
        brand_keywords,
        COALESCE(project_locations, '[]'::jsonb) as project_locations
      FROM users
      WHERE id::text = ${id}`;
      
    if (users.length === 0) {
      console.error('[getUserData] ❌ Benutzer nicht gefunden!');
      return null;
    }
    // Cast to unknown first to avoid intersection type issues with Omit
    const user = {
      ...users[0],
      ...(await loadAnalyticsSettingsColumns(String(users[0].id))),
    } as unknown as Omit<User, 'assigned_projects'>;
    
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

// Betreuung eines Projekts: mögliche Betreuer, aktuelle Zuweisungen und Ersteller.
// Superadmins sehen alle Admins und Superadmins, Label-Admins nur Admins ihres Labels.
async function getProjectSupport(
  projectId: string,
  viewer: { role: string; mandant_id?: string | null },
): Promise<{ staff: SupportStaff[]; assignedIds: string[]; creatorEmail: string | null }> {
  const isSuperAdmin = viewer.role === 'SUPERADMIN';
  const label = viewer.mandant_id ?? null;
  const [staffResult, assignedResult, creatorResult] = await Promise.all([
    isSuperAdmin
      ? sql<SupportStaff>`
          SELECT id::text AS id, email, role, mandant_id FROM users
          WHERE role IN ('ADMIN', 'SUPERADMIN')
          ORDER BY role DESC, mandant_id ASC NULLS FIRST, email ASC`
      : sql<SupportStaff>`
          SELECT id::text AS id, email, role, mandant_id FROM users
          WHERE role = 'ADMIN' AND mandant_id = ${label}
          ORDER BY email ASC`,
    sql<{ user_id: string }>`SELECT user_id::text AS user_id FROM project_assignments WHERE project_id = ${projectId}::uuid`,
    sql<{ email: string }>`
      SELECT creator.email FROM users p JOIN users creator ON creator.id = p."createdByAdminId"
      WHERE p.id = ${projectId}::uuid`,
  ]);
  return {
    staff: staffResult.rows,
    assignedIds: assignedResult.rows.map((row) => row.user_id),
    creatorEmail: creatorResult.rows[0]?.email ?? null,
  };
}

// --- Hauptkomponente der Seite ---

export default async function EditUserPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { tab } = await searchParams;

  if (!id || typeof id !== 'string' || id.length !== 36) {
    return (
        <div className="min-h-screen bg-page px-[clamp(16px,3vw,40px)] pt-7 pb-12">
            <div className="p-8 text-center bg-surface rounded-lg max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-danger mb-4">❌ Ungültige ID</h2>
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
        <div className="min-h-screen bg-page px-[clamp(16px,3vw,40px)] pt-7 pb-12">
            <div className="p-8 bg-surface rounded-lg max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-danger mb-4">Benutzer nicht gefunden</h2>
                <p>Der Benutzer mit der ID {id} konnte nicht geladen werden.</p>
                {loadError && <p className="text-sm text-muted mt-2">{loadError}</p>}
            </div>
        </div>
    );
  }

  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const currentUserIsKlasse1 = session.user.permissions?.includes('kann_admins_verwalten');
  const canManageAssignments = currentUserIsSuperAdmin || currentUserIsKlasse1;
  
  const userBeingEditedIsAdmin = user.role === 'ADMIN';
  // Label-Admins verwalten nur die Betreuung von Projekten ihres eigenen Labels.
  const canManageSupport = user.role === 'BENUTZER' && canManageAssignments
    && (currentUserIsSuperAdmin || user.mandant_id === session.user.mandant_id);
  const support = canManageSupport ? await getProjectSupport(id, session.user) : null;

  return (
    <div className="min-h-screen bg-page px-[clamp(16px,3vw,40px)] pt-7 pb-12">
      <div className="max-w-4xl space-y-[22px]">
        
        {/* Benutzerdetails bearbeiten */}
        <div className="rounded-container border border-border bg-surface p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <h1 className="text-[23px] font-bold tracking-[-0.02em] text-heading">
              Benutzer <span className="text-accent">{user.email}</span> bearbeiten
            </h1>
             <div className="flex gap-2 items-center">
              {user.mandant_id && (
                <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-xs font-medium">
                  {user.mandant_id}
                </span>
              )}
              <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-sm font-medium">
                {roleLabel(user.role)}
              </span>
            </div>
          </div>
         {/* Hier muss Cast verwendet werden, da EditUserForm das normale User Interface erwartet */}
         {/* Projekte bekommen Tabs; Betreuung, Landingpages und Logbuch liegen dort in eigenen Tabs. */}
         <EditUserForm 
           user={user as unknown as User}
           isSuperAdmin={currentUserIsSuperAdmin}
           projectTabs={user.role === 'BENUTZER'
             ? { initialTab: typeof tab === 'string' ? tab : undefined, support }
             : undefined}
         />
        </div>

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
