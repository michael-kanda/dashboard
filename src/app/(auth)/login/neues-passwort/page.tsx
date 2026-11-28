// src/app/(auth)/login/neues-passwort/page.tsx
import type { Metadata } from 'next';
import NewPasswordForm from './NewPasswordForm';

export const metadata: Metadata = { title: 'Neues Passwort', robots: { index: false }, referrer: 'no-referrer' };

export default function NewPasswordPage() {
  return <NewPasswordForm />;
}
