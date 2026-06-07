// src/app/(auth)/login/page.tsx
import { Suspense } from 'react';
import LoginForm from './LoginForm';

function LoginLoading() {
  return (
    <div className="min-h-screen bg-white px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[920px] items-center justify-between gap-10">
        <div className="w-full max-w-[390px] animate-pulse space-y-10">
          <div className="h-[74px] w-[230px] rounded-lg bg-slate-100" />
          <div className="space-y-5">
            <div className="h-[72px] rounded-lg bg-slate-100" />
            <div className="h-[72px] rounded-lg bg-slate-100" />
            <div className="h-[51px] rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="hidden min-h-[624px] w-full max-w-[460px] rounded-xl bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] lg:block">
          <div className="h-full rounded-xl bg-[#188bdb]" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
