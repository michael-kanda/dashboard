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
        <label className="dp-label">E-Mail *</label>
        <div className="relative mt-1">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange} 
            required
            className="dp-field pr-10"
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
          <label htmlFor="new-user-password" className="dp-label">Passwort</label>
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
              className="dp-field mt-1"
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
        <label className="dp-label">Mandant-ID (Label)</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="mandantId"
            value={formData.mandantId}
            onChange={handleInputChange} 
            placeholder="max-online"
            className="dp-field pr-10"
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
        <label className="dp-label">Ansprache</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="ansprache"
            value={formData.ansprache}
            onChange={handleInputChange}
            placeholder="Herr Muster oder Frau Muster"
            className="dp-field pr-10"
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
          <label className="dp-label">
            Admin-Berechtigungen (kommagetrennt)
          </label>
          <div className="relative mt-1">
            <input
              type="text"
              name="permissions"
              value={formData.permissions}
              onChange={handleInputChange} 
              placeholder={isSuperAdmin ? "z.B. kann_admins_verwalten" : "Nur von Superadmin editierbar"}
              className="dp-field pr-10"
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
