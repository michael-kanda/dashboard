// src/components/datamax/SuggestedQuestions.tsx
'use client';

import { motion } from 'framer-motion';
import { Robot, Lightning } from 'react-bootstrap-icons';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
  ansprache?: string | null;
}

export function SuggestedQuestions({ 
  questions, 
  onQuestionClick,
  isLoading = false,
  ansprache = null
}: SuggestedQuestionsProps) {
  const greeting = ansprache?.trim()
    ? `Hallo ${ansprache.trim()}! Ich bin DataMax`
    : 'Hallo! Ich bin DataMax';

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      {/* Avatar */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="
          w-16 h-16 rounded-lg mb-4
          bg-[#188BDB]/10
          flex items-center justify-center
        "
      >
        <Robot size={32} className="text-[#188BDB]" />
      </motion.div>

      {/* Greeting */}
      <motion.h4 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="font-semibold text-heading mb-1"
      >
        {greeting}
      </motion.h4>
      
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-sm text-muted mb-6"
      >
        Frag mich alles zu deinen SEO- und Analytics-Daten
      </motion.p>

      {/* Suggested Questions */}
      {questions.length > 0 && (
        <div className="w-full space-y-2">
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs text-muted uppercase mb-3"
          >
            Vorschläge basierend auf deinen Daten
          </motion.p>
          
          {questions.map((question, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + index * 0.08 }}
              onClick={() => onQuestionClick(question)}
              disabled={isLoading}
              className="
                w-full p-3 rounded-md
                bg-surface border border-border-subtle
                text-left text-sm text-body
                hover:border-[#188BDB]/50 hover:bg-[#188BDB]/5
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                flex items-center gap-2
                group
              "
            >
              <Lightning 
                size={14} 
                className="text-[#188BDB] shrink-0 transition-colors"
              />
              <span className="group-hover:text-heading transition-colors">
                {question}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {questions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted"
        >
          Lade Vorschläge...
        </motion.div>
      )}
    </div>
  );
}

export default SuggestedQuestions;
