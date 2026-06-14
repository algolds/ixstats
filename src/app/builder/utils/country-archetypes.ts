import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  DollarSign,
  TrendingUp,
  BarChart3,
  Crown, // For geographical
  Building, // For government
  Globe, // For continents
  Users, // For population tiers
  Banknote, // For region
  // eslint-disable-next-line unused-imports/no-unused-imports
  Scale, // For legal systems
  // eslint-disable-next-line unused-imports/no-unused-imports
  Shield, // For military/security
  Vote, // For democratic systems
  Gavel, // For judicial systems
  BookOpen, // For legal codes
} from "lucide-react";
import type { CountryArchetype } from "./country-selector-utils";
import type { RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";

function getPopulationTier(population: number): "Very Large" | "Large" | "Medium" | "Small" {
  if (population >= 100000000) return "Very Large";
  if (population >= 25000000) return "Large";
  if (population >= 5000000) return "Medium";
  return "Small";
}

// ─── Consolidated Categories (New - 3 categories) ───

export interface ConsolidatedCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  priority: number;
}

export const consolidatedCategories: ConsolidatedCategory[] = [
  {
    id: "economy-size",
    name: "Economy & Size",
    description: "Filter by economic development level and population size",
    color: "text-emerald-500",
    priority: 1,
  },
  {
    id: "region",
    name: "Region",
    description: "Filter by geographical location",
    color: "text-blue-500",
    priority: 2,
  },
  {
    id: "government",
    name: "Government",
    description: "Filter by political and legal systems",
    color: "text-purple-500",
    priority: 3,
  },
];

// Map old categoryId to new consolidatedCategoryId
const categoryMapping: Record<string, string> = {
  "economic-classifications": "economy-size",
  "population-demographics": "economy-size",
  "geographical-regions": "region",
  "political-systems": "government",
  "legal-systems": "government",
};

// ─── Legacy Categories (kept for backwards compatibility) ───

// Define ArchetypeCategory type to match Prisma schema
export interface ArchetypeCategory {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color class
  priority: number;
  isActive: boolean;
}

// Extend CountryArchetype to include categoryId
export interface CategorizedCountryArchetype extends CountryArchetype {
  priority: number;
  categoryId: string;
  consolidatedCategoryId: string; // New consolidated category
  gradient: string; // Ensure gradient is always present
}

export const archetypeCategories: ArchetypeCategory[] = [
  {
    id: "economic-classifications",
    name: "Economic Classifications",
    description: "Archetypes based on economic development and performance indicators.",
    color: "text-blue-500",
    priority: 10,
    isActive: true,
  },
  {
    id: "population-demographics",
    name: "Population Demographics",
    description: "Archetypes based on population size and demographics.",
    color: "text-green-500",
    priority: 20,
    isActive: true,
  },
  {
    id: "geographical-regions",
    name: "Geographical Regions",
    description: "Archetypes based on continental and regional location.",
    color: "text-purple-500",
    priority: 30,
    isActive: true,
  },
  {
    id: "political-systems",
    name: "Political Systems",
    description: "Archetypes based on government type and political structure.",
    color: "text-red-500",
    priority: 40,
    isActive: true,
  },
  {
    id: "legal-systems",
    name: "Legal Systems",
    description: "Archetypes based on legal framework and judicial systems.",
    color: "text-amber-500",
    priority: 50,
    isActive: true,
  },
];

// Helper to add consolidatedCategoryId to archetypes
function withConsolidatedCategory<T extends { categoryId: string }>(
  archetype: T
): T & { consolidatedCategoryId: string } {
  return {
    ...archetype,
    consolidatedCategoryId: categoryMapping[archetype.categoryId] || "economy-size",
  };
}

// ─── Curated Archetypes for the new panel (trimmed for clarity) ───

const rawArchetypes = [
  // Economy & Size - Economic Tiers
  {
    id: "tier-advanced",
    name: "Advanced Economy",
    description: "Very high GDP per capita (>$50,000)",
    icon: Banknote,
    color: "text-emerald-600",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Advanced",
    gradient: "from-emerald-600/20 to-green-600/10",
    categoryId: "economic-classifications",
    priority: 1,
  },
  {
    id: "tier-developed",
    name: "Developed Economy",
    description: "High GDP per capita ($25,000-$50,000)",
    icon: Banknote,
    color: "text-lime-600",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Developed",
    gradient: "from-lime-600/20 to-green-600/10",
    categoryId: "economic-classifications",
    priority: 2,
  },
  {
    id: "tier-emerging",
    name: "Emerging Economy",
    description: "Moderate GDP per capita ($10,000-$25,000)",
    icon: TrendingUp,
    color: "text-purple-600",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Emerging",
    gradient: "from-purple-600/20 to-pink-600/10",
    categoryId: "economic-classifications",
    priority: 3,
  },
  {
    id: "tier-developing",
    name: "Developing Economy",
    description: "Lower GDP per capita (<$10,000)",
    icon: BarChart3,
    color: "text-orange-600",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Developing",
    gradient: "from-orange-600/20 to-red-600/10",
    categoryId: "economic-classifications",
    priority: 4,
  },

  // Economy & Size - Population Tiers
  {
    id: "pop-large",
    name: "Large Nation",
    description: "Population over 25 million",
    icon: Users,
    color: "text-red-600",
    filter: (country: RealCountryData) =>
      getPopulationTier(country.population) === "Very Large" ||
      getPopulationTier(country.population) === "Large",
    gradient: "from-red-600/20 to-rose-600/10",
    categoryId: "population-demographics",
    priority: 5,
  },
  {
    id: "pop-medium",
    name: "Medium Nation",
    description: "Population 5-25 million",
    icon: Users,
    color: "text-amber-600",
    filter: (country: RealCountryData) => getPopulationTier(country.population) === "Medium",
    gradient: "from-amber-600/20 to-yellow-600/10",
    categoryId: "population-demographics",
    priority: 6,
  },
  {
    id: "pop-small",
    name: "Small Nation",
    description: "Population under 5 million",
    icon: Users,
    color: "text-green-600",
    filter: (country: RealCountryData) => getPopulationTier(country.population) === "Small",
    gradient: "from-green-600/20 to-emerald-600/10",
    categoryId: "population-demographics",
    priority: 7,
  },

  // Region
  {
    id: "region-europe",
    name: "European",
    description: "Countries from Europe",
    icon: Globe,
    color: "text-blue-500",
    filter: (country: RealCountryData) => {
      const europeanCountries = [
        "Albania",
        "Andorra",
        "Armenia",
        "Austria",
        "Azerbaijan",
        "Belarus",
        "Belgium",
        "Bosnia and Herzegovina",
        "Bulgaria",
        "Croatia",
        "Cyprus",
        "Czech Republic",
        "Czechia",
        "Denmark",
        "Estonia",
        "Finland",
        "France",
        "Georgia",
        "Germany",
        "Greece",
        "Hungary",
        "Iceland",
        "Ireland",
        "Italy",
        "Kazakhstan",
        "Kosovo",
        "Latvia",
        "Liechtenstein",
        "Lithuania",
        "Luxembourg",
        "Malta",
        "Moldova",
        "Monaco",
        "Montenegro",
        "Netherlands",
        "North Macedonia",
        "Norway",
        "Poland",
        "Portugal",
        "Romania",
        "Russia",
        "San Marino",
        "Serbia",
        "Slovakia",
        "Slovenia",
        "Spain",
        "Sweden",
        "Switzerland",
        "Turkey",
        "Ukraine",
        "United Kingdom",
        "Vatican City",
      ];
      return europeanCountries.includes(country.name);
    },
    gradient: "from-blue-500/20 to-indigo-500/10",
    categoryId: "geographical-regions",
    priority: 8,
  },
  {
    id: "region-asia",
    name: "Asian",
    description: "Countries from Asia",
    icon: Globe,
    color: "text-red-500",
    filter: (country: RealCountryData) => {
      const asianCountries = [
        "Afghanistan",
        "Bahrain",
        "Bangladesh",
        "Bhutan",
        "Brunei",
        "Cambodia",
        "China",
        "India",
        "Indonesia",
        "Iran",
        "Iraq",
        "Israel",
        "Japan",
        "Jordan",
        "Kuwait",
        "Kyrgyzstan",
        "Laos",
        "Lebanon",
        "Malaysia",
        "Maldives",
        "Mongolia",
        "Myanmar",
        "Nepal",
        "North Korea",
        "Oman",
        "Pakistan",
        "Palestine",
        "Philippines",
        "Qatar",
        "Saudi Arabia",
        "Singapore",
        "South Korea",
        "Sri Lanka",
        "Syria",
        "Taiwan",
        "Tajikistan",
        "Thailand",
        "Timor-Leste",
        "Turkmenistan",
        "United Arab Emirates",
        "Uzbekistan",
        "Vietnam",
        "Yemen",
      ];
      return asianCountries.includes(country.name);
    },
    gradient: "from-red-500/20 to-orange-500/10",
    categoryId: "geographical-regions",
    priority: 9,
  },
  {
    id: "region-americas",
    name: "Americas",
    description: "Countries from North, Central & South America",
    icon: Globe,
    color: "text-green-500",
    filter: (country: RealCountryData) => {
      const americanCountries = [
        "Antigua and Barbuda",
        "Argentina",
        "Bahamas",
        "Barbados",
        "Belize",
        "Bolivia",
        "Brazil",
        "Canada",
        "Chile",
        "Colombia",
        "Costa Rica",
        "Cuba",
        "Dominica",
        "Dominican Republic",
        "Ecuador",
        "El Salvador",
        "Grenada",
        "Guatemala",
        "Guyana",
        "Haiti",
        "Honduras",
        "Jamaica",
        "Mexico",
        "Nicaragua",
        "Panama",
        "Paraguay",
        "Peru",
        "Saint Kitts and Nevis",
        "Saint Lucia",
        "Saint Vincent and the Grenadines",
        "Suriname",
        "Trinidad and Tobago",
        "United States",
        "Uruguay",
        "Venezuela",
      ];
      return americanCountries.includes(country.name);
    },
    gradient: "from-green-500/20 to-teal-500/10",
    categoryId: "geographical-regions",
    priority: 10,
  },
  {
    id: "region-africa",
    name: "African",
    description: "Countries from Africa",
    icon: Globe,
    color: "text-orange-500",
    filter: (country: RealCountryData) => {
      const africanCountries = [
        "Algeria",
        "Angola",
        "Benin",
        "Botswana",
        "Burkina Faso",
        "Burundi",
        "Cameroon",
        "Cape Verde",
        "Central African Republic",
        "Chad",
        "Comoros",
        "Congo",
        "Côte d'Ivoire",
        "Democratic Republic of the Congo",
        "Djibouti",
        "Egypt",
        "Equatorial Guinea",
        "Eritrea",
        "Eswatini",
        "Ethiopia",
        "Gabon",
        "Gambia",
        "Ghana",
        "Guinea",
        "Guinea-Bissau",
        "Kenya",
        "Lesotho",
        "Liberia",
        "Libya",
        "Madagascar",
        "Malawi",
        "Mali",
        "Mauritania",
        "Mauritius",
        "Morocco",
        "Mozambique",
        "Namibia",
        "Niger",
        "Nigeria",
        "Rwanda",
        "São Tomé and Príncipe",
        "Senegal",
        "Seychelles",
        "Sierra Leone",
        "Somalia",
        "South Africa",
        "South Sudan",
        "Sudan",
        "Tanzania",
        "Togo",
        "Tunisia",
        "Uganda",
        "Zambia",
        "Zimbabwe",
      ];
      return africanCountries.includes(country.name);
    },
    gradient: "from-orange-500/20 to-amber-500/10",
    categoryId: "geographical-regions",
    priority: 11,
  },

  // Government - Political Systems
  {
    id: "gov-democratic",
    name: "Democratic",
    description: "Full or flawed democracies",
    icon: Vote,
    color: "text-blue-600",
    filter: (country: RealCountryData) => {
      // This is a simplified heuristic - in reality would use democracy index
      const democraticCountries = [
        "Australia",
        "Austria",
        "Belgium",
        "Canada",
        "Denmark",
        "Finland",
        "France",
        "Germany",
        "Iceland",
        "Ireland",
        "Italy",
        "Japan",
        "Luxembourg",
        "Netherlands",
        "New Zealand",
        "Norway",
        "Portugal",
        "South Korea",
        "Spain",
        "Sweden",
        "Switzerland",
        "United Kingdom",
        "United States",
        "Costa Rica",
        "Uruguay",
        "Taiwan",
      ];
      return democraticCountries.includes(country.name);
    },
    gradient: "from-blue-600/20 to-cyan-600/10",
    categoryId: "political-systems",
    priority: 12,
  },
  {
    id: "gov-federal",
    name: "Federal",
    description: "Federal system of government",
    icon: Building,
    color: "text-purple-600",
    filter: (country: RealCountryData) => {
      const federalCountries = [
        "Argentina",
        "Australia",
        "Austria",
        "Belgium",
        "Bosnia and Herzegovina",
        "Brazil",
        "Canada",
        "Ethiopia",
        "Germany",
        "India",
        "Iraq",
        "Malaysia",
        "Mexico",
        "Nepal",
        "Nigeria",
        "Pakistan",
        "Russia",
        "South Sudan",
        "Sudan",
        "Switzerland",
        "United States",
        "Venezuela",
      ];
      return federalCountries.includes(country.name);
    },
    gradient: "from-purple-600/20 to-violet-600/10",
    categoryId: "political-systems",
    priority: 13,
  },
  {
    id: "gov-monarchy",
    name: "Monarchy",
    description: "Constitutional or absolute monarchy",
    icon: Crown,
    color: "text-amber-600",
    filter: (country: RealCountryData) => {
      const monarchies = [
        "Andorra",
        "Bahrain",
        "Belgium",
        "Bhutan",
        "Brunei",
        "Cambodia",
        "Denmark",
        "Japan",
        "Jordan",
        "Kuwait",
        "Lesotho",
        "Liechtenstein",
        "Luxembourg",
        "Malaysia",
        "Monaco",
        "Morocco",
        "Netherlands",
        "Norway",
        "Oman",
        "Qatar",
        "Saudi Arabia",
        "Spain",
        "Eswatini",
        "Sweden",
        "Thailand",
        "Tonga",
        "United Arab Emirates",
        "United Kingdom",
      ];
      return monarchies.includes(country.name);
    },
    gradient: "from-amber-600/20 to-yellow-600/10",
    categoryId: "political-systems",
    priority: 14,
  },
  {
    id: "gov-common-law",
    name: "Common Law",
    description: "English common law legal tradition",
    icon: Gavel,
    color: "text-teal-600",
    filter: (country: RealCountryData) => {
      const commonLawCountries = [
        "Antigua and Barbuda",
        "Australia",
        "Bahamas",
        "Bangladesh",
        "Barbados",
        "Belize",
        "Botswana",
        "Canada",
        "Cyprus",
        "Dominica",
        "Fiji",
        "Gambia",
        "Ghana",
        "Grenada",
        "Guyana",
        "Hong Kong",
        "India",
        "Ireland",
        "Israel",
        "Jamaica",
        "Kenya",
        "Kiribati",
        "Liberia",
        "Malawi",
        "Malaysia",
        "Malta",
        "Mauritius",
        "Myanmar",
        "Namibia",
        "Nauru",
        "New Zealand",
        "Nigeria",
        "Pakistan",
        "Papua New Guinea",
        "Saint Kitts and Nevis",
        "Saint Lucia",
        "Saint Vincent and the Grenadines",
        "Samoa",
        "Seychelles",
        "Sierra Leone",
        "Singapore",
        "Solomon Islands",
        "South Africa",
        "Sri Lanka",
        "Tanzania",
        "Tonga",
        "Trinidad and Tobago",
        "Tuvalu",
        "Uganda",
        "United Kingdom",
        "United States",
        "Vanuatu",
        "Zambia",
        "Zimbabwe",
      ];
      return commonLawCountries.includes(country.name);
    },
    gradient: "from-teal-600/20 to-cyan-600/10",
    categoryId: "legal-systems",
    priority: 15,
  },
  {
    id: "gov-civil-law",
    name: "Civil Law",
    description: "Continental European civil law tradition",
    icon: BookOpen,
    color: "text-indigo-600",
    filter: (country: RealCountryData) => {
      const civilLawCountries = [
        "Albania",
        "Argentina",
        "Austria",
        "Belgium",
        "Bolivia",
        "Brazil",
        "Bulgaria",
        "Chile",
        "Colombia",
        "Costa Rica",
        "Croatia",
        "Cuba",
        "Czech Republic",
        "Denmark",
        "Dominican Republic",
        "Ecuador",
        "El Salvador",
        "Estonia",
        "Finland",
        "France",
        "Germany",
        "Greece",
        "Guatemala",
        "Haiti",
        "Honduras",
        "Hungary",
        "Iceland",
        "Indonesia",
        "Italy",
        "Japan",
        "Latvia",
        "Lithuania",
        "Luxembourg",
        "Mexico",
        "Netherlands",
        "Nicaragua",
        "Norway",
        "Panama",
        "Paraguay",
        "Peru",
        "Poland",
        "Portugal",
        "Romania",
        "Russia",
        "Serbia",
        "Slovakia",
        "Slovenia",
        "South Korea",
        "Spain",
        "Sweden",
        "Switzerland",
        "Taiwan",
        "Turkey",
        "Ukraine",
        "Uruguay",
        "Venezuela",
        "Vietnam",
      ];
      return civilLawCountries.includes(country.name);
    },
    gradient: "from-indigo-600/20 to-purple-600/10",
    categoryId: "legal-systems",
    priority: 16,
  },
];

// Add consolidatedCategoryId to all archetypes
export const archetypes: CategorizedCountryArchetype[] =
  rawArchetypes.map(withConsolidatedCategory);

// Helper to get archetypes by consolidated category
export function getArchetypesByConsolidatedCategory(
  categoryId: string
): CategorizedCountryArchetype[] {
  return archetypes.filter((a) => a.consolidatedCategoryId === categoryId);
}

// Helper to get all unique consolidated categories that have archetypes
export function getActiveConsolidatedCategories() {
  const activeCategoryIds = new Set(archetypes.map((a) => a.consolidatedCategoryId));
  return consolidatedCategories.filter((c) => activeCategoryIds.has(c.id));
}
