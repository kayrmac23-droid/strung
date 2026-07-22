import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Newsreader, DM_Mono } from 'next/font/google'
import './globals.css'

// Display + interface grotesk (DESIGN §Type). No serif in the chrome (Rule 2).
const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument',
  display: 'swap',
})

// The hand in the margin — journal lines, AI asides, empty states only.
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
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
      <body className={`${instrument.variable} ${newsreader.variable} ${dmMono.variable}`}>{children}</body>
    </html>
  )
}
