export interface TaxChannel {
  key: string;
  label: string;
  shortLabel: string;
  /** DB field on FiscalSystem (if direct Float), or JSON key inside a serialised field */
  dbField: string;
  /** Fallback if DB has no data */
  defaultRate: number;
  min: number;
  max: number;
  step: number;
  accent: string; // tailwind color token (e.g. "emerald")
  accentClass: string;
  /** GDP-fraction base weight — overridden by real sector data when available */
  fallbackWeight: number;
}

export const TAX_CHANNELS: TaxChannel[] = [
  {
    key: "corporate",
    label: "Corporate Tax",
    shortLabel: "Corp",
    dbField: "corporateTaxRates",
    defaultRate: 21,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "emerald",
    accentClass: "text-emerald-400",
    fallbackWeight: 0.12,
  },
  {
    key: "income",
    label: "Income Tax",
    shortLabel: "Income",
    dbField: "personalIncomeTaxRates",
    defaultRate: 24,
    min: 0,
    max: 60,
    step: 0.5,
    accent: "cyan",
    accentClass: "text-cyan-400",
    fallbackWeight: 0.18,
  },
  {
    key: "vat",
    label: "VAT / Sales Tax",
    shortLabel: "VAT",
    dbField: "salesTaxRate",
    defaultRate: 15,
    min: 0,
    max: 30,
    step: 0.5,
    accent: "amber",
    accentClass: "text-amber-400",
    fallbackWeight: 0.15,
  },
  {
    key: "tariff",
    label: "Tariff Rate",
    shortLabel: "Tariff",
    dbField: "exciseTaxRates",
    defaultRate: 4.5,
    min: 0,
    max: 25,
    step: 0.5,
    accent: "indigo",
    accentClass: "text-indigo-400",
    fallbackWeight: 0.05,
  },
  {
    key: "wealth",
    label: "Wealth Tax",
    shortLabel: "Wealth",
    dbField: "wealthTaxRate",
    defaultRate: 1.5,
    min: 0,
    max: 10,
    step: 0.1,
    accent: "blue",
    accentClass: "text-blue-400",
    fallbackWeight: 0.03,
  },
  {
    key: "capGains",
    label: "Capital Gains Tax",
    shortLabel: "Cap Gains",
    dbField: "capitalGainsTax",
    defaultRate: 15,
    min: 0,
    max: 40,
    step: 0.5,
    accent: "red",
    accentClass: "text-red-400",
    fallbackWeight: 0.07,
  },
];

export const ACCENT_BORDER: Record<string, string> = {
  emerald: "border-emerald-500/30",
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  indigo: "border-indigo-500/30",
  blue: "border-blue-500/30",
  red: "border-red-500/30",
  purple: "border-indigo-500/30",
  teal: "border-cyan-500/30",
  rose: "border-red-500/30",
};

export const ACCENT_BG: Record<string, string> = {
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  purple: "bg-indigo-500",
  teal: "bg-cyan-500",
  rose: "bg-red-500",
};

export const SLIDER_RANGE_COLOR: Record<string, string> = {
  emerald: "[&_[data-slot=slider-range]]:bg-emerald-500",
  cyan: "[&_[data-slot=slider-range]]:bg-cyan-500",
  amber: "[&_[data-slot=slider-range]]:bg-amber-500",
  indigo: "[&_[data-slot=slider-range]]:bg-indigo-500",
  blue: "[&_[data-slot=slider-range]]:bg-blue-500",
  red: "[&_[data-slot=slider-range]]:bg-red-500",
  purple: "[&_[data-slot=slider-range]]:bg-indigo-500",
  teal: "[&_[data-slot=slider-range]]:bg-cyan-500",
  rose: "[&_[data-slot=slider-range]]:bg-red-500",
};

export const SLIDER_THUMB_COLOR: Record<string, string> = {
  emerald: "[&_[data-slot=slider-thumb]]:border-emerald-500",
  cyan: "[&_[data-slot=slider-thumb]]:border-cyan-500",
  amber: "[&_[data-slot=slider-thumb]]:border-amber-500",
  indigo: "[&_[data-slot=slider-thumb]]:border-indigo-500",
  blue: "[&_[data-slot=slider-thumb]]:border-blue-500",
  red: "[&_[data-slot=slider-thumb]]:border-red-500",
  purple: "[&_[data-slot=slider-thumb]]:border-indigo-500",
  teal: "[&_[data-slot=slider-thumb]]:border-cyan-500",
  rose: "[&_[data-slot=slider-thumb]]:border-red-500",
};

/** Parse a JSON-stringified field to extract a top-level rate number. */
export function parseRateFromJson(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "number") return parsed;
    if (typeof parsed === "string" && !isNaN(Number(parsed))) return Number(parsed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      return first?.rate ?? first?.baseRate ?? first?.value ?? fallback;
    }
    if (parsed && typeof parsed === "object") {
      return parsed.rate ?? parsed.baseRate ?? parsed.value ?? fallback;
    }
  } catch {
    const n = Number(raw);
    if (!isNaN(n)) return n;
  }
  return fallback;
}

/** Derive revenue sector weights from actual sector breakdown data. */
export function deriveSectorWeights(
  sectors: Array<{ name?: string; percentage?: number; gdpContribution?: number }> | undefined,
  exportsGdpPct: number | null | undefined,
  importsGdpPct: number | null | undefined
): Record<string, number> {
  const weights: Record<string, number> = {};

  if (!sectors || sectors.length === 0) {
    for (const ch of TAX_CHANNELS) weights[ch.key] = ch.fallbackWeight;
    return weights;
  }

  const totalPct = sectors.reduce((sum, s) => sum + (s.percentage ?? s.gdpContribution ?? 0), 0);
  const norm = totalPct > 0 ? totalPct / 100 : 1;

  let primaryPct = 0;
  let secondaryPct = 0;
  let tertiaryPct = 0;

  for (const s of sectors) {
    const pct = (s.percentage ?? s.gdpContribution ?? 0) / norm;
    const name = (s.name ?? "").toLowerCase();
    if (
      name.includes("agri") ||
      name.includes("mining") ||
      name.includes("extract") ||
      name.includes("fish") ||
      name.includes("forestry") ||
      name.includes("primary")
    ) {
      primaryPct += pct;
    } else if (
      name.includes("manufactur") ||
      name.includes("construct") ||
      name.includes("industr") ||
      name.includes("secondary") ||
      name.includes("energy") ||
      name.includes("utilit")
    ) {
      secondaryPct += pct;
    } else {
      tertiaryPct += pct;
    }
  }

  const sectorTotal = primaryPct + secondaryPct + tertiaryPct;
  if (sectorTotal > 0) {
    primaryPct = (primaryPct / sectorTotal) * 100;
    secondaryPct = (secondaryPct / sectorTotal) * 100;
    tertiaryPct = (tertiaryPct / sectorTotal) * 100;
  } else {
    primaryPct = 10;
    secondaryPct = 30;
    tertiaryPct = 60;
  }

  weights.corporate = (secondaryPct * 0.15 + tertiaryPct * 0.12) / 100;
  weights.income = (tertiaryPct * 0.25 + secondaryPct * 0.15 + primaryPct * 0.05) / 100;
  weights.vat = (tertiaryPct * 0.2 + secondaryPct * 0.12 + primaryPct * 0.05) / 100;

  const tradeOpenness = ((exportsGdpPct ?? 30) + (importsGdpPct ?? 30)) / 200;
  weights.tariff = Math.max(0.02, tradeOpenness * 0.1);
  weights.wealth = Math.max(0.01, (tertiaryPct * 0.05) / 100);
  weights.capGains = Math.max(0.02, (tertiaryPct * 0.1) / 100);

  return weights;
}
