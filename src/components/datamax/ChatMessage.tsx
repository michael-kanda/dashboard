// src/components/datamax/ChatMessage.tsx
'use client';

import { motion } from 'framer-motion';
import { Robot, Person } from 'react-bootstrap-icons';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '@/hooks/useDataMaxChat';

interface ChatMessageProps {
  message: ChatMessageType;
  fontSizeClass?: string;
}

export function ChatMessage({ message, fontSizeClass = 'text-sm' }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full shrink-0
        flex items-center justify-center
        ${isUser 
          ? 'bg-surface-tertiary text-muted'
          : 'bg-[#188BDB]/10 text-[#188BDB]'
        }
      `}>
        {isUser ? <Person size={14} /> : <Robot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`
        max-w-[85%] px-4 py-3 rounded-lg
        ${isUser 
          ? 'bg-[#188BDB] text-white rounded-br-sm'
          : 'bg-surface text-body rounded-bl-sm shadow-sm border border-border-subtle'
        }
      `}>
        {/* Content mit Markdown */}
        <div className={`
          ${fontSizeClass} leading-relaxed
          ${message.isStreaming ? 'animate-pulse' : ''}
        `}>
          {message.content ? (
            isUser ? (
              // User-Nachrichten: Plain Text
              <span className="whitespace-pre-wrap">{message.content}</span>
            ) : (
              // Assistant-Nachrichten: Markdown rendern
              <ReactMarkdown
                components={{
                  // Überschriften
                  h1: ({ children }) => (
                    <h1 className="font-bold text-heading mt-3 mb-2 first:mt-0" style={{ fontSize: '1.1em' }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="font-bold text-heading mt-3 mb-2 first:mt-0" style={{ fontSize: '1.05em' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="font-bold text-heading mt-3 mb-2 first:mt-0" style={{ fontSize: '1em' }}>{children}</h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="font-semibold text-heading mt-2 mb-1 first:mt-0" style={{ fontSize: '1em' }}>{children}</h4>
                  ),
                  
                  // Absätze
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 text-body">{children}</p>
                  ),
                  
                  // Fett & Kursiv
                  strong: ({ children }) => (
                    <strong className="font-semibold text-heading">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-muted">{children}</em>
                  ),
                  
                  // Listen
                  ul: ({ children }) => (
                    <ul className="list-none space-y-1.5 my-2 pl-0">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-none space-y-2 my-2 pl-0 counter-reset-item">{children}</ol>
                  ),
                  li: ({ children, ...props }) => {
                    const isOrdered = (props as any).ordered;
                    return (
                      <li className="flex gap-2 text-body">
                        <span className={`shrink-0 mt-0.5 ${isOrdered ? 'text-[#188BDB] font-semibold' : 'text-[#188BDB]'}`}>
                          {isOrdered ? '•' : '•'}
                        </span>
                        <span className="flex-1">{children}</span>
                      </li>
                    );
                  },
                  
                  // Code
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-surface-tertiary text-[#1479BF] px-1.5 py-0.5 rounded font-mono" style={{ fontSize: '0.85em' }}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg font-mono overflow-x-auto my-2" style={{ fontSize: '0.85em' }}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="my-2">{children}</pre>
                  ),
                  
                  // Links
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    className="text-[#188BDB] hover:text-[#1479BF] underline underline-offset-2"
                    >
                      {children}
                    </a>
                  ),
                  
                  // Blockquote
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-3 border-[#188BDB]/40 pl-3 my-2 text-muted italic">
                      {children}
                    </blockquote>
                  ),
                  
                  // Horizontale Linie
                  hr: () => (
                    <hr className="my-3 border-border-subtle" />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )
          ) : (
            <span className="text-muted">Denke nach...</span>
          )}
        </div>

        {/* Timestamp */}
        <div className={`
          text-[10px] mt-2 pt-1 border-t
          ${isUser 
            ? 'text-white/60 border-white/20' 
            : 'text-muted border-border-subtle'
          }
        `}>
          {message.timestamp.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default ChatMessage;
