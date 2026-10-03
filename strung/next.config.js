/** @type {import('next').NextConfig} */

// React Fast Refresh compiles with eval in development, so 'unsafe-eval' has to
// be present for `next dev` to work at all. It must NOT ship to production —
// leaving it in the deployed policy hands any injected script the eval
// primitive the rest of the CSP is trying to deny.
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  // Speed Insights loads its debug script from va.vercel-scripts.com under
  // `next dev` only; in production it is served same-origin from /_vercel.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted from src/app/fonts — no third-party font origin.
  "font-src 'self'",
  // AI previews arrive as data: URIs from /api/make/image; no remote image host.
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  // No plugin content anywhere.
  "object-src 'none'",
  // Stops an injected <base> from re-pointing every relative URL on the page.
  "base-uri 'self'",
  // Stops an injected form from posting credentials to an attacker's origin.
  "form-action 'self'",
].join('; ')

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // The legacy XSS auditor is gone from every current browser and its
          // blocking mode could itself be abused; '0' is the current guidance.
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera=(self): the Stash photo identification flow opens the camera
          // on this origin. camera=() blocked it outright.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}
module.exports = nextConfig
