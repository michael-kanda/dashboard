// src/app/konto/passwort/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <PageContainer>
      <PageHeader
        title="Passwort ändern"
        subtitle="Nach dem Ändern bleiben Sie auf diesem Gerät angemeldet. Alle anderen Geräte werden innerhalb weniger Minuten abgemeldet."
      />
      <ChangePasswordForm email={session.user.email ?? ''} />
    </PageContainer>
  );
}
