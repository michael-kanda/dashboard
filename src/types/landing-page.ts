// src/types/landing-page.ts

/** Eine Seite, die Besucher nach einer Landingpage aufrufen. */
export interface FollowUpPath {
  path: string;
  sessions: number;
  percentage: number;
}

/** Antwort von `/api/landing-page-followup` bzw. `getLandingPageFollowUpPaths`. */
export interface LandingPageFollowUpData {
  landingPage: string;
  totalSessions: number;
  landingPageSessions: number;
  followUpPaths: FollowUpPath[];
}
