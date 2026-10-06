/**
 * Pure Exchange arithmetic, safe to import from client components (no database).
 * The server prices conversions with the same function, so the preview matches.
 */

export type ConvertDirection = "CONVERT_IN" | "CONVERT_OUT";

export interface ConversionQuote {
  direction: ConvertDirection;
  /** IxCredits debited (in) or credited (out). */
  ixCredits: number;
  /** Sovereigns credited (in) or debited (out). */
  sovereigns: number;
  /** The fee, in ₷ either way. */
  fee: number;
  rate: number;
}

/** Round down to whole hundredths, so the Exchange never pays out a fraction it didn't take in. */
export function floor2(n: number): number {
  return Math.floor(n * 100 + 1e-9) / 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * CONVERT_IN: ₷ = IxC × rate − fee, fee = IxC × rate × feeRate.
 * CONVERT_OUT: IxC = (₷ − fee) ÷ rate, fee = ₷ × feeRate.
 */
export function quoteConversion(
  direction: ConvertDirection,
  amount: number,
  cfg: { convertRate: number; convertFee: number }
): ConversionQuote {
  const rate = cfg.convertRate;
  if (direction === "CONVERT_IN") {
    const gross = amount * rate;
    const fee = round2(gross * cfg.convertFee);
    return { direction, ixCredits: amount, sovereigns: floor2(gross - fee), fee, rate };
  }
  const fee = round2(amount * cfg.convertFee);
  return { direction, ixCredits: floor2((amount - fee) / rate), sovereigns: amount, fee, rate };
}

export function formatSovereigns(n: number): string {
  return `₷${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
