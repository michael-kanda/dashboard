// src/app/admin/edit/[id]/sections/AccountSection.tsx
'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle } from 'react-bootstrap-icons';
import type { User } from '@/types';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface AccountSectionProps {
  user: Pick<User, 'role'>;
  isSuperAdmin: boolean;
  formData: Pick<EditUserFormData, 'email' | 'mandantId' | 'ansprache' | 'permissions'>;
  handleInputChange: InputChangeHandler;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  isChangingPassword: boolean;
  setIsChangingPassword: Dispatch<SetStateAction<boolean>>;
  isSubmitting: boolean;
}

// E-Mail, Passwort, Mandant-ID, Ansprache und Admin-Berechtigungen.
export default function AccountSection({
  user,
  isSuperAdmin,
  formData,
  handleInputChange,
  password,
  setPassword,
  isChangingPassword,
  setIsChangingPassword,
  isSubmitting,
}: AccountSectionProps) {
  return (
    <>
      {/* --- E-Mail --- */}
      <div>
        <label className="block text-sm font-medium text-body">E-Mail *</label>
        <div className="relative mt-1">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange} 
            required
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed"
            disabled={isSubmitting}
          />
          {formData.email && !isSubmitting && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
      </div>

      {/* --- Passwort --- */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="new-user-password" className="block text-sm font-medium text-body">Passwort</label>
          <button
            type="button"
            onClick={() => { setIsChangingPassword(!isChangingPassword); setPassword(''); }}
            className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isChangingPassword ? 'Abbrechen' : 'Passwort ändern'}
          </button>
        </div>
        {isChangingPassword ? (
          <>
            <input
              id="new-user-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Neues Passwort, mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
              disabled={isSubmitting}
              autoFocus
            />
            <p className={`mt-1 text-xs ${password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? 'text-danger' : 'text-muted'}`}>
              {password.length}/{MIN_PASSWORD_LENGTH} Zeichen. Leer lassen, um das Passwort nicht zu ändern.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">Das bestehende Passwort bleibt unverändert.</p>
        )}
      </div>

      {/* --- Mandant-ID --- */}
      <div className="border-t pt-4 mt-4">
        <label className="block text-sm font-medium text-body">Mandant-ID (Label)</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="mandantId"
            value={formData.mandantId}
            onChange={handleInputChange} 
            placeholder="z.B. max-online"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting || !isSuperAdmin}
            readOnly={!isSuperAdmin}
          />
          {formData.mandantId && !isSubmitting && isSuperAdmin && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
      </div>

      {/* --- Ansprache --- */}
      <div>
        <label className="block text-sm font-medium text-body">Ansprache</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="ansprache"
            value={formData.ansprache}
            onChange={handleInputChange}
            placeholder="z.B. Herr Muster oder Frau Muster"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.ansprache && !isSubmitting && (
            <CheckCircle
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success"
              size={16}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Wird für Login-Meldung und DataMax-Begrüßung verwendet.
        </p>
      </div>

      {/* --- Admin-Berechtigungen --- */}
      {isSuperAdmin && user.role === 'ADMIN' && (
        <div>
          <label className="block text-sm font-medium text-body">
            Admin-Berechtigungen (kommagetrennt)
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              name="permissions"
              value={formData.permissions}
              onChange={handleInputChange} 
              placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
              className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
              disabled={isSubmitting || !isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
            {formData.permissions && !isSubmitting && (
              <CheckCircle 
                className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
                size={16}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            Labels mit Komma trennen.
          </p>
        </div>
      )}
    </>
  );
}
