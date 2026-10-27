/**
 * Global formatting utilities: numbers, currencies (ISO 4217 and custom) and populations, scaled
 * to K/M/B/T for readability.
 */

const ISO_CURRENCY_CODES = new Set(
  "USD EUR GBP JPY AUD CAD CHF CNY SEK NZD MXN SGD HKD NOK TRY RUB INR BRL ZAR KRW PLN TWD THB DKK CZK HUF ILS CLP PHP AED COP SAR MYR RON BGN HRK ISK UAH QAR KWD BHD OMR JOD LBP EGP MAD TND DZD LYD SDG ETB KES UGX TZS ZMW BWP SZL LSL NAD MUR SCR KMF DJF RWF BIF CDF AOA XAF XOF XPF".split(
    " "
  )
);

interface CustomCurrency {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
}

const CUSTOM_CURRENCIES: Record<string, CustomCurrency> = {
  Taler: { code: "Taler", symbol: "₮", name: "Taler", decimalPlaces: 2 },
  Crown: { code: "Crown", symbol: "©", name: "Crown", decimalPlaces: 2 },
  Mark: { code: "Mark", symbol: "ℳ", name: "Mark", decimalPlaces: 2 },
  Ducat: { code: "Ducat", symbol: "₫", name: "Ducat", decimalPlaces: 2 },
  Guilder: { code: "Guilder", symbol: "ƒ", name: "Guilder", decimalPlaces: 2 },
  Pound: { code: "Pound", symbol: "£", name: "Pound", decimalPlaces: 2 },
  Franc: { code: "Franc", symbol: "₣", name: "Franc", decimalPlaces: 2 },
  Lira: { code: "Lira", symbol: "₤", name: "Lira", decimalPlaces: 2 },
  Peso: { code: "Peso", symbol: "₱", name: "Peso", decimalPlaces: 2 },
  Real: { code: "Real", symbol: "R$", name: "Real", decimalPlaces: 2 },
  Aureus: { code: "Aureus", symbol: "₷", name: "Aureus", decimalPlaces: 2 },
};

const DYNAMIC_CUSTOM_CURRENCIES: Record<string, CustomCurrency> = {};

export function registerCustomCurrency(
  code: string,
  symbol: string,
  name: string = code,
  decimalPlaces: number = 2
): void {
  if (!code) return;
  DYNAMIC_CUSTOM_CURRENCIES[code] = { code, symbol, name, decimalPlaces };
}

const SCALES = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
] as const;

const isMissing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || Number.isNaN(value);

const localeNumber = (value: number, minDigits: number, maxDigits = minDigits) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

const currencyFormat = (currency: string, minDigits: number, maxDigits = minDigits) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

const isISOCurrency = (currency: string) => ISO_CURRENCY_CODES.has(currency.toUpperCase());

/** A built-in or registered custom currency, matched case-insensitively. */
function getCustomCurrency(currency: string): CustomCurrency | null {
  if (!currency) return null;
  const upper = currency.toUpperCase();
  for (const table of [CUSTOM_CURRENCIES, DYNAMIC_CUSTOM_CURRENCIES]) {
    const key = Object.keys(table).find((k) => k.toUpperCase() === upper);
    if (key) return table[key] || null;
  }
  return null;
}

/** Scaled custom-currency format, e.g. "₮1.2K". Unknown codes use the code (or its "(P$)" symbol) as the prefix. */
function formatCustomCurrency(amount: number, currency: string, forceDecimals = false): string {
  if (isMissing(amount)) return "N/A";
  const symbol =
    getCustomCurrency(currency)?.symbol ||
    currency.match(/\(([^)]+)\)/)?.[1]?.trim() ||
    currency.trim();
  const prefix = symbol ? (symbol.length <= 3 ? symbol : `${symbol} `) : "";

  const scale = SCALES.find(([limit]) => Math.abs(amount) >= limit);
  if (!scale) return `${prefix}${localeNumber(amount, forceDecimals ? 2 : 0)}`;
  const [limit, suffix] = scale;
  return `${prefix}${localeNumber(amount / limit, 1, suffix === "K" ? 1 : 2)}${suffix}`;
}

/**
 * Format currency with automatic scaling (K/M/B/T)
 *
 * @example
 * formatCurrency(1234) → "$1.2K"
 * formatCurrency(1200000000000) → "$1.2T"
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  forceDecimals = false
): string {
  if (isMissing(amount)) return "N/A";
  if (!isISOCurrency(currency)) return formatCustomCurrency(amount, currency, forceDecimals);

  try {
    const scale = SCALES.find(([limit]) => Math.abs(amount) >= limit);
    if (!scale) return currencyFormat(currency, forceDecimals ? 2 : 0).format(amount);
    return currencyFormat(currency, 1).format(amount / scale[0]) + scale[1];
  } catch (error) {
    console.warn(
      `Failed to format currency ${currency}, falling back to custom formatting:`,
      error
    );
    return formatCustomCurrency(amount, currency, forceDecimals);
  }
}

/**
 * Format plain numbers with automatic scaling (K/M/B/T)
 *
 * @example
 * formatNumber(1234) → "1.2K"
 * formatNumber(125000) → "125.0K"
 */
export function formatNumber(num: number, decimals: number = 1): string {
  const scale = SCALES.find(([limit]) => Math.abs(num) >= limit);
  return scale ? (num / scale[0]).toFixed(decimals) + scale[1] : localeNumber(num, 0, decimals);
}

/**
 * Format a raw percentage value (already multiplied by 100)
 *
 * @example
 * formatPercent(15.5) → "15.5%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + "%";
}

/** Whole-unit amount in a custom currency: its symbol, or the raw code as a prefix when unknown. */
function formatExactCustom(amount: number, currency: string): string {
  const custom = getCustomCurrency(currency);
  return `${custom ? custom.symbol : `${currency} `}${localeNumber(amount, 0)}`;
}

/**
 * Format currency with full precision (no scaling)
 *
 * @example
 * formatExactCurrency(1234567890) → "$1,234,567,890"
 */
export function formatExactCurrency(amount: number, currency: string = "USD"): string {
  if (isMissing(amount)) return "N/A";
  if (!isISOCurrency(currency)) return formatExactCustom(amount, currency);
  try {
    return currencyFormat(currency, 0).format(amount);
  } catch (error) {
    console.warn(
      `Failed to format exact currency ${currency}, falling back to custom formatting:`,
      error
    );
    return formatExactCustom(amount, currency);
  }
}

/**
 * The scaled value without formatting
 *
 * @example
 * getScaledValue(1234567) → { value: 1.2, suffix: 'M' }
 */
export function getScaledValue(num: number): { value: number; suffix: string } {
  const scale = SCALES.find(([limit]) => Math.abs(num) >= limit);
  return scale ? { value: num / scale[0], suffix: scale[1] } : { value: num, suffix: "" };
}

/** All available currency codes (ISO + custom) */
export function getAvailableCurrencies(): string[] {
  return [
    ...ISO_CURRENCY_CODES,
    ...Object.keys(CUSTOM_CURRENCIES),
    ...Object.keys(DYNAMIC_CUSTOM_CURRENCIES),
  ];
}

const ISO_CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "CA$",
  CHF: "CHF",
  CNY: "¥",
  SEK: "kr",
  NZD: "NZ$",
  MXN: "Mex$",
  SGD: "S$",
  HKD: "HK$",
  NOK: "kr",
  TRY: "₺",
  RUB: "₽",
  INR: "₹",
  BRL: "R$",
  ZAR: "R",
  KRW: "₩",
  PLN: "zł",
  TWD: "NT$",
  THB: "฿",
  DKK: "kr",
  CZK: "Kč",
  HUF: "Ft",
  ILS: "₪",
  CLP: "$",
  PHP: "₱",
  AED: "د.إ",
  COP: "$",
  SAR: "﷼",
  MYR: "RM",
  RON: "lei",
  BGN: "лв",
  HRK: "kn",
  ISK: "kr",
  UAH: "₴",
};

/** Currency information (symbol and, for custom currencies, name) */
export function getCurrencyInfo(currency: string): {
  isISO: boolean;
  symbol?: string;
  name?: string;
} {
  if (isISOCurrency(currency)) {
    return { isISO: true, symbol: ISO_CURRENCY_SYMBOLS[currency.toUpperCase()] };
  }
  const customCurrency = getCustomCurrency(currency);
  return customCurrency
    ? { isISO: false, symbol: customCurrency.symbol, name: customCurrency.name }
    : { isISO: false };
}

export function isValidCurrency(currency: string): boolean {
  return isISOCurrency(currency) || getCustomCurrency(currency) !== null;
}

/** Currency formatting that falls back to another currency (then plain digits) instead of failing */
export function safeFormatCurrency(
  amount: number,
  currency: string = "USD",
  forceDecimals: boolean = false,
  fallbackCurrency: string = "USD"
): string {
  try {
    if (!isValidCurrency(currency)) throw new Error(`Invalid currency code: ${currency}`);
    return formatCurrency(amount, currency, forceDecimals);
  } catch (error) {
    console.warn(
      `Currency formatting failed for ${currency}, using fallback ${fallbackCurrency}:`,
      error
    );
    try {
      return formatCurrency(amount, fallbackCurrency, forceDecimals);
    } catch {
      return `${currency} ${localeNumber(amount, forceDecimals ? 2 : 0)}`;
    }
  }
}

const SUFFIX_MULTIPLIERS: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/**
 * Parse user input into a number, handling various formats
 * ("1.5M", "50k", "1,000,000", "$25.5k"); NaN when invalid.
 */
export function parseNumberInput(input: string | number): number {
  if (typeof input === "number") return input;

  // Strip currency symbols (including custom ones) and spaces
  const cleaned = input.replace(/[^-\d.KMBTkmbt]/g, "").toUpperCase();
  const match = cleaned.match(/^(-?[\d.]+)([KMBT])?$/);
  if (!match) return parseFloat(cleaned);

  const [, numStr, suffix] = match;
  const baseNum = parseFloat(numStr!);
  return suffix ? baseNum * (SUFFIX_MULTIPLIERS[suffix] || 1) : baseNum;
}

/**
 * Compact notation (K/M/B/T) via Intl.NumberFormat, with a fallback for null/undefined/NaN
 *
 * @example
 * formatCompactNumber(1234567) → "1.2M"
 * formatCompactNumber(null) → "N/A"
 */
export function formatCompactNumber(value: number | null | undefined, fallback = "N/A"): string {
  if (isMissing(value)) return fallback;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

/**
 * Currency in compact notation via Intl.NumberFormat, with a fallback for null/undefined/NaN
 *
 * @example
 * formatCompactCurrency(1234567) → "$1.2M"
 * formatCompactCurrency(5000, "Unknown", "EUR") → "€5K"
 */
export function formatCompactCurrency(
  value: number | null | undefined,
  fallback = "N/A",
  currency = "USD"
): string {
  if (isMissing(value)) return fallback;

  if (!isISOCurrency(currency)) {
    const custom = getCustomCurrency(currency);
    // Unregistered custom currencies avoid the RangeError Intl.NumberFormat would throw
    if (!custom) return `${currency} ${formatCompactNumber(value, fallback)}`;
    const scale = SCALES.find(([limit]) => Math.abs(value) >= limit);
    return scale
      ? `${custom.symbol}${(value / scale[0]).toFixed(1)}${scale[1]}`
      : `${custom.symbol}${value.toFixed(0)}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch (error) {
    console.warn(`Failed to format compact currency ${currency}:`, error);
    return formatCompactNumber(value, fallback);
  }
}

/**
 * Time duration in years
 *
 * @example
 * formatYears(5.5) → "5.5 yrs"
 */
export function formatYears(value: number | null | undefined, fallback = "N/A"): string {
  return isMissing(value) ? fallback : `${value.toFixed(1)} yrs`;
}

/**
 * Population with whole-number scaling (B/M/K)
 *
 * @example
 * formatPopulation(1234567) → "1M"
 * formatPopulation(5678) → "6K"
 */
export function formatPopulation(population: number | null | undefined, fallback = "N/A"): string {
  if (isMissing(population)) return fallback;
  const scale = SCALES.slice(1).find(([limit]) => Math.abs(population) >= limit);
  return scale
    ? `${Math.round(population / scale[0])}${scale[1]}`
    : Math.round(population).toString();
}
