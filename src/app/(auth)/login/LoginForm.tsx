// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeSlash, Lock } from 'react-bootstrap-icons';
import ThemeModeSwitch from '@/components/ThemeModeSwitch';
import { Spinner } from '@/components/ui/Spinner';

interface LoginFormProps {
  callbackUrl?: string;
}

export default function LoginForm({ callbackUrl = '/' }: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successAnsprache, setSuccessAnsprache] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      callbackUrl,
      email,
      password,
    });

    if (result?.error) {
      setIsLoading(false);
      setError(result.code === 'locked'
        ? 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.'
        : 'E-Mail oder Passwort ist falsch.');
    } else {
      const session = await getSession();
      setSuccessAnsprache(session?.user?.ansprache?.trim() || '');
      setIsSuccess(true);

      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 3000);
    }
  };

  const rowClasses =
    'flex min-h-11 items-center gap-3 border-b border-border-subtle px-4 last:border-b-0 focus-within:bg-surface-secondary';
  const fieldClasses =
    'h-11 min-w-0 flex-1 bg-transparent text-[15px] text-heading placeholder:text-muted focus:outline-none disabled:opacity-60';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-page px-4 py-16">
      <div className="absolute right-4 top-4">
        <ThemeModeSwitch />
      </div>
      <div className="w-full max-w-[360px]">
        {!isSuccess ? (
          <>
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-solid text-[18px] font-bold text-white" aria-hidden="true">
                DP
              </span>
              <h1 className="text-[23px] font-bold tracking-[-0.02em] text-heading">Willkommen zurück</h1>
              <p className="mt-1 text-[14px] text-muted">Ihre aktuellen Daten warten bereits.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-container border border-border bg-surface">
                <div className={rowClasses}>
                  <label htmlFor="login-email" className="w-[72px] flex-shrink-0 text-[14px] text-heading">E-Mail</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    className={fieldClasses}
                    placeholder="name@firma.de"
                    disabled={isLoading || isSuccess}
                  />
                </div>
                <div className={rowClasses}>
                  <label htmlFor="login-password" className="w-[72px] flex-shrink-0 text-[14px] text-heading">Passwort</label>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    className={fieldClasses}
                    placeholder="Passwort"
                    disabled={isLoading || isSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="-mr-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-150 ease-out hover:bg-fill hover:text-heading"
                    disabled={isLoading || isSuccess}
                    aria-label={showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeSlash size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}

              <button
                type="submit"
                className="flex h-9 w-full items-center justify-center gap-2 rounded-control bg-accent-solid px-4 text-[14px] font-semibold text-white transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                disabled={isLoading || isSuccess}
              >
                {isLoading && <Spinner size={14} className="" />}
                {isLoading ? 'Prüfe Daten …' : 'Anmelden'}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted">
                <Lock size={11} aria-hidden="true" />
                Sichere Verbindung
              </p>
            </form>
          </>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center" role="status">
            <div className="relative mb-8 h-[120px] w-[180px]">
              <Image src="/data-max.webp" alt="DataMax" fill className="object-contain" priority />
            </div>
            <h1 className="flex items-center justify-center gap-2 text-[23px] font-bold tracking-[-0.02em] text-heading">
              <Spinner size={18} />
              Login erfolgreich{successAnsprache ? ` ${successAnsprache}` : ''}
            </h1>
            <p className="mt-2 text-[15px] font-semibold text-accent">Dateninitialisierung läuft …</p>
            <p className="mt-1 text-[14px] text-muted">Sie werden gleich weitergeleitet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
