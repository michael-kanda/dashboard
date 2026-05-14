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
    <div className="p-8 mt-8 max-w-full mx-auto bg-surface-secondary min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-heading">Admin-Bereich</h1>
          <p className="text-body mt-2">Verwalten Sie Benutzer und Projekte</p>
        </div>
      </div>

      <UserManagementClient 
        initialUsers={users} // ❌ Kein 'as any' mehr nötig!
        sessionUser={session.user} 
      />
    </div>
  );
}
