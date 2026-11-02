// src/components/NoDataState.tsx
import React from 'react';
import { Inbox } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

interface NoDataStateProps {
  message?: string;
  className?: string;
}

export default function NoDataState({ 
  message = "Keine Daten verfügbar", 
  className 
}: NoDataStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full w-full py-6 animate-in fade-in zoom-in-95 duration-300", className)}>
      <div className="bg-surface-secondary p-4 rounded-full mb-3 border border-border-subtle">
        <Inbox size={24} className="text-faint" />
      </div>
      <p className="text-sm font-medium text-muted text-center max-w-[200px]">
        {message}
      </p>
    </div>
  );
}
