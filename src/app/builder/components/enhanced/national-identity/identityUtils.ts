/**
 * National Identity utility helpers for name derivation, ceremonial title formatting,
 * and currency metadata resolution.
 */

const IRREGULAR_DEMONYMS: Record<string, string> = {
  "united states": "American",
  america: "American",
  "united kingdom": "British",
  britain: "British",
  england: "English",
  scotland: "Scottish",
  wales: "Welsh",
  ireland: "Irish",
  france: "French",
  spain: "Spanish",
  germany: "German",
  japan: "Japanese",
  china: "Chinese",
  greece: "Greek",
  switzerland: "Swiss",
  netherlands: "Dutch",
  sweden: "Swedish",
  denmark: "Danish",
  poland: "Polish",
};

/** `[ending, letters dropped, suffix added]`, tried in order. */
const DEMONYM_SUFFIXES: Array<[string, number, string]> = [
  ["a", 0, "n"],
  ["y", 1, "ian"],
  ["land", 0, "er"],
  ["e", 1, "an"],
  ["i", 0, "an"],
  ["u", 0, "an"],
  ["o", 1, "an"],
];

/**
 * Derives a default demonym from a country name.
 * e.g., "Eldoria" -> "Eldorian", "France" -> "French", "Canada" -> "Canadian"
 */
export function deriveDemonym(countryName: string): string {
  const trimmed = countryName.trim();
  if (!trimmed) return "";

  const irregular = IRREGULAR_DEMONYMS[trimmed.toLowerCase()];
  if (irregular) return irregular;

  const rule = DEMONYM_SUFFIXES.find(([ending]) => trimmed.endsWith(ending));
  if (!rule) return `${trimmed}ian`;
  const [, dropped, suffix] = rule;
  return `${trimmed.slice(0, trimmed.length - dropped)}${suffix}`;
}

/**
 * Generates an official ceremonial name given a short country name and government type.
 * e.g., ("Eldoria", "Kingdom") -> "The Kingdom of Eldoria"
 */
export function formatCeremonialName(countryName: string, governmentType: string): string {
  const trimmedName = countryName.trim();
  if (!trimmedName) return "";

  if (governmentType && governmentType !== "custom" && governmentType !== "Other") {
    return `The ${governmentType} of ${trimmedName}`;
  }

  return trimmedName;
}

/**
 * Quick currency reference definitions for UI badges and lookups.
 */
export const POPULAR_CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "Pound Sterling" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CHF", symbol: "Fr", label: "Swiss Franc" },
  { code: "BTC", symbol: "₿", label: "Bitcoin" },
  { code: "ETH", symbol: "Ξ", label: "Ethereum" },
  { code: "Taler", symbol: "₮", label: "Taler" },
  { code: "Crown", symbol: "👑", label: "Crown" },
  { code: "Mark", symbol: "ℳ", label: "Mark" },
  { code: "Credit", symbol: "₡", label: "Credit" },
] as const;

/**
 * Standard reference languages for autocomplete and quick selection.
 */
export const POPULAR_LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Japanese",
  "Arabic",
  "Russian",
  "Portuguese",
  "Italian",
  "Dutch",
  "Swedish",
  "Latin",
] as const;

/**
 * Normalizes flag CDN URLs to SVG vector assets for crisp high-resolution rendering.
 */
export function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }
  return url;
}

/**
 * Derives an ISO 3166-1 alpha-2 style country code from a country name.
 * e.g. "Eldoria" -> "EL", "New Zealand" -> "NZ", "United States" -> "US"
 */
export function deriveIsoCode(countryName: string): string {
  const trimmed = countryName.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/).filter((w) => !/^(the|of|and|for|in|de|du|la|le)$/i.test(w));

  if (words.length >= 2) {
    const first = words[0]?.charAt(0).toUpperCase() || "";
    const second = words[1]?.charAt(0).toUpperCase() || "";
    return `${first}${second}`;
  }

  const alpha = trimmed.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return alpha.slice(0, 2);
}

/**
 * Derives a top-level domain from a country name or ISO code.
 * e.g. ("Eldoria", "EL") -> ".el"
 */
export function deriveInternetTld(countryName: string, isoCode?: string): string {
  const iso = isoCode?.trim() || deriveIsoCode(countryName);
  if (!iso) return "";
  return `.${iso.toLowerCase()}`;
}

/**
 * Derives a deterministic international calling code from a country name.
 * Returns a 2-to-3 digit calling code formatted with a leading '+'.
 */
export function deriveCallingCode(countryName: string): string {
  const trimmed = countryName.trim();
  if (!trimmed) return "";

  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  // Generates calling code in range +10 to +999
  const code = (hash % 890) + 10;
  return `+${code}`;
}
