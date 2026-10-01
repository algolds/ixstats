// Economy & Size archetypes: economic tiers, population tiers, island nations and the G7.
import {
  StatUp as TrendingUp,
  StatsReport as BarChart3,
  Building,
  Globe,
  Group as Users,
  Dollar as Banknote,
} from "iconoir-react";
import type { RealCountryData } from "../../lib/economy-data-service";
import { getEconomicTier } from "../../lib/economy-data-service";
import type { ArchetypeSeed } from "../country-archetypes";

function getPopulationTier(population: number): "Very Large" | "Large" | "Medium" | "Small" {
  if (population >= 100000000) return "Very Large";
  if (population >= 25000000) return "Large";
  if (population >= 5000000) return "Medium";
  return "Small";
}

export const economySizeArchetypes: ArchetypeSeed[] = [
  // Economy & Size - Economic Tiers
  {
    id: "tier-advanced",
    name: "Advanced Economy",
    description: "Very high GDP per capita (>$50,000)",
    icon: Banknote,
    color: "text-green",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Advanced",
    gradient: "bg-green/10",
    categoryId: "economic-classifications",
    priority: 1,
  },
  {
    id: "tier-developed",
    name: "Developed Economy",
    description: "High GDP per capita ($25,000-$50,000)",
    icon: Banknote,
    color: "text-green",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Developed",
    gradient: "bg-green/10",
    categoryId: "economic-classifications",
    priority: 2,
  },
  {
    id: "tier-emerging",
    name: "Emerging Economy",
    description: "Moderate GDP per capita ($10,000-$25,000)",
    icon: TrendingUp,
    color: "text-purple",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Emerging",
    gradient: "bg-purple/10",
    categoryId: "economic-classifications",
    priority: 3,
  },
  {
    id: "tier-developing",
    name: "Developing Economy",
    description: "Lower GDP per capita (<$10,000)",
    icon: BarChart3,
    color: "text-orange",
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === "Developing",
    gradient: "bg-orange/10",
    categoryId: "economic-classifications",
    priority: 4,
  },

  // Economy & Size - Population Tiers
  {
    id: "pop-large",
    name: "Large Nation",
    description: "Population over 25 million",
    icon: Users,
    color: "text-red",
    filter: (country: RealCountryData) =>
      getPopulationTier(country.population) === "Very Large" ||
      getPopulationTier(country.population) === "Large",
    gradient: "bg-red/10",
    categoryId: "population-demographics",
    priority: 5,
  },
  {
    id: "pop-medium",
    name: "Medium Nation",
    description: "Population 5-25 million",
    icon: Users,
    color: "text-yellow",
    filter: (country: RealCountryData) => getPopulationTier(country.population) === "Medium",
    gradient: "bg-yellow/10",
    categoryId: "population-demographics",
    priority: 6,
  },
  {
    id: "pop-very-large",
    name: "Mega Nation",
    description: "Population over 100 million",
    icon: Users,
    color: "text-red",
    filter: (country: RealCountryData) => (country.population || 0) >= 100000000,
    gradient: "bg-red/10",
    categoryId: "population-demographics",
    priority: 4.5,
  },
  {
    id: "pop-small",
    name: "Small Nation",
    description: "Population under 5 million",
    icon: Users,
    color: "text-green",
    filter: (country: RealCountryData) => getPopulationTier(country.population) === "Small",
    gradient: "bg-green/10",
    categoryId: "population-demographics",
    priority: 7,
  },
  {
    id: "island",
    name: "Island Nation",
    description: "Island countries and territories",
    icon: Globe,
    color: "text-teal",
    filter: (country: RealCountryData) => {
      const islands = new Set([
        "United Kingdom",
        "Japan",
        "Australia",
        "New Zealand",
        "Iceland",
        "Ireland",
        "Cuba",
        "Madagascar",
        "Indonesia",
        "Philippines",
        "Sri Lanka",
        "Cyprus",
        "Malta",
        "Jamaica",
        "Singapore",
        "Bahamas",
        "Fiji",
        "Barbados",
        "Taiwan",
        "Haiti",
        "Dominican Republic",
        "Trinidad and Tobago",
        "Bahrain",
        "Mauritius",
        "Cabo Verde",
        "Seychelles",
        "Solomon Islands",
        "Vanuatu",
        "Samoa",
        "Tonga",
      ]);
      return islands.has(country.name) || country.name.toLowerCase().includes("island");
    },
    gradient: "bg-teal/10",
    categoryId: "geographical-regions",
    priority: 15,
  },
  {
    id: "g7",
    name: "G7 Economies",
    description: "Group of Seven leading economies",
    icon: Building,
    color: "text-yellow",
    filter: (country: RealCountryData) => {
      const g7 = new Set([
        "United States",
        "Japan",
        "Germany",
        "United Kingdom",
        "France",
        "Italy",
        "Canada",
      ]);
      return g7.has(country.name);
    },
    gradient: "bg-yellow/10",
    categoryId: "economic-classifications",
    priority: 0.5,
  },
];
