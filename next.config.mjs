// next.config.mjs
import { buildCsp, CSP_HEADER } from './src/lib/csp.mjs';
const disableSentryBuild = process.env.DISABLE_SENTRY_BUILD === '1';
const enableSentryBuild = process.env.DISABLE_SENTRY_BUILD !== '1'
  && (process.env.VERCEL === '1' || process.env.CI === 'true');
const withSentryConfig = enableSentryBuild
  ? (await import('@sentry/nextjs/config')).withSentryConfig
  : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.ag-consulting.at',
        port: '',
        pathname: '/**',
      },
      // Neue Domains:
      {
        protocol: 'https',
        hostname: 'max-online.at',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.max-online.at',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'designare.at',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.designare.at',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Nur www.datapeak.at (und datapeak.at) darf in Suchmaschinen erscheinen.
  // Das Dashboard auf app.datapeak.at, vercel.app und Previews sind noindex.
  async headers() {
    return [
      // Sicherheits-Header für alle Seiten. HSTS setzt Vercel selbst (max-age=63072000).
      // Keine fremde Seite darf DataPeak einbetten (Schutz vor Clickjacking, z. B. auf der Anmeldeseite).
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
          // Vollständige Policy, vorerst nur beobachtend (src/lib/csp.mjs)
          { key: CSP_HEADER, value: buildCsp({ isDev: process.env.NODE_ENV === 'development' }) },
        ],
      },
      {
        source: '/:path*',
        missing: [{ type: 'host', value: '(www\\.)?datapeak\\.at' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  // Serverseitig nicht bündeln (u. a. damit @react-pdf/renderer im App Router funktioniert)
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@getbrevo/brevo',
    'googleapis',
    'google-auth-library',
  ],
  experimental: {
    optimizePackageImports: ['react-bootstrap-icons', 'lucide-react'],
  },
  // Turbopack (Standard ab Next 16): canvas wird von PDF-Bibliotheken optional angefragt,
  // wird aber nicht gebraucht. Ohne Sentry-Build ersetzt ein Stub das Sentry-Paket.
  turbopack: {
    resolveAlias: {
      canvas: './scripts/empty-module.mjs',
      ...(disableSentryBuild ? { '@sentry/nextjs': './scripts/sentry-build-stub.mjs' } : {}),
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "designare",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
