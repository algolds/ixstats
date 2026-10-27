/**
 * Pure Exchange arithmetic and formatting, safe to import from client components (no database).
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatSovereigns(n: number): string {
  return `₷${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
