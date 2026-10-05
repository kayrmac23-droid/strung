import type { BeadForm } from '@/lib/bead'

// Illustrative beads for the public pages (landing, How it works). These are
// marketing props, not anyone's stash — the signed-in studio only ever draws
// real stash data.

export type DemoBead = { name: string; size: string; qty: number; hex: string; shape: BeadForm; px: number }

export const DEMO: Record<string, DemoBead> = {
  b1:  { name: 'Garnet rondelle', size: '6×4mm', qty: 42, hex: '#7A1F2B', shape: 'rondelle', px: 9 },
  b9:  { name: 'Oxblood seed', size: '11/0', qty: 640, hex: '#6B2228', shape: 'seed', px: 5 },
  b12: { name: 'Freshwater pearl', size: '7mm', qty: 16, hex: '#E8E1D3', shape: 'round', px: 10 },
  b2:  { name: 'Labradorite', size: '8mm', qty: 18, hex: '#5E6B6E', shape: 'round', px: 12 },
  b15: { name: 'Carnelian tube', size: '10×4mm', qty: 12, hex: '#B5482E', shape: 'tube', px: 7 },
  b6:  { name: 'Tiger eye', size: '8mm', qty: 14, hex: '#9A6A2E', shape: 'round', px: 11 },
  b11: { name: 'Citrine chip', size: '5–8mm', qty: 35, hex: '#D9A441', shape: 'chip', px: 8 },
  b14: { name: 'Prehnite', size: '6mm', qty: 6, hex: '#B5C48A', shape: 'round', px: 9 },
  b4:  { name: 'Fire-polish, forest', size: '4mm', qty: 120, hex: '#2F4A3A', shape: 'bicone', px: 8 },
  b10: { name: 'Aquamarine rondelle', size: '5×3mm', qty: 22, hex: '#8FB8BE', shape: 'rondelle', px: 8 },
  b16: { name: 'Larimar', size: '8mm', qty: 4, hex: '#8EC3D6', shape: 'round', px: 11 },
  b13: { name: 'Iolite bicone', size: '4mm', qty: 40, hex: '#4A4F8A', shape: 'bicone', px: 8 },
  b5:  { name: 'Amethyst chip', size: '5–8mm', qty: 60, hex: '#7A5A8C', shape: 'chip', px: 8 },
  b3:  { name: 'Moonstone', size: '6mm', qty: 30, hex: '#D9D4C8', shape: 'round', px: 9 },
  b8:  { name: 'Matte black seed', size: '11/0', qty: 966, hex: '#1E1B1A', shape: 'seed', px: 5 },
}

export type DemoId = keyof typeof DEMO

/** Props for <Bead> at `scale` × the bead's nominal size. */
export const demo = (id: string, scale: number) => {
  const b = DEMO[id]
  return { hex: b.hex, shape: b.shape, size: b.px * scale, title: undefined as string | undefined }
}
