export const MIN_PASSWORD_LENGTH = 10;

export function getPasswordError(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  }
  return null;
}
