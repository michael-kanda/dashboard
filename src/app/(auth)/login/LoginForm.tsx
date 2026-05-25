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
  Lock 
} from 'react-bootstrap-icons';
import { motion } from 'framer-motion';

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
      setShake(prev => prev + 1);
    } else {
      const session = await getSession();
      setSuccessAnsprache(session?.user?.ansprache?.trim() || '');
      // ✅ ERFOLG: Karte drehen
      setIsSuccess(true);
      
      // ✅ UPDATE: 3 Sekunden warten für Animation & Text
      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 3000); 
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      {/* 3D Perspective Container */}
      <div className="w-full max-w-md h-[500px]" style={{ perspective: '1000px' }}>
        
        {/* Die rotierende Karte */}
        <motion.div
          className="relative w-full h-full"
          initial={{ rotateY: 0 }}
          animate={{ rotateY: isSuccess ? 180 : 0 + (shake * 0) }} 
          transition={{ duration: 0.8, type: "spring", stiffness: 60 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          
          {/* ================= VORDERSEITE (LOGIN FORM) ================= */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-xl shadow-2xl p-8 backface-hidden flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* LOGO - ✅ UPDATE: Größe angepasst */}
            <div className="flex justify-center mb-8">
              <div className="relative w-[240px] h-[60px]">
                <Image
                  src="/logo-data-peak.webp"
                  alt="Data Peak Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 flex-grow flex flex-col justify-center">
              <motion.div 
                className="space-y-4"
                animate={{ x: shake % 2 === 0 ? [0, -10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.4 }}
                key={shake}
              >
                {/* EMAIL */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 ml-1">
                    E-Mail Adresse
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#188bdb] transition-colors">
                      <Envelope size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={handleEmailChange}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#188bdb]/20 focus:border-[#188bdb] transition-all bg-gray-50 focus:bg-white outline-none text-gray-900 placeholder-gray-400"
                      placeholder="name@firma.de"
                      disabled={isLoading || isSuccess}
                    />
                  </div>
                </div>

                {/* PASSWORT */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 ml-1">
                    Passwort
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#188bdb] transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#188bdb]/20 focus:border-[#188bdb] transition-all bg-gray-50 focus:bg-white outline-none text-gray-900 placeholder-gray-400"
                      placeholder="••••••••"
                      disabled={isLoading || isSuccess}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      disabled={isLoading || isSuccess}
                    >
                      {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* ERROR MESSAGE */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2"
                >
                  <ExclamationTriangleFill size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* SUBMIT BUTTON */}
              <div>
                <button
                  type="submit"
                  className="w-full relative flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-[#188bdb] hover:bg-[#1479BF] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] font-medium shadow-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
                  disabled={isLoading || isSuccess}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Prüfe Daten...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Anmelden</span>
                      <BoxArrowInRight size={18} />
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ================= RÜCKSEITE (DATEN INITIALISIERUNG) ================= */}
          <div 
            className="absolute inset-0 w-full h-full bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center justify-center text-center space-y-6"
            style={{ 
              backfaceVisibility: 'hidden', 
              transform: 'rotateY(180deg)' 
            }}
          >
            {/* Pulsierendes Bild */}
            <motion.div 
              className="relative w-48 h-48"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <Image
                src="/data-max.webp"
                alt="Data Initialization"
                fill
                className="object-contain"
              />
            </motion.div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#188bdb]/30 border-t-[#188bdb] rounded-full animate-spin" />
                Login erfolgreich{successAnsprache ? ` ${successAnsprache}` : ''}
              </h3>
              <p className="text-[#188bdb] font-medium animate-pulse">
                Dateninitialisierung läuft...
              </p>
              <p className="text-sm text-gray-400">
                Sie werden gleich weitergeleitet.
              </p>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
