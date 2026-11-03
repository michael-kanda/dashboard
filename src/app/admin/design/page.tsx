// src/app/admin/design/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { readTheme } from '@/lib/theme-store';
import DesignSettingsClient from './DesignSettingsClient';

export const dynamic = 'force-dynamic';

export default async function DesignSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN') {
    redirect('/login');
  }

  return <DesignSettingsClient initialTheme={await readTheme()} />;
}
