// src/app/(auth)/login/page.tsx
import { Suspense } from 'react';
import LoginForm from './LoginForm';

function LoginLoading() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        <div className="flex h-full w-full items-center justify-center px-6 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-[390px] animate-pulse space-y-10">
            <div className="h-[74px] w-[230px] rounded-lg bg-slate-100" />
            <div className="space-y-5">
              <div className="h-[72px] rounded-lg bg-slate-100" />
              <div className="h-[72px] rounded-lg bg-slate-100" />
              <div className="h-[51px] rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="hidden h-full w-full bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] lg:block">
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
