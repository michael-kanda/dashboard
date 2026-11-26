// src/app/sitemap.xml/route.ts
// Sitemap nur für die Landingpage-Domain; das Dashboard hat keine.
import { isMarketingHost, MARKETING_ORIGIN } from '@/lib/site-hosts';

export const dynamic = 'force-dynamic';

const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'monthly' },
  { path: '/impressum', priority: '0.2', changefreq: 'yearly' },
  { path: '/datenschutz', priority: '0.2', changefreq: 'yearly' },
];

export function GET(request: Request) {
  if (!isMarketingHost(request.headers.get('host'))) {
    return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
  }

  const urls = PAGES.map((page) => [
    '  <url>',
    `    <loc>${MARKETING_ORIGIN}${page.path}</loc>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
