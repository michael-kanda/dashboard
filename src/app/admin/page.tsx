// src/app/admin/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUsersForManagement } from '@/services/userService';
import UserManagementClient from '@/components/admin/UserManagementClient';

// Diese Seite ist eine Server Component
export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/login');
  }

  // Typensicherer Aufruf - gibt Promise<User[]> zurück
  const users = await getUsersForManagement(session.user);

  return (
    <div className="admin-clean min-h-screen bg-surface-secondary px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Verwaltung</p>
          <h1 className="text-2xl font-semibold text-heading">Admin-Bereich</h1>
          <p className="mt-1 text-sm text-muted">Benutzer, Projekte und Mandanten verwalten</p>
        </div>
      </div>

      <UserManagementClient 
        initialUsers={users} // ❌ Kein 'as any' mehr nötig!
        sessionUser={session.user} 
      />
      </div>
    </div>
  );
}
