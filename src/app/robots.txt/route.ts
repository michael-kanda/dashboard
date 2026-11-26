// src/app/robots.txt/route.ts
// Pro Domain: www.datapeak.at darf indexiert werden, das Dashboard (app.datapeak.at) nicht.
import { isMarketingHost, MARKETING_ORIGIN } from '@/lib/site-hosts';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const body = isMarketingHost(request.headers.get('host'))
    ? `User-agent: *\nAllow: /\n\nSitemap: ${MARKETING_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
