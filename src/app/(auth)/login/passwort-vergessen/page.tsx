// src/app/(auth)/login/passwort-vergessen/page.tsx
import type { Metadata } from 'next';
import ForgotPasswordForm from './ForgotPasswordForm';

export const metadata: Metadata = { title: 'Passwort vergessen', robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
