/** How the Calibration tab words its figures and the gaps between them. Pure. */

/** A share (0-1) as a percentage with one decimal: 0.2203 -> "22.0%". */
export const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

/** A count or size in short form: 272569 -> "273k", 1443534 -> "1.44M", 83 -> "83". */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

const signed = (text: string, value: number): string =>
  value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;

/** The world's share against the realm's, in percentage points: "+9.2 pts". */
export function shareGap(world: number, realm: number): string {
  const points = (world - realm) * 100;
  const rounded = Math.round(Math.abs(points) * 10) / 10;
  return `${signed(rounded.toFixed(1), rounded === 0 ? 0 : points)} pts`;
}

/** The world's count or size against the realm's: "+53", "-120k". */
export function amountGap(world: number, realm: number): string {
  const difference = world - realm;
  const text = compact(Math.abs(difference));
  return signed(text, text === "0" ? 0 : difference);
}
