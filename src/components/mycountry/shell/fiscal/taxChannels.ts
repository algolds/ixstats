export interface TaxChannel {
  key: string;
  label: string;
  shortLabel: string;
  /** DB field on FiscalSystem (if direct Float), or JSON key inside a serialised field */
  dbField: string;
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
    label: "Corporate tax",
    shortLabel: "Corp",
    dbField: "corporateTaxRates",
    min: 0,
    max: 50,
    step: 0.5,
    accent: "emerald",
    accentClass: "text-green",
    fallbackWeight: 0.12,
  },
  {
    key: "income",
    label: "Income tax",
    shortLabel: "Income",
    dbField: "personalIncomeTaxRates",
    min: 0,
    max: 60,
    step: 0.5,
    accent: "cyan",
    accentClass: "text-cyan",
    fallbackWeight: 0.18,
  },
  {
    key: "vat",
    label: "VAT / Sales Tax",
    shortLabel: "VAT",
    dbField: "salesTaxRate",
    min: 0,
    max: 30,
    step: 0.5,
    accent: "amber",
    accentClass: "text-yellow",
    fallbackWeight: 0.15,
  },
  {
    key: "tariff",
    label: "Tariff rate",
    shortLabel: "Tariff",
    dbField: "exciseTaxRates",
    min: 0,
    max: 25,
    step: 0.5,
    accent: "indigo",
    accentClass: "text-indigo",
    fallbackWeight: 0.05,
  },
  {
    key: "wealth",
    label: "Wealth tax",
    shortLabel: "Wealth",
    dbField: "wealthTaxRate",
    min: 0,
    max: 10,
    step: 0.1,
    accent: "blue",
    accentClass: "text-blue",
    fallbackWeight: 0.03,
  },
  {
    key: "capGains",
    label: "Capital gains tax",
    shortLabel: "Cap Gains",
    dbField: "capitalGainsTax",
    min: 0,
    max: 40,
    step: 0.5,
    accent: "red",
    accentClass: "text-red",
    fallbackWeight: 0.07,
  },
];

export const ACCENT_BG: Record<string, string> = {
  emerald: "bg-green",
  cyan: "bg-cyan",
  amber: "bg-yellow",
  indigo: "bg-indigo",
  blue: "bg-blue",
  red: "bg-red",
  purple: "bg-indigo",
  teal: "bg-cyan",
  rose: "bg-red",
};

interface FiscalRatesRow {
  corporateTaxRates?: string | null;
  personalIncomeTaxRates?: string | null;
  salesTaxRate?: number | null;
  exciseTaxRates?: string | null;
  wealthTaxRate?: number | null;
}

interface SavedRate {
  /** The saved rate, or null when the nation has none for this tax. */
  rate: number | null;
  /**
   * True when the field holds the builder's bracket list (`[{ bracket|size, rate }]`). The
   * console shows the top rate read-only rather than flattening the brackets on save.
   */
  bracketed: boolean;
}

/** `ExciseTaxRates` array entries the console owns, when the builder stored an array. */
const EXCISE_ENTRY_TYPE: Record<string, string> = { tariff: "tariff", capGains: "capitalGains" };
/** Keys the console writes inside a JSON object for each channel. */
const OBJECT_KEY: Record<string, string> = {
  corporate: "corporateRate",
  income: "incomeRate",
  tariff: "tariffRate",
  capGains: "capitalGainsRate",
};

function finite(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function parseJson(raw: string | null | undefined): unknown {
  if (raw == null || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Read a bracketed/flat rate field (income, corporate): `{incomeRate}`, `"25"`, `25` or brackets. */
function readRateField(raw: string | null | undefined, objectKey: string): SavedRate {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    const rates = parsed
      .map((b) => (b && typeof b === "object" ? finite((b as Record<string, unknown>).rate) : null))
      .filter((r): r is number => r != null);
    return rates.length > 0
      ? { rate: Math.max(...rates), bracketed: true }
      : { rate: null, bracketed: false };
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    return { rate: finite(obj[objectKey] ?? obj.rate ?? obj.baseRate), bracketed: false };
  }
  return { rate: finite(parsed), bracketed: false };
}

/** Read a console-owned entry out of `exciseTaxRates` (object key or builder array entry). */
function readExciseRate(raw: string | null | undefined, channelKey: string): SavedRate {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    const entry = parsed.find(
      (e) =>
        e &&
        typeof e === "object" &&
        (e as Record<string, unknown>).type === EXCISE_ENTRY_TYPE[channelKey]
    ) as Record<string, unknown> | undefined;
    return { rate: finite(entry?.rate), bracketed: false };
  }
  if (parsed && typeof parsed === "object") {
    return {
      rate: finite((parsed as Record<string, unknown>)[OBJECT_KEY[channelKey]!]),
      bracketed: false,
    };
  }
  return { rate: null, bracketed: false };
}

/** The rates a nation has saved, per channel key. Missing rates are null, never a default. */
export function readSavedRates(
  fiscal: FiscalRatesRow | null | undefined
): Record<string, SavedRate> {
  return {
    corporate: readRateField(fiscal?.corporateTaxRates, OBJECT_KEY.corporate!),
    income: readRateField(fiscal?.personalIncomeTaxRates, OBJECT_KEY.income!),
    vat: { rate: finite(fiscal?.salesTaxRate), bracketed: false },
    tariff: readExciseRate(fiscal?.exciseTaxRates, "tariff"),
    wealth: { rate: finite(fiscal?.wealthTaxRate), bracketed: false },
    capGains: readExciseRate(fiscal?.exciseTaxRates, "capGains"),
  };
}

export interface FiscalRateUpdate {
  corporateTaxRates?: string;
  personalIncomeTaxRates?: string;
  salesTaxRate?: number;
  exciseTaxRates?: string;
  wealthTaxRate?: number;
}

/**
 * The `updateFiscalSystem` fields that save one channel's rate. Only that channel's column is
 * written; `exciseTaxRates` is merged (object keys or typed array entries) so the tariff and
 * capital gains rates don't overwrite each other or the builder's excise list.
 */
export function fiscalUpdateForRate(
  channelKey: string,
  rate: number,
  currentExcise: string | null | undefined
): FiscalRateUpdate {
  switch (channelKey) {
    case "corporate":
      return { corporateTaxRates: JSON.stringify({ corporateRate: rate }) };
    case "income":
      return { personalIncomeTaxRates: JSON.stringify({ incomeRate: rate }) };
    case "vat":
      return { salesTaxRate: rate };
    case "wealth":
      return { wealthTaxRate: rate };
    case "tariff":
    case "capGains": {
      const parsed = parseJson(currentExcise);
      if (Array.isArray(parsed)) {
        const type = EXCISE_ENTRY_TYPE[channelKey]!;
        const others = parsed.filter(
          (e) => !(e && typeof e === "object" && (e as Record<string, unknown>).type === type)
        );
        return { exciseTaxRates: JSON.stringify([...others, { type, rate }]) };
      }
      const base = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      return { exciseTaxRates: JSON.stringify({ ...base, [OBJECT_KEY[channelKey]!]: rate }) };
    }
    default:
      return {};
  }
}

export interface TaxYields {
  /** Yield per channel; null when the rate isn't set or GDP isn't known. */
  byChannel: Record<string, number | null>;
  /** Sum of the known yields; null when none is known. */
  total: number | null;
}

/**
 * Projected yield per tax: GDP x rate x revenue weight x collection efficiency. Channels without
 * a set rate (and every channel when GDP is unknown) have no yield rather than a default one.
 * When `taxEfficiency` is unknown the yields are before collection losses.
 */
export function computeTaxYields(
  rates: Record<string, number | null>,
  gdp: number | null,
  taxEfficiency: number | null,
  weights: Record<string, number>
): TaxYields {
  const byChannel: Record<string, number | null> = {};
  let total: number | null = null;
  for (const ch of TAX_CHANNELS) {
    const rate = rates[ch.key];
    if (rate == null || gdp == null || gdp <= 0) {
      byChannel[ch.key] = null;
      continue;
    }
    const weight = weights[ch.key] ?? ch.fallbackWeight;
    const value = gdp * (rate / 100) * weight * (taxEfficiency ?? 1);
    byChannel[ch.key] = value;
    total = (total ?? 0) + value;
  }
  return { byChannel, total };
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

  const exp = exportsGdpPct ?? importsGdpPct;
  const imp = importsGdpPct ?? exportsGdpPct;
  weights.tariff =
    exp != null && imp != null
      ? Math.max(0.02, ((exp + imp) / 200) * 0.1)
      : (TAX_CHANNELS.find((c) => c.key === "tariff")?.fallbackWeight ?? 0.05);
  weights.wealth = Math.max(0.01, (tertiaryPct * 0.05) / 100);
  weights.capGains = Math.max(0.02, (tertiaryPct * 0.1) / 100);

  return weights;
}
