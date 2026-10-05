import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

// Fonts are self-hosted from ./fonts (latin subset woff2, OFL — licences
// alongside) rather than loaded through next/font/google, which fetches from
// Google at build time and fails the whole build when that fetch does.

// Interface grotesk (DESIGN §Type) — body, UI and the wordmark.
const instrument = localFont({
  src: './fonts/InstrumentSans-Variable.woff2',
  weight: '400 600',
  variable: '--font-instrument',
  display: 'swap',
})

// Gloock — the display face for every heading (2026-10 redesign handoff).
// Single weight (400). Latin subset from Google Fonts, self-hosted like the rest.
const gloock = localFont({
  src: './fonts/Gloock-Regular.woff2',
  weight: '400',
  variable: '--font-gloock',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

// The hand in the margin — journal lines, AI asides, empty states only.
const newsreader = localFont({
  src: './fonts/Newsreader-Italic-Variable.woff2',
  weight: '400 500',
  style: 'italic',
  variable: '--font-newsreader',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

const dmMono = localFont({
  src: [
    { path: './fonts/DMMono-Light.woff2', weight: '300' },
    { path: './fonts/DMMono-Regular.woff2', weight: '400' },
  ],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Strung — Beaded Jewellery Design Studio',
  description: 'Design beaded jewellery with AI. Track your bead stash, generate design blueprints from your inventory, and learn the craft.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables go on <html>, not <body>: globals.css composes them
    // into --font-body / --font-mono / --font-serif on :root, and a var() that
    // is undefined where it is declared makes the whole custom property invalid.
    // On <body> they were, so every face silently fell back to Times New Roman.
    <html lang="en" className={`${instrument.variable} ${gloock.variable} ${newsreader.variable} ${dmMono.variable}`}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
