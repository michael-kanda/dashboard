// designare-evita/dasboard/dasboard-51c35db465e734e54d24d3ac7e57518724990087/next.config.mjs
import { fileURLToPath } from 'node:url';

const disableSentryBuild = process.env.DISABLE_SENTRY_BUILD === '1';
const enableSentryBuild = process.env.DISABLE_SENTRY_BUILD !== '1'
  && (process.env.VERCEL === '1' || process.env.CI === 'true');
const withSentryConfig = enableSentryBuild
  ? (await import('@sentry/nextjs')).withSentryConfig
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
  // WICHTIG: Damit @react-pdf/renderer im App Router funktioniert
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      '@getbrevo/brevo',
      'googleapis',
      'google-auth-library',
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    if (disableSentryBuild) {
      config.resolve.alias['@sentry/nextjs$'] = fileURLToPath(
        new URL('./scripts/sentry-build-stub.mjs', import.meta.url)
      );
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: "designare",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true
});
