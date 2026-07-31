import { JWT } from 'google-auth-library';

export const GOOGLE_SCOPES = {
  analytics: 'https://www.googleapis.com/auth/analytics.readonly',
  searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly',
  sheets: 'https://www.googleapis.com/auth/spreadsheets.readonly',
} as const;

type ServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
};

function readServiceAccountCredentials(): ServiceAccountCredentials {
  if (process.env.GOOGLE_CREDENTIALS) {
    let credentials: unknown;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch {
      throw new Error('GOOGLE_CREDENTIALS enthaelt kein gueltiges JSON.');
    }

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('GOOGLE_CREDENTIALS hat ein ungueltiges Format.');
    }

    const value = credentials as Record<string, unknown>;
    if (typeof value.client_email !== 'string' || typeof value.private_key !== 'string') {
      throw new Error('GOOGLE_CREDENTIALS fehlen client_email oder private_key.');
    }

    return { clientEmail: value.client_email, privateKey: value.private_key };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  if (!clientEmail || !privateKeyBase64) {
    throw new Error('Google API Credentials fehlen.');
  }

  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('GOOGLE_PRIVATE_KEY_BASE64 enthaelt keinen gueltigen Private Key.');
  }

  return { clientEmail, privateKey };
}

export function createGoogleAuth(scopes: readonly string[]): JWT {
  const credentials = readServiceAccountCredentials();
  return new JWT({
    email: credentials.clientEmail,
    key: credentials.privateKey,
    scopes: [...scopes],
  });
}

export function tryCreateGoogleAuth(scopes: readonly string[]): JWT | null {
  try {
    return createGoogleAuth(scopes);
  } catch {
    return null;
  }
}
