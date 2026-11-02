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
    <UserManagementClient
      initialUsers={users}
      sessionUser={session.user}
    />
  );
}
