// src/app/konto/zwei-faktor/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import TwoFactorSetup from './TwoFactorSetup';

export const dynamic = 'force-dynamic';

export default async function TwoFactorPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <PageContainer>
      <PageHeader
        title="Zwei-Faktor-Anmeldung"
        subtitle="Zusätzlich zum Passwort ein Code aus einer Authenticator-App, zum Beispiel Google Authenticator, Microsoft Authenticator oder 1Password."
      />
      <TwoFactorSetup setupRequired={Boolean(session.user.two_factor_setup_required)} />
    </PageContainer>
  );
}
