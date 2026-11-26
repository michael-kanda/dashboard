// src/app/admin/edit/[id]/ProjectSupportManager.tsx
// Betreuung eines Projekts: welche Admins (und Superadmins) das Projekt betreuen.
'use client';

import { useState } from 'react';
import { PeopleFill } from 'react-bootstrap-icons';
import { toast } from 'sonner';
import { roleLabel } from '@/lib/ui-labels';

export interface SupportStaff {
  id: string;
  email: string;
  role: string;
  mandant_id: string | null;
}

interface ProjectSupportManagerProps {
  projectId: string;
  staff: SupportStaff[];
  assignedIds: string[];
  /** Ersteller des Projekts; betreut es, solange niemand zugewiesen ist. */
  creatorEmail: string | null;
}

export default function ProjectSupportManager({
  projectId,
  staff,
  assignedIds,
  creatorEmail,
}: ProjectSupportManagerProps) {
  const [assigned, setAssigned] = useState<string[]>(assignedIds);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = async (member: SupportStaff) => {
    const isAssigned = assigned.includes(member.id);
    setPendingId(member.id);
    try {
      const response = await fetch(`/api/projects/${projectId}/assign`, {
        method: isAssigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      setAssigned((current) => (isAssigned ? current.filter((id) => id !== member.id) : [...current, member.id]));
      toast.success(isAssigned ? `${member.email} betreut das Projekt nicht mehr` : `${member.email} betreut jetzt das Projekt`);
    } catch (error) {
      toast.error('Betreuung konnte nicht geändert werden', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="bg-surface p-8 rounded-lg border border-border">
      <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
        <PeopleFill size={20} /> Betreuung
      </h2>
      <p className="text-sm text-muted mb-6">
        Wer dieses Projekt betreut, sieht es im Admin-Bereich und steht im Dashboard als Ansprechperson.
        {assigned.length === 0 && creatorEmail && (
          <> Solange niemand zugewiesen ist, betreut es der Ersteller <span className="font-medium text-body">{creatorEmail}</span>.</>
        )}
      </p>

      {staff.length === 0 ? (
        <p className="text-muted text-sm">Keine Admins verfügbar.</p>
      ) : (
        <ul className="border border-border rounded-lg divide-y divide-border bg-surface-secondary">
          {staff.map((member) => {
            const checked = assigned.includes(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  id={`support-${member.id}`}
                  checked={checked}
                  onChange={() => void toggle(member)}
                  disabled={pendingId !== null}
                  className="w-4 h-4 text-accent border-border rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                <label htmlFor={`support-${member.id}`} className="flex-1 cursor-pointer text-sm text-body">
                  <span className="font-medium">{member.email}</span>
                  <span className="ml-2 text-xs text-muted">
                    {roleLabel(member.role)}{member.mandant_id ? ` · ${member.mandant_id}` : ''}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
