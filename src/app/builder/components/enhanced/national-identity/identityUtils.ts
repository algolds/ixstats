/**
 * National Identity utility helpers for name derivation, ceremonial title formatting,
 * and currency metadata resolution.
 */

/**
 * Derives a default demonym from a country name.
 * e.g., "Eldoria" -> "Eldorian", "France" -> "Francian", "Canada" -> "Canadian"
 */
export function deriveDemonym(countryName: string): string {
  const trimmed = countryName.trim();
  if (!trimmed) return "";

  // Common irregulars
  const lower = trimmed.toLowerCase();
  if (lower === "united states" || lower === "america") return "American";
  if (lower === "united kingdom" || lower === "britain") return "British";
  if (lower === "england") return "English";
  if (lower === "scotland") return "Scottish";
  if (lower === "wales") return "Welsh";
  if (lower === "ireland") return "Irish";
  if (lower === "france") return "French";
  if (lower === "spain") return "Spanish";
  if (lower === "germany") return "German";
  if (lower === "japan") return "Japanese";
  if (lower === "china") return "Chinese";
  if (lower === "greece") return "Greek";
  if (lower === "switzerland") return "Swiss";
  if (lower === "netherlands") return "Dutch";
  if (lower === "sweden") return "Swedish";
  if (lower === "denmark") return "Danish";
  if (lower === "poland") return "Polish";

  if (trimmed.endsWith("ia")) {
    return `${trimmed}n`;
  }
  if (trimmed.endsWith("a")) {
    return `${trimmed}n`;
  }
  if (trimmed.endsWith("y")) {
    return `${trimmed.slice(0, -1)}ian`;
  }
  if (trimmed.endsWith("land")) {
    return `${trimmed}er`;
  }
  if (trimmed.endsWith("e")) {
    return `${trimmed.slice(0, -1)}an`;
  }
  if (trimmed.endsWith("i")) {
    return `${trimmed}an`;
  }
  if (trimmed.endsWith("o")) {
    return `${trimmed}an`;
  }

  return `${trimmed}ian`;
}

/**
 * Standard prefix mapping for common government types.
 */
const GOV_PREFIX_MAP: Record<string, string> = {
  Republic: "The Republic of",
  Kingdom: "The Kingdom of",
  Federation: "The Federation of",
  Commonwealth: "The Commonwealth of",
  Emirate: "The Emirate of",
  Principality: "The Principality of",
  "Holy State": "The Holy State of",
  Union: "The Union of",
  Empire: "The Empire of",
  Sultanate: "The Sultanate of",
  Duchy: "The Duchy of",
  Confederacy: "The Confederacy of",
  Alliance: "The Alliance of",
  Coalition: "The Coalition of",
  Dominion: "The Dominion of",
  Territories: "The Territories of",
  Protectorate: "The Protectorate of",
  Mandate: "The Mandate of",
  "City-State": "The City-State of",
  "Free State": "The Free State of",
  "Socialist Republic": "The Socialist Republic of",
  "Democratic Republic": "The Democratic Republic of",
  "People's Republic": "The People's Republic of",
  "Autonomous Region": "The Autonomous Region of",
  "Sovereign State": "The Sovereign State of",
  Nation: "The Nation of",
  Country: "The Country of",
  State: "The State of",
};

/**
 * Generates an official ceremonial name given a short country name and government type.
 * e.g., ("Eldoria", "Kingdom") -> "The Kingdom of Eldoria"
 */
export function formatCeremonialName(countryName: string, governmentType: string): string {
  const trimmedName = countryName.trim();
  if (!trimmedName) return "";

  const prefix = GOV_PREFIX_MAP[governmentType];
  if (prefix) {
    return `${prefix} ${trimmedName}`;
  }

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

  const words = trimmed
    .split(/\s+/)
    .filter((w) => !/^(the|of|and|for|in|de|du|la|le)$/i.test(w));

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
