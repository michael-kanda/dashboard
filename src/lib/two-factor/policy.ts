// Wer muss die Zwei-Faktor-Anmeldung nutzen? Ohne Node-Abhängigkeiten, damit
// auch Middleware und Client-Komponenten die Regel verwenden können.

export const TWO_FACTOR_SETUP_PATH = '/konto/zwei-faktor';

export function isTwoFactorRequired(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

/** Muss die Person die Zwei-Faktor-Anmeldung noch einrichten, bevor sie weiterarbeiten darf? */
export function needsTwoFactorSetup(role: string | null | undefined, enabled: boolean | null | undefined): boolean {
  return isTwoFactorRequired(role) && enabled === false;
}
