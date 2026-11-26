// src/app/og-datapeak.png/route.tsx
// Vorschaubild für Links auf www.datapeak.at (Open Graph, 1200 × 630).
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0066CC',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#FFFFFF',
              color: '#0066CC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            DP
          </div>
          DataPeak
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
            Ihre Daten. Endlich verständlich.
          </div>
          <div style={{ fontSize: 34, opacity: 0.85 }}>
            Search Console, Analytics, Google Ads und KI-Traffic in einem Dashboard.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
    },
  );
}
