import type { Metadata, Viewport } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
