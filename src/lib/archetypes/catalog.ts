/**
 * Selectable Archetype Catalog & Selection Engine
 */

import type { EnhancedArchetype, ArchetypeCategory, ArchetypeConfig } from "./types";
import type { RealCountryData } from "~/types/builder/country-reference";

export const archetypeCategories: ArchetypeCategory[] = [
  {
    id: "economic",
    name: "Economic Profile",
    description: "Economic structure and performance characteristics",
    color: "text-emerald-500",
    maxSelectable: 2,
  },
  {
    id: "political",
    name: "Political System",
    description: "Governance structure and political characteristics",
    color: "text-blue-500",
    maxSelectable: 2,
  },
  {
    id: "cultural",
    name: "Cultural Identity",
    description: "Social values and cultural characteristics",
    color: "text-purple-500",
    maxSelectable: 1,
  },
  {
    id: "geographic",
    name: "Geographic Profile",
    description: "Location, climate, and natural characteristics",
    color: "text-amber-500",
    maxSelectable: 2,
  },
  {
    id: "development",
    name: "Development Level",
    description: "Infrastructure and human development indicators",
    color: "text-cyan-500",
    maxSelectable: 1,
  },
];

export const enhancedArchetypes: EnhancedArchetype[] = [
  // ECONOMIC ARCHETYPES
  {
    id: "economic-powerhouse",
    name: "Economic Powerhouse",
    description: "High GDP per capita, strong financial systems",
    category: "economic",
    iconName: "DollarSign",
    color: "text-emerald-500",
    gradient: "from-emerald-500/20 to-green-500/10",
    filter: (country: RealCountryData) => country.gdpPerCapita > 40000,
    priority: 1,
    isSelectable: true,
    tags: ["wealthy", "developed", "financial"],
  },
  {
    id: "developing-giant",
    name: "Developing Giant",
    description: "Large population, growing economy",
    category: "economic",
    iconName: "TrendingUp",
    color: "text-blue-500",
    gradient: "from-blue-500/20 to-indigo-500/10",
    filter: (country: RealCountryData) =>
      country.population > 50000000 && country.gdpPerCapita < 15000,
    priority: 2,
    isSelectable: true,
    tags: ["emerging", "populous", "growth"],
  },
  {
    id: "resource-rich",
    name: "Resource Rich",
    description: "Economy based on natural resource exports",
    category: "economic",
    iconName: "Factory",
    color: "text-orange-500",
    gradient: "from-orange-500/20 to-red-500/10",
    filter: (country: RealCountryData) => {
      return country.gdpPerCapita > 20000 && country.population < 50000000;
    },
    priority: 3,
    isSelectable: true,
    tags: ["commodities", "exports", "resources"],
  },
  {
    id: "service-economy",
    name: "Service Economy",
    description: "Economy dominated by services and knowledge work",
    category: "economic",
    iconName: "Coins",
    color: "text-teal-500",
    gradient: "from-teal-500/20 to-cyan-500/10",
    filter: (country: RealCountryData) =>
      country.gdpPerCapita > 25000 && country.population > 10000000,
    priority: 4,
    isSelectable: true,
    tags: ["services", "knowledge", "urban"],
  },

  // POLITICAL ARCHETYPES
  {
    id: "democratic-stable",
    name: "Democratic & Stable",
    description: "Strong democratic institutions and political stability",
    category: "political",
    iconName: "Vote",
    color: "text-blue-600",
    gradient: "from-blue-600/20 to-indigo-600/10",
    filter: (country: RealCountryData) => {
      return country.gdpPerCapita > 30000;
    },
    priority: 1,
    isSelectable: true,
    tags: ["democracy", "stable", "transparent"],
  },
  {
    id: "federal-system",
    name: "Federal System",
    description: "Decentralized governance with regional autonomy",
    category: "political",
    iconName: "Building2",
    color: "text-indigo-500",
    gradient: "from-indigo-500/20 to-blue-500/10",
    filter: (country: RealCountryData) => {
      return (
        country.population > 100000000 ||
        ["United States", "Germany", "Canada", "Australia", "Brazil", "India"].includes(
          country.name
        )
      );
    },
    priority: 2,
    isSelectable: true,
    tags: ["federal", "decentralized", "regions"],
  },
  {
    id: "constitutional-monarchy",
    name: "Constitutional Monarchy",
    description: "Parliamentary system with ceremonial monarchy",
    category: "political",
    iconName: "Crown",
    color: "text-purple-600",
    gradient: "from-purple-600/20 to-pink-600/10",
    filter: (country: RealCountryData) => {
      return [
        "United Kingdom",
        "Canada",
        "Australia",
        "Sweden",
        "Norway",
        "Denmark",
        "Netherlands",
        "Belgium",
        "Japan",
      ].includes(country.name);
    },
    priority: 3,
    isSelectable: true,
    tags: ["monarchy", "parliamentary", "traditional"],
  },

  // CULTURAL ARCHETYPES
  {
    id: "multicultural",
    name: "Multicultural",
    description: "Diverse ethnic and cultural communities",
    category: "cultural",
    iconName: "Globe2",
    color: "text-purple-500",
    gradient: "from-purple-500/20 to-pink-500/10",
    filter: (country: RealCountryData) => {
      return [
        "United States",
        "Canada",
        "Australia",
        "Brazil",
        "South Africa",
        "Singapore",
      ].includes(country.name);
    },
    priority: 1,
    isSelectable: true,
    tags: ["diversity", "immigration", "cosmopolitan"],
  },
  {
    id: "traditional-values",
    name: "Traditional Values",
    description: "Strong emphasis on cultural heritage and traditions",
    category: "cultural",
    iconName: "Heart",
    color: "text-rose-500",
    gradient: "from-rose-500/20 to-red-500/10",
    filter: (country: RealCountryData) => {
      return ["Japan", "South Korea", "India", "China", "Thailand", "Egypt"].includes(country.name);
    },
    priority: 2,
    isSelectable: true,
    tags: ["heritage", "customs", "family"],
  },

  // GEOGRAPHIC ARCHETYPES
  {
    id: "island-nation",
    name: "Island Nation",
    description: "Country composed of islands with maritime culture",
    category: "geographic",
    iconName: "Waves",
    color: "text-cyan-500",
    gradient: "from-cyan-500/20 to-blue-500/10",
    filter: (country: RealCountryData) => {
      return [
        "Japan",
        "United Kingdom",
        "Philippines",
        "Indonesia",
        "New Zealand",
        "Iceland",
        "Malta",
        "Cyprus",
      ].includes(country.name);
    },
    priority: 1,
    isSelectable: true,
    tags: ["islands", "maritime", "coastal"],
  },
  {
    id: "landlocked",
    name: "Landlocked",
    description: "No direct access to ocean, continental focus",
    category: "geographic",
    iconName: "Mountain",
    color: "text-amber-600",
    gradient: "from-amber-600/20 to-orange-600/10",
    filter: (country: RealCountryData) => {
      return [
        "Switzerland",
        "Austria",
        "Czech Republic",
        "Hungary",
        "Slovakia",
        "Luxembourg",
        "Belarus",
      ].includes(country.name);
    },
    priority: 2,
    isSelectable: true,
    tags: ["continental", "mountains", "inland"],
  },
  {
    id: "tropical-climate",
    name: "Tropical Climate",
    description: "Warm weather year-round with distinct seasons",
    category: "geographic",
    iconName: "Sun",
    color: "text-yellow-500",
    gradient: "from-yellow-500/20 to-orange-500/10",
    filter: (country: RealCountryData) => {
      return ["Brazil", "Indonesia", "Malaysia", "Thailand", "Philippines", "Singapore"].includes(
        country.name
      );
    },
    priority: 3,
    isSelectable: true,
    tags: ["tropical", "warm", "humid"],
  },

  // DEVELOPMENT ARCHETYPES
  {
    id: "highly-developed",
    name: "Highly Developed",
    description: "Advanced infrastructure and high living standards",
    category: "development",
    iconName: "Zap",
    color: "text-cyan-600",
    gradient: "from-cyan-600/20 to-blue-600/10",
    filter: (country: RealCountryData) => country.gdpPerCapita > 45000,
    priority: 1,
    isSelectable: true,
    tags: ["advanced", "infrastructure", "quality-of-life"],
  },
  {
    id: "emerging-market",
    name: "Emerging Market",
    description: "Rapidly developing with growing middle class",
    category: "development",
    iconName: "TrendingUp",
    color: "text-green-600",
    gradient: "from-green-600/20 to-emerald-600/10",
    filter: (country: RealCountryData) => {
      return (
        country.gdpPerCapita > 5000 && country.gdpPerCapita < 25000 && country.population > 20000000
      );
    },
    priority: 2,
    isSelectable: true,
    tags: ["emerging", "middle-class", "urbanizing"],
  },
];

export const archetypeConfig: ArchetypeConfig = {
  maxTotalSelections: 5,
  minSelections: 0,
  enableCombinations: true,
  showCategoryCounts: true,
};

export const getArchetypesByCategory = (category: string): EnhancedArchetype[] => {
  return enhancedArchetypes.filter((archetype) => archetype.category === category);
};

export const getSelectableArchetypes = (): EnhancedArchetype[] => {
  return enhancedArchetypes.filter((archetype) => archetype.isSelectable);
};

export const validateArchetypeSelection = (selectedIds: string[]): boolean => {
  const selected = enhancedArchetypes.filter((a) => selectedIds.includes(a.id));

  if (selected.length > archetypeConfig.maxTotalSelections) return false;

  for (const category of archetypeCategories) {
    const categoryCount = selected.filter((a) => a.category === category.id).length;
    if (categoryCount > category.maxSelectable) return false;
  }

  return true;
};
