// Stash colour constants — product data, not chrome (DESIGN Rule 6 & step 5).
// The stash is the one place saturated colour belongs, so these live as concrete
// hexes rather than referencing the neutral interface tokens.

export type BeadColour = { name: string; hex: string }

// The bead-colour picker palette (24 gem tones).
export const beadColours: BeadColour[] = [
  { name: 'Amethyst purple',  hex: '#8a70aa' },
  { name: 'Lavender',         hex: '#b8a0d4' },
  { name: 'Rose quartz pink', hex: '#d4a0b0' },
  { name: 'Deep magenta',     hex: '#9b2355' },
  { name: 'Coral pink',       hex: '#e8806a' },
  { name: 'Garnet red',       hex: '#6b1a2a' },
  { name: 'Ruby red',         hex: '#9b1a2a' },
  { name: 'Carnelian orange', hex: '#c8502a' },
  { name: 'Citrine yellow',   hex: '#c8a860' },
  { name: 'Lemon quartz',     hex: '#d4c840' },
  { name: 'Peridot green',    hex: '#8aaa40' },
  { name: 'Sage green',       hex: '#6a9080' },
  { name: 'Emerald green',    hex: '#2a7a50' },
  { name: 'Malachite',        hex: '#1a6a40' },
  { name: 'Aquamarine teal',  hex: '#6aafb8' },
  { name: 'Turquoise',        hex: '#3aa8a0' },
  { name: 'Labradorite blue', hex: '#7a9ab8' },
  { name: 'Moonstone silver', hex: '#a8b4c8' },
  { name: 'Iolite violet',    hex: '#5a5a9a' },
  { name: 'Lapis lazuli',     hex: '#1a3a8a' },
  { name: 'Tiger eye amber',  hex: '#b07840' },
  { name: 'Smoky quartz',     hex: '#6a5a4a' },
  { name: 'Pearl cream',      hex: '#e8e0d0' },
  { name: 'Onyx black',       hex: '#1a1a2e' },
]

// Per-type accent used on the bead-type meta line. Concrete gem-family tones —
// these read as material swatches, so they stay off the interface tokens.
export const typeColours: Record<string, string> = {
  gemstone: '#7a9ab8',
  crystal:  '#8a70aa',
  glass:    '#6a9080',
  seed:     '#a8b4c8',
  metal:    '#5a6e88',
  pearl:    '#c8b8a8',
  resin:    '#c87040',
  other:    '#9C8070',
}

// Findings render by metal, not by colour — these are the metal tones the
// schematic fills each finding glyph with.
export const metalColours: Record<string, string> = {
  silver:      '#C0C4C8',
  gold_filled: '#D4AF6A',
  gold:        '#D9A441',
  copper:      '#B06A3B',
  brass:       '#AE8B4F',
  oxidised:    '#4A4A4E',
  other:       '#8A8A8A',
}
