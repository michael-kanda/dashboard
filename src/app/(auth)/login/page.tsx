// src/app/(auth)/login/page.tsx
import LoginForm from './LoginForm';

interface LoginPageProps {
  searchParams?: {
    callbackUrl?: string | string[];
  };
}

function getSafeCallbackUrl(value: string | string[] | undefined) {
  const callbackUrl = Array.isArray(value) ? value[0] : value;
  return callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/';
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginForm callbackUrl={getSafeCallbackUrl(searchParams?.callbackUrl)} />;
}
