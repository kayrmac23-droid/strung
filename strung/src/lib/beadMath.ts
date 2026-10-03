// Bead weight for the Bead Math calculator.
//
// The calculator used to estimate 0.5 g per mm of diameter for gemstone (0.3 g
// for glass), so weight grew linearly with size. Bead mass grows with VOLUME —
// the cube of the diameter — and the linear guess was wildly off at the small
// end: a 4 mm gemstone came out at 2 g against a real ~0.09 g. This treats each
// bead as a solid sphere of a typical density, which lands within the spread
// of real stones and glass. Holes and facets make real beads a touch lighter.

// g/cm³. Quartz family (amethyst, rose quartz, agate, jasper) sits around
// 2.6–2.7; soda-lime and Czech glass around 2.5.
export const BEAD_DENSITY = { gemstone: 2.65, glass: 2.5 } as const

export type BeadMaterial = keyof typeof BEAD_DENSITY

/** Approximate grams for one round bead of `diameterMm`. */
export function beadWeightGrams(diameterMm: number, material: BeadMaterial): number {
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return 0
  const radiusCm = diameterMm / 20
  const volumeCm3 = (4 / 3) * Math.PI * radiusCm ** 3
  return volumeCm3 * BEAD_DENSITY[material]
}
