import type { RealCountryData } from "../lib/economy-data-service";

export interface CountryArchetype {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  filter: (country: RealCountryData) => boolean;
  gradient: string;
}

export interface CountryPreview {
  country: RealCountryData;
  economicScore: number;
  stabilityScore: number;
  potentialScore: number;
}

export { formatNumber } from "~/lib/utils";

export const generateCountryPreview = (country: RealCountryData): CountryPreview => {
  const economicScore = Math.min(100, ((country.gdpPerCapita || 0) / 80000) * 100);
  const stabilityScore = Math.max(
    20,
    100 - (country.unemploymentRate || 0) * 5 - Math.abs((country.inflationRate || 2) - 2) * 10
  );
  const potentialScore = Math.min(100, (country.growthRate || 0) * 20 + 60);

  return {
    country,
    economicScore,
    stabilityScore,
    potentialScore,
  };
};

const REGIONS_AND_GROUPS = new Set([
  "world",
  "north america",
  "post-demographic dividend",
  "high income",
  "euro area",
  "oecd members",
  "europe & central asia",
  "other small states",
  "small states",
  "central europe and the baltics",
  "caribbean small states",
  "latin america & caribbean",
  "east asia & pacific",
  "middle east & north africa",
  "upper middle income",
  "late-demographic dividend",
  "arab world",
  "china (occupied territories)",
  "ibrd only",
  "middle income",
  "ida & ibrd total",
  "low & middle income",
  "pacific island small states",
  "early-demographic dividend",
  "fragile and conflict affected situations",
  "lower middle income",
  "africa western and central",
  "ida blend",
  "sub-saharan africa",
  "africa eastern and southern",
  "pre-demographic dividend",
  "south asia",
  "ida total",
  "least developed countries: un classification",
  "ida only",
  "heavily indebted poor countries (hipc)",
  "low income",
  "europe & central asia (excluding high income)",
  "europe & central asia (ida & ibrd countries)",
  "latin america & caribbean (excluding high income)",
  "latin america & the caribbean (ida & ibrd countries)",
  "east asia & pacific (excluding high income)",
  "east asia & pacific (ida & ibrd countries)",
  "middle east & north africa (excluding high income)",
  "middle east & north africa (ida & ibrd countries)",
  "sub-saharan africa (excluding high income)",
  "sub-saharan africa (ida & ibrd countries)",
  "south asia (ida & ibrd)",
]);

export const filterCountries = (
  countries: RealCountryData[],
  searchTerm: string,
  selectedArchetypes: string[], // Changed to array
  archetypes: CountryArchetype[]
): RealCountryData[] => {
  let filtered = countries.filter(
    (country) => !REGIONS_AND_GROUPS.has(country.name.toLowerCase().trim())
  );

  if (searchTerm) {
    filtered = filtered.filter(
      (country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.countryCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (country.continent || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (selectedArchetypes.length > 0) {
    // Faceted filtering: OR within the same category (e.g. Europe OR Asia), AND across categories (e.g. Europe AND Advanced Economy)
    const categoryGroups = new Map<string, string[]>();

    selectedArchetypes.forEach((archetypeId) => {
      const archetype = archetypes.find((a) => a.id === archetypeId);
      const catKey = (archetype as { categoryId?: string })?.categoryId || "default";
      if (!categoryGroups.has(catKey)) {
        categoryGroups.set(catKey, []);
      }
      categoryGroups.get(catKey)!.push(archetypeId);
    });

    filtered = filtered.filter((country) => {
      for (const groupIds of categoryGroups.values()) {
        const matchesCategory = groupIds.some((id) => {
          const arch = archetypes.find((a) => a.id === id);
          return arch ? arch.filter(country) : false;
        });
        if (!matchesCategory) return false;
      }
      return true;
    });
  }

  // Ensure unique country codes
  const uniqueCountryCodes = new Set<string>();
  const uniqueFiltered = filtered.filter((country) => {
    if (uniqueCountryCodes.has(country.countryCode)) {
      return false;
    }
    uniqueCountryCodes.add(country.countryCode);
    return true;
  });

  // Deterministic shuffle based on search term and archetype
  const shuffled = [...uniqueFiltered];
  const seed = (searchTerm + selectedArchetypes.join("")).split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Fisher-Yates shuffle with seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    const rand = (((seed + i) * 9301 + 49297) % 233280) / 233280;
    const j = Math.floor(rand * (i + 1));
    if (j >= 0 && j < shuffled.length && j !== i) {
      [shuffled[i], shuffled[j]] = [shuffled[j] as RealCountryData, shuffled[i] as RealCountryData];
    }
  }

  return shuffled as RealCountryData[];
};
