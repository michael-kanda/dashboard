import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import ContentStudio from '@/components/content-studio/ContentStudio';

export default async function ContentStudioPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/login');
  }

  return <ContentStudio />;
}
