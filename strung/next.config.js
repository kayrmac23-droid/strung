/** @type {import('next').NextConfig} */

// React Fast Refresh compiles with eval in development, so 'unsafe-eval' has to
// be present for `next dev` to work at all. It must NOT ship to production —
// leaving it in the deployed policy hands any injected script the eval
// primitive the rest of the CSP is trying to deny.
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // pollinations is the live image host for the co-designer's visual preview —
  // removing it blanks that panel.
  "img-src 'self' data: https://image.pollinations.ai",
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.pollinations.ai' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
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
