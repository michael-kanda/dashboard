// src/components/datamax/DataMaxChat.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  ArrowClockwise, 
  StopFill,
  Robot,
  ArrowsFullscreen,
  FullscreenExit,
} from 'react-bootstrap-icons';
import { useDataMaxChat } from '@/hooks/useDataMaxChat';
import { ChatMessage } from './ChatMessage';
import { SuggestedQuestions } from './SuggestedQuestions';

// ============================================================================
// Schriftgrößen-Stufen
// ============================================================================

const FONT_SIZES = [
  { label: 'XS', class: 'text-xs' },
  { label: 'S',  class: 'text-sm' },
  { label: 'M',  class: 'text-base' },
  { label: 'L',  class: 'text-lg' },
  { label: 'XL', class: 'text-xl' },
] as const;

const DEFAULT_FONT_INDEX = 1; // text-sm

// ============================================================================
// Component
// ============================================================================

interface DataMaxChatProps {
  projectId?: string;
  dateRange?: string;
  ansprache?: string | null;
  className?: string;
  /** Öffentliche Demo: Testversion mit wenigen Fragen und den Beispieldaten der Demo. */
  demo?: boolean;
}

export function DataMaxChat({ projectId, dateRange = '30d', ansprache = null, className = '', demo = false }: DataMaxChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSizeIndex, setFontSizeIndex] = useState(DEFAULT_FONT_INDEX);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    suggestedQuestions,
    usage,
    historyLoading,
    sendMessage,
    clearChat,
    cancelRequest,
    loadSuggestedQuestions,
    loadHistory,
  } = useDataMaxChat({
    projectId,
    dateRange,
    // Die Demo merkt sich das Gespräch nur in der Sitzung; angemeldet wird es gespeichert.
    endpoint: demo ? '/api/ai/demo-chat' : undefined,
    historyEndpoint: demo ? null : '/api/ai/chat/history',
  });

  const fontSizeClass = FONT_SIZES[fontSizeIndex].class;
  // Tageslimit: ohne Angabe (Superadmin) unbegrenzt.
  const limitReached = usage?.remaining === 0;

  // Auto-scroll zu neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gespeicherten Verlauf beim ersten Öffnen laden
  useEffect(() => {
    if (isOpen) loadHistory();
  }, [isOpen, loadHistory]);

  // Suggested Questions beim Öffnen laden
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadSuggestedQuestions();
    }
  }, [isOpen, messages.length, loadSuggestedQuestions]);

  // Focus auf Input beim Öffnen
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC zum Schließen von Vollbild
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading && !limitReached) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleSuggestedClick = (question: string) => {
    if (limitReached) return;
    sendMessage(question);
  };

  const increaseFontSize = useCallback(() => {
    setFontSizeIndex(prev => Math.min(prev + 1, FONT_SIZES.length - 1));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSizeIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full
          bg-accent-solid text-white shadow-lg
          flex items-center justify-center
          hover:scale-105 hover:bg-accent-solid hover:shadow-xl
          transition-all duration-200
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
          ${className}
        `}
        whileHover={{ rotate: [0, -10, 10, -10, 0] }}
        whileTap={{ scale: 0.95 }}
        aria-label="DataMax Chat öffnen"
      >
        <Robot size={24} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              fixed z-50
              dashboard-widget-surface shadow-2xl
              flex flex-col overflow-hidden
              border border-border-subtle
              transition-all duration-300 ease-in-out
              ${isFullscreen 
                ? 'inset-0 rounded-none' 
                : 'bottom-6 right-6 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] rounded-lg'
              }
            `}
          >
            {/* Header */}
            <div className="
              px-4 py-3 
              bg-surface text-heading border-b border-border-subtle
              flex items-center justify-between
              shrink-0
            ">
              <div className="flex items-center gap-3">
                <div className="
                  w-10 h-10 rounded-md
                  bg-accent-solid/10 text-accent
                  flex items-center justify-center
                ">
                  <Robot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">DataMax</h3>
                  <p className="text-xs text-muted">{demo ? 'Testversion mit Beispieldaten' : 'SEO & Analytics Assistent'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Schriftgröße Controls */}
                <div className="flex items-center gap-0.5 mr-1 rounded-md border border-border-subtle bg-surface-secondary px-1 py-0.5">
                  <button
                    onClick={decreaseFontSize}
                    disabled={fontSizeIndex === 0}
                    className="px-1.5 py-1 hover:bg-surface-tertiary rounded text-xs font-bold
                      disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Schrift kleiner"
                  >
                    A−
                  </button>
                  <span className="text-11 text-muted w-6 text-center select-none">
                    {FONT_SIZES[fontSizeIndex].label}
                  </span>
                  <button
                    onClick={increaseFontSize}
                    disabled={fontSizeIndex === FONT_SIZES.length - 1}
                    className="px-1.5 py-1 hover:bg-surface-tertiary rounded text-sm font-bold
                      disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Schrift größer"
                  >
                    A+
                  </button>
                </div>

                {/* Vollbild Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-muted hover:bg-surface-secondary hover:text-heading rounded-md transition-colors"
                  title={isFullscreen ? 'Vollbild beenden (ESC)' : 'Vollbild'}
                >
                  {isFullscreen ? <FullscreenExit size={16} /> : <ArrowsFullscreen size={16} />}
                </button>

                {/* Chat leeren (löscht auch den gespeicherten Verlauf) */}
                <button
                  onClick={() => { void clearChat(); }}
                  className="p-2 text-muted hover:bg-surface-secondary hover:text-heading rounded-md transition-colors"
                  title={demo ? 'Chat leeren' : 'Chat leeren (löscht den gespeicherten Verlauf)'}
                  aria-label="Chat leeren"
                >
                  <ArrowClockwise size={16} />
                </button>

                {/* Schließen */}
                <button
                  onClick={() => { setIsOpen(false); setIsFullscreen(false); }}
                  className="p-2 text-muted hover:bg-surface-secondary hover:text-heading rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className={`
              flex-1 overflow-y-auto p-4 space-y-4 bg-surface-secondary
              ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}
            `}>
              {messages.length === 0 && historyLoading ? (
                <p className="text-sm text-muted" role="status">Verlauf wird geladen …</p>
              ) : messages.length === 0 ? (
                <SuggestedQuestions 
                  questions={suggestedQuestions}
                  onQuestionClick={handleSuggestedClick}
                  isLoading={isLoading}
                  ansprache={ansprache}
                />
              ) : (
                messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message} 
                    fontSizeClass={fontSizeClass}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form 
              onSubmit={handleSubmit}
              className={`
                p-3 bg-surface border-t border-border-subtle shrink-0
                ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={limitReached ? (demo ? 'Testversion beendet' : 'Tageslimit erreicht') : 'Frag DataMax...'}
                  disabled={isLoading || limitReached}
                  className={`
                    flex-1 px-4 py-2.5
                    bg-surface-secondary border border-border-subtle rounded-md
                    ${fontSizeClass} text-heading
                    placeholder:text-placeholder
                    focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15
                    disabled:opacity-50
                    transition-all
                  `}
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="
                      p-2.5 rounded-md
                      bg-red-500 text-white
                      hover:bg-red-600
                      transition-colors
                    "
                  >
                    <StopFill size={18} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || limitReached}
                    className="
                      p-2.5 rounded-md
                      bg-accent-solid text-white
                      hover:bg-accent-solid
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
              {usage?.limit != null && usage.remaining != null && (
                <p className="mt-2 text-12 text-muted" role="status" aria-live="polite">
                  {demo
                    ? limitReached
                      ? <>Die Testversion beantwortet {usage.limit} Fragen. Mit eigenem Zugang fragen Sie DataMax zu Ihren echten Zahlen: <a href="mailto:michael@designare.at?subject=Zugang%20zu%20DataPeak" className="font-medium text-accent underline underline-offset-2">Zugang anfragen</a></>
                      : `Testversion: noch ${usage.remaining} von ${usage.limit} Fragen.`
                    : limitReached
                      ? `Tageslimit von ${usage.limit} Fragen erreicht. Ab morgen geht es weiter.`
                      : `Noch ${usage.remaining} von ${usage.limit} Fragen heute.`}
                </p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default DataMaxChat;
