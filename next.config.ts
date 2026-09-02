import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            // LOW-06 Fix: Added Permissions-Policy to restrict unnecessary browser APIs
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), payment=(self), microphone=(self)',
          },
          // LOW-07 Fix: Removed deprecated X-XSS-Protection header.
          // It is removed from modern browsers and can introduce XSS vulnerabilities
          // in old ones. Rely on CSP instead for XSS protection.
        ],
      },
    ];
  },
};

export default nextConfig;
