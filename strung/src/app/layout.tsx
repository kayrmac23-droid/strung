import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

// Fonts are self-hosted from ./fonts (latin subset woff2, OFL — licences
// alongside) rather than loaded through next/font/google, which fetches from
// Google at build time and fails the whole build when that fetch does.

// Display + interface grotesk (DESIGN §Type). No serif in the chrome (Rule 2).
const instrument = localFont({
  src: './fonts/InstrumentSans-Variable.woff2',
  weight: '400 600',
  variable: '--font-instrument',
  display: 'swap',
})

// Display serif for headings — single-weight face (400 only).
const instrumentSerif = localFont({
  src: './fonts/InstrumentSerif-Regular.woff2',
  weight: '400',
  variable: '--font-instrument-serif',
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
    <html lang="en">
      <body className={`${instrument.variable} ${instrumentSerif.variable} ${newsreader.variable} ${dmMono.variable}`}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
