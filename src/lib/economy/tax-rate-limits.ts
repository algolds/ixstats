/**
 * The range each national tax rate may take, in percent: the Fiscal policy sliders and the
 * `economics.updateFiscalSystem` input check share it. Client-safe.
 */

export interface RateLimit {
  min: number;
  max: number;
}

export const TAX_RATE_LIMITS = {
  corporate: { min: 0, max: 50 },
  income: { min: 0, max: 60 },
  vat: { min: 0, max: 30 },
  tariff: { min: 0, max: 25 },
  wealth: { min: 0, max: 10 },
  capGains: { min: 0, max: 40 },
} as const satisfies Record<string, RateLimit>;

/** Any other percent a fiscal field holds (a builder excise entry, property or payroll tax). */
export const PERCENT_LIMIT: RateLimit = { min: 0, max: 100 };

const within = (value: unknown, { min, max }: RateLimit) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Rate keys a JSON rate field may carry, each with its range; other keys use `fallback`. */
export type RateKeyLimits = Record<string, RateLimit>;

function entryWithin(entry: unknown, keyLimits: RateKeyLimits, fallback: RateLimit): boolean {
  if (!entry || typeof entry !== "object") return false;
  const { type, rate } = entry as Record<string, unknown>;
  return within(rate, (typeof type === "string" && keyLimits[type]) || fallback);
}

/**
 * True when a JSON rate field holds only rates in range: a bare number, an object of numbers
 * (`{ incomeRate: 22 }`), or a list of `{ rate, type? }` entries (brackets, excise lists).
 * Anything else (non-JSON, nested objects, strings) is refused.
 */
export function rateJsonWithin(
  raw: string,
  keyLimits: RateKeyLimits,
  fallback: RateLimit
): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof parsed === "number") return within(parsed, fallback);
  if (Array.isArray(parsed)) return parsed.every((e) => entryWithin(e, keyLimits, fallback));
  if (!parsed || typeof parsed !== "object") return false;
  return Object.entries(parsed as Record<string, unknown>).every(([key, value]) =>
    within(value, keyLimits[key] ?? fallback)
  );
}
