/**
 * The passport guilloché as SVG path data. Pure and client-safe: the front face draws it, and the
 * OG image (`src/lib/og`) draws the same pattern.
 */

/** One rosette: centre and radius as fractions of the canvas, lobe count and woven strand count. */
interface Rosette {
  cx: number;
  cy: number;
  /** Fraction of the canvas's shorter side. */
  r: number;
  lobes: number;
  strands: number;
}

const ROSETTES: readonly Rosette[] = [
  { cx: 0.88, cy: 0.16, r: 0.42, lobes: 14, strands: 10 },
  { cx: 0.04, cy: 1.02, r: 0.6, lobes: 18, strands: 10 },
  { cx: 0.6, cy: 0.98, r: 0.26, lobes: 10, strands: 8 },
];

/** Line segments per lobe: enough for a smooth hairline at the low opacity it is drawn at. */
const SEGMENTS_PER_LOBE = 8;
/** Lobe depth as a fraction of the rosette radius. */
const AMPLITUDE = 0.14;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** One closed strand: a lobed circle whose phase is shifted by `phase` so strands interweave. */
function strandPath(cx: number, cy: number, radius: number, lobes: number, phase: number): string {
  const steps = lobes * SEGMENTS_PER_LOBE;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const rho = radius * (1 - AMPLITUDE + AMPLITUDE * Math.cos(lobes * theta + phase));
    points.push(`${fmt(cx + rho * Math.cos(theta))} ${fmt(cy + rho * Math.sin(theta))}`);
  }
  return `M${points.join("L")}Z`;
}

/**
 * The guilloché as SVG path data for a `width` x `height` canvas: a few rosettes of interwoven,
 * phase-shifted lobed strands. Deterministic, so the page and the OG image draw the same pattern.
 */
export function guillochePaths(width: number, height: number): string[] {
  const side = Math.min(width, height);
  return ROSETTES.flatMap(({ cx, cy, r, lobes, strands }) =>
    Array.from({ length: strands }, (_, s) =>
      strandPath(cx * width, cy * height, r * side, lobes, (s / strands) * Math.PI * 2)
    )
  );
}
