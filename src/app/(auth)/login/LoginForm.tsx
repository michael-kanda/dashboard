// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { getSession, signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BoxArrowInRight,
  ExclamationTriangleFill,
  Eye,
  EyeSlash,
  Envelope,
  Lock,
} from 'react-bootstrap-icons';
import { motion } from 'framer-motion';

const loginIntroHtml = `
  <p style="text-align: justify; font-weight: normal;">
  DataPeak bringt zusammen, was zusammengehört: Deine wichtigsten Insights
  aus Google Search Console und GA4 auf einem einzigen, zentralen Dashboard.
</p>
`;

function LoginVisualCard() {
  return (
    <aside className="hidden h-full w-full bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] lg:block">
      <div className="flex h-full items-center justify-center overflow-hidden rounded-xl bg-[#188bdb] px-[clamp(40px,5vw,76px)] py-[clamp(48px,7vh,92px)]">
        <div className="flex w-full max-w-[620px] flex-col items-center">
          <div
            className="w-full max-w-[430px] self-start text-[16px] font-semibold leading-[1.22] text-white"
            dangerouslySetInnerHTML={{ __html: loginIntroHtml }}
          />
          <div className="relative mt-10 h-[clamp(320px,44vh,500px)] w-full">
            <Image
              src="/traffic.webp"
              alt="DataPeak Traffic Dashboard Karten"
              fill
              className="object-contain drop-shadow-[0_18px_22px_rgba(15,23,42,0.25)]"
              sizes="50vw"
              priority
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successAnsprache, setSuccessAnsprache] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(0);

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
      setError('E-Mail oder Passwort ist falsch.');
      setShake((prev) => prev + 1);
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-[#111827]">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        <section className="flex h-full w-full items-center justify-center px-6 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-[390px]">
          {!isSuccess ? (
            <>
              <div className="mb-20 flex justify-center lg:justify-start">
                <div className="relative h-[74px] w-[230px]">
                  <Image
                    src="/logo-data-peak.webp"
                    alt="DataPeak"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <motion.div
                  className="space-y-4"
                  animate={{ x: shake % 2 === 1 ? [0, -10, 10, -8, 8, 0] : 0 }}
                  transition={{ duration: 0.36 }}
                  key={shake}
                >
                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-[#344054]">
                      E-Mail Adresse
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#98a2b3]">
                        <Envelope size={19} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={handleEmailChange}
                        className="block h-[51px] w-full rounded-lg border border-[#d9dee7] bg-white py-3 pl-10 pr-3 text-[16px] font-medium text-[#111827] outline-none transition-all placeholder:text-[#98a2b3] focus:border-[#188bdb] focus:ring-4 focus:ring-[#188bdb]/10"
                        placeholder="name@firma.de"
                        disabled={isLoading || isSuccess}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[14px] font-semibold text-[#344054]">
                      Passwort
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#98a2b3]">
                        <Lock size={19} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={handlePasswordChange}
                        className="block h-[51px] w-full rounded-lg border border-[#d9dee7] bg-white py-3 pl-10 pr-10 text-[16px] font-medium text-[#111827] outline-none transition-all placeholder:text-[#98a2b3] focus:border-[#188bdb] focus:ring-4 focus:ring-[#188bdb]/10"
                        placeholder="••••••••"
                        disabled={isLoading || isSuccess}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#98a2b3] transition-colors hover:text-[#667085] focus:outline-none"
                        disabled={isLoading || isSuccess}
                        aria-label={showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                      >
                        {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                  >
                    <ExclamationTriangleFill size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="mt-6 flex h-[51px] w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[#188bdb] px-4 text-[16px] font-semibold text-white shadow-[0_10px_18px_rgba(24,139,219,0.24)] transition-all duration-200 hover:bg-[#1479bf] focus:outline-none focus:ring-4 focus:ring-[#188bdb]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading || isSuccess}
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Prüfe Daten...</span>
                    </>
                  ) : (
                    <>
                      <span>Anmelden</span>
                      <BoxArrowInRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
              <motion.div
                className="relative mb-12 h-[145px] w-[210px]"
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              >
                <Image
                  src="/data-max.webp"
                  alt="DataMax"
                  fill
                  className="object-contain"
                  priority
                />
              </motion.div>

              <div className="space-y-3">
                <h3 className="flex items-center justify-center gap-2 text-[21px] font-bold text-[#111827]">
                  <span className="h-5 w-5 rounded-full border-2 border-[#8fd0ff] border-t-[#188bdb] animate-spin" />
                  Login erfolgreich{successAnsprache ? ` ${successAnsprache}` : ''}
                </h3>
                <p className="text-[17px] font-semibold text-[#5bb3f0]">
                  Dateninitialisierung läuft...
                </p>
                <p className="text-[15px] font-medium text-[#98a2b3]">
                  Sie werden gleich weitergeleitet.
                </p>
              </div>
            </div>
          )}
          </div>
        </section>

        <LoginVisualCard />
      </div>
    </div>
  );
}
