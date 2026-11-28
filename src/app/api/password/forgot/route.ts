// „Passwort vergessen?“: schickt einen einmaligen Link, wenn zur Adresse ein Konto besteht.
// Öffentlich (siehe scripts/audit-code.mjs). Die Antwort ist immer gleich und braucht
// mindestens MIN_RESET_RESPONSE_MS, egal ob die Adresse existiert, begrenzt wurde oder die Mail scheitert.

import { NextResponse } from 'next/server';
import { readClientIp } from '@/lib/login-throttle';
import { createResetToken, resetLinkFor } from '@/lib/password-reset/token';
import { respondToResetRequest } from '@/lib/password-reset/request';
import {
  countRecentResetRequests,
  findUserByEmail,
  recordAccountEvent,
  recordResetRequest,
  storeResetToken,
} from '@/lib/password-reset/repository';
import { resetBaseUrl, sendResetMail } from '@/lib/password-reset/mail';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const response = await respondToResetRequest(body?.email, readClientIp(req), {
    countRecentRequests: countRecentResetRequests,
    recordRequest: recordResetRequest,
    findUser: async (email) => {
      const user = await findUserByEmail(email);
      if (user) await recordAccountEvent(user, 'password_reset_requested');
      return user;
    },
    issueLink: async (userId) => {
      const { token, hash, expiresAt } = createResetToken();
      await storeResetToken(userId, hash, expiresAt);
      return resetLinkFor(resetBaseUrl(req.url), token);
    },
    sendMail: sendResetMail,
    log: (outcome, userId) => logger.info(`[Passwort] Link angefordert: ${outcome}${userId ? ` (Konto ${userId})` : ''}`),
  }, {
    onError: (error) => console.error('[Passwort] Anfrage fehlgeschlagen:', error instanceof Error ? error.message : error),
  });

  return NextResponse.json(response.body, { status: response.status });
}
