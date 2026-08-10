const LEGACY_DEMO_EMAILS = new Set<string>([]);

type DemoCandidate = {
  email?: string | null;
  domain?: string | null;
  is_demo?: boolean | null;
};

export function isDemoProject(user: DemoCandidate | null | undefined): boolean {
  if (!user) return false;
  if (user.is_demo === true) return true;

  const email = user.email?.trim().toLowerCase();
  if (email && LEGACY_DEMO_EMAILS.has(email)) return true;

  const domain = user.domain?.trim().toLowerCase();
  return domain === 'demo-shop.de' || domain === 'www.demo-shop.de';
}
