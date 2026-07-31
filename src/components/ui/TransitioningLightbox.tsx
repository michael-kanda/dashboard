'use client';

import React from 'react';
import Image from 'next/image'; 
import { Magic } from 'react-bootstrap-icons';

interface TransitioningLightboxProps {
  /**
   * Die Nachricht, die dem Benutzer während des Wartens angezeigt wird.
   * Z.B. "Lade Dashboard..." oder "Weiterleitung zum Redaktionsplan..."
   */
  message: string; 

  /**
   * Optional: Icon-Komponente zur Anzeige. Wenn nicht angegeben, wird <Magic /> verwendet.
   */
  Icon?: React.ElementType; 

  /**
   * Optional: Quelldatei für das Bild, falls es nicht das Standardbild ist.
   */
  imageSrc?: string; 
}

/**
 * Eine wiederverwendbare, animierte Lightbox/Loading-Anzeige für Übergänge oder Stream-Wartezeiten.
 * Gemeinsame Lightbox für gestreamte KI-Antworten.
 */
export default function TransitioningLightbox({ 
  message, 
  Icon,
  imageSrc = "/data-max-arbeitet.webp" 
}: TransitioningLightboxProps) {

  // Das Icon muss außerhalb der Komponente importiert werden, daher nutzen wir hier Magic als Fallback.
  const DisplayIcon = Icon || Magic;

  return (
    // LIGHTBOX - Feste Position über dem gesamten Bildschirm
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
       <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
          
          <div className="relative w-full flex justify-center">
             {/* Verwenden des vorhandenen Ladebildes */}
             <Image 
               src={imageSrc} 
               alt="Data Max arbeitet" 
               width={400} 
               height={400}
               className="h-[200px] w-auto object-contain"
               priority
             />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Data Max at work</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              {message} 
            </p>
          </div>

          {/* Ladebalken */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
          </div>
          
          {/* Fügen Sie die Styles für die Animation hinzu, falls sie nicht global sind */}
          <style jsx global>{`
            @keyframes indeterminate-bar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
            .animate-indeterminate-bar {
              animation: indeterminate-bar 1.5s infinite linear;
            }
          `}</style>
       </div>
    </div>
  );
}
