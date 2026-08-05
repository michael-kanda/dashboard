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

function MiniTrend({ color }: { color: string }) {
  return (
    <div className="relative mt-2 h-[18px] w-[70px] overflow-hidden" aria-hidden="true">
      <span className="absolute bottom-[3px] left-0 h-[2px] w-[25px] origin-left -rotate-[8deg] rounded-full" style={{ backgroundColor: color }} />
      <span className="absolute bottom-[6px] left-[23px] h-[2px] w-[25px] origin-left rotate-[5deg] rounded-full" style={{ backgroundColor: color }} />
      <span className="absolute bottom-[4px] left-[46px] h-[2px] w-[24px] origin-left -rotate-[14deg] rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}

function LoginVisualCard() {
  return (
    <aside className="hidden h-full w-full bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] lg:block">
      <div
        className="relative h-full overflow-hidden rounded-xl bg-[#188bdb]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.075) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30" aria-hidden="true">
          <span className="absolute bottom-[27%] left-[-8%] h-[34%] w-[116%] -rotate-[11deg] rounded-[50%] border-t-2 border-white/45" />
          <span className="absolute bottom-[20%] left-[-6%] h-[29%] w-[112%] -rotate-[8deg] rounded-[50%] border-t border-dashed border-white/35" />
        </div>

        <div className="absolute left-[7%] top-[7%] z-10 text-white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/75">
            DataPeak Live
          </p>
          <h2 className="text-[clamp(16px,1.25vw,22px)] font-bold leading-tight">
            Aus Daten werden Entscheidungen.
          </h2>
          <div className="mt-3 flex h-[5px] w-[150px] overflow-hidden rounded-full" aria-hidden="true">
            <span className="w-1/4 bg-white" />
            <span className="w-1/4 bg-[#fbbc04]" />
            <span className="w-1/4 bg-[#34a853]" />
            <span className="w-1/4 bg-[#8b5cf6]" />
          </div>
        </div>

        <div className="absolute inset-x-[10%] bottom-[4%] top-[17%]">
          <div className="relative h-full w-full">
            <Image
              src="/login-image.webp"
              alt="Vorschau des DataPeak Dashboards"
              fill
              className="object-contain drop-shadow-[0_18px_22px_rgba(15,23,42,0.25)]"
              sizes="50vw"
              priority
            />

            <div className="absolute left-[-5%] top-[61%] w-[118px] rounded-lg border border-white/60 bg-white/95 p-3 text-[#344054] shadow-[0_10px_28px_rgba(15,23,42,0.2)] xl:w-[132px]">
              <p className="text-[11px] font-medium text-[#667085]">Conversions</p>
              <p className="mt-0.5 text-[18px] font-bold leading-none">184</p>
              <p className="mt-1.5 text-[12px] font-semibold text-[#16a05d]">+18,9 %</p>
              <MiniTrend color="#16a05d" />
            </div>

            <div className="absolute right-[-6%] top-[17%] w-[118px] rounded-lg border border-white/60 bg-white/95 p-3 text-[#344054] shadow-[0_10px_28px_rgba(15,23,42,0.2)] xl:w-[132px]">
              <p className="text-[11px] font-medium text-[#667085]">KI-Traffic</p>
              <p className="mt-0.5 text-[15px] font-bold leading-tight">84 Sitzungen</p>
              <p className="mt-1.5 text-[12px] font-semibold text-[#16a05d]">+22,4 %</p>
              <MiniTrend color="#8b5cf6" />
            </div>

            <div className="absolute bottom-[5%] right-[-6%] w-[clamp(216px,19vw,250px)] rounded-lg border border-white/70 bg-white/95 p-4 text-[#344054] shadow-[0_12px_30px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-bold">Indexierungsstatus</p>
                <span className="whitespace-nowrap text-[11px] text-[#667085]">Heute geprüft</span>
              </div>
              <div className="mt-2.5 flex items-center gap-3.5">
                <div
                  role="img"
                  aria-label="61 Prozent der Sitemap-URLs sind indexiert"
                  className="relative h-16 w-16 shrink-0 rounded-full"
                  style={{ background: 'conic-gradient(#34a853 0 61%, #fee2e2 61% 100%)' }}
                >
                  <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-white">
                    <strong className="text-[12px] leading-none">61 %</strong>
                    <span className="mt-1 text-[6px] font-bold text-[#667085]">INDEXIERT</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#34a853]" />Indexiert</span>
                    <strong>122</strong>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />Handlungsbedarf</span>
                    <strong>77</strong>
                  </div>
                </div>
              </div>
            </div>
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
                <div className="mb-14">
                  <div className="relative h-[74px] w-[230px]">
                    <Image
                      src="/logo-data-peak.webp"
                      alt="DataPeak"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <h1 className="m-0 text-left text-[21px] font-bold leading-tight text-[#344054]">
                    Willkommen zurück
                  </h1>
                  <p className="mt-1 text-left text-[15px] font-medium text-[#667085]">
                    Ihre aktuellen Daten warten bereits.
                  </p>
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
                <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-medium text-[#98a2b3]">
                  <Lock size={11} aria-hidden="true" />
                  Sichere Verbindung
                </p>
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
