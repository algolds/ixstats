/**
 * Pure Exchange arithmetic and formatting, safe to import from client components (no database).
 */

export function toCents(n: number): number {
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return c / 100;
}

/** Convert a stored cent value (database `bigint`, or a number from an aggregate default) into a safe integer `number` of cents. */
export function centsOf(b: bigint | number): number {
  const n = Number(b);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Cents value out of safe integer range: ${b}`);
  }
  return n;
}

/** Convert an integer `number` of cents into a database `bigint`. */
export function dbCents(n: number): bigint {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Cents value must be a safe integer: ${n}`);
  }
  return BigInt(n);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatSovereigns(n: number): string {
  return `₷${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
