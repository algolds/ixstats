import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Crown,
  LandPlot, // For geographical
  Building, // For government
  Globe, // For continents
  Users, // For population tiers
  Banknote, // For economic tiers
  Church, // For religion
  MapPin, // For region
} from 'lucide-react';
import type { CountryArchetype } from './country-selector-utils';
import type { RealCountryData } from '../lib/economy-data-service';
import { getEconomicTier } from '../lib/economy-data-service';

function getPopulationTier(population: number): 'Very Large' | 'Large' | 'Medium' | 'Small' {
  if (population >= 100000000) return 'Very Large';
  if (population >= 25000000) return 'Large';
  if (population >= 5000000) return 'Medium';
  return 'Small';
}

// Define ArchetypeCategory type to match Prisma schema
export interface ArchetypeCategory {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color class
  maxSelectable: number;
  priority: number;
  isActive: boolean;
}

// Extend CountryArchetype to include categoryId
export interface CategorizedCountryArchetype extends CountryArchetype {
  priority: number;
  categoryId: string;
  gradient: string; // Ensure gradient is always present
}

export const archetypeCategories: ArchetypeCategory[] = [
  {
    id: 'economic-classifications',
    name: 'Economic Classifications',
    description: 'Archetypes based on economic indicators.',
    color: 'text-blue-500',
    maxSelectable: 1,
    priority: 10,
    isActive: true,
  },
  {
    id: 'population-demographics',
    name: 'Population Demographics',
    description: 'Archetypes based on population size and density.',
    color: 'text-green-500',
    maxSelectable: 1,
    priority: 20,
    isActive: true,
  },
  {
    id: 'geographical-regions',
    name: 'Geographical Regions',
    description: 'Archetypes based on continental and regional location.',
    color: 'text-purple-500',
    maxSelectable: 2,
    priority: 30,
    isActive: true,
  },
  {
    id: 'government-types',
    name: 'Government Types',
    description: 'Archetypes based on the form of government.',
    color: 'text-red-500',
    maxSelectable: 1,
    priority: 40,
    isActive: true,
  },
  {
    id: 'cultural-religious',
    name: 'Cultural & Religious',
    description: 'Archetypes based on predominant cultural or religious characteristics.',
    color: 'text-yellow-500',
    maxSelectable: 1,
    priority: 50,
    isActive: true,
  },
];

export const archetypes: CategorizedCountryArchetype[] = [
  // Existing Archetypes (updated with categoryId)
  {
    id: 'economic-powerhouse',
    name: 'Economic Powerhouse',
    description: 'High GDP per capita, strong financial systems',
    icon: DollarSign,
    color: 'text-[var(--color-success)]',
    filter: (country: RealCountryData) => country.gdpPerCapita > 40000,
    gradient: 'from-emerald-500/20 to-green-500/10',
    categoryId: 'economic-classifications',
    priority: 1,
  },
  {
    id: 'developing-giant',
    name: 'Developing Giant',
    description: 'Large population, growing economy',
    icon: TrendingUp,
    color: 'text-[var(--color-brand-primary)]',
    filter: (country: RealCountryData) => country.population > 50000000 && country.gdpPerCapita < 15000,
    gradient: 'from-blue-500/20 to-indigo-500/10',
    categoryId: 'economic-classifications',
    priority: 2,
  },
  {
    id: 'balanced-nation',
    name: 'Balanced Nation',
    description: 'Moderate size and development',
    icon: BarChart3,
    color: 'text-[var(--color-purple)]',
    filter: (country: RealCountryData) =>
      country.gdpPerCapita > 15000 && country.gdpPerCapita < 40000 &&
      country.population > 5000000 && country.population < 100000000,
    gradient: 'from-purple-500/20 to-pink-500/10',
    categoryId: 'economic-classifications',
    priority: 3,
  },
  {
    id: 'small-prosperous',
    name: 'Small & Prosperous',
    description: 'High living standards, compact size',
    icon: Crown,
    color: 'text-[var(--color-warning)]',
    filter: (country: RealCountryData) => country.population < 10000000 && country.gdpPerCapita > 25000,
    gradient: 'from-amber-500/20 to-yellow-500/10',
    categoryId: 'economic-classifications',
    priority: 4,
  },

  // New Archetypes based on Prisma schema
  // Geographical Regions (Continents)
  {
    id: 'continent-africa',
    name: 'African Nation',
    description: 'Country located in Africa.',
    icon: Globe,
    color: 'text-orange-500',
    filter: (country: RealCountryData) => country.continent === 'Africa',
    gradient: 'from-orange-500/20 to-yellow-500/10',
    categoryId: 'geographical-regions',
    priority: 5,
  },
  {
    id: 'continent-asia',
    name: 'Asian Nation',
    description: 'Country located in Asia.',
    icon: Globe,
    color: 'text-red-500',
    filter: (country: RealCountryData) => country.continent === 'Asia',
    gradient: 'from-red-500/20 to-pink-500/10',
    categoryId: 'geographical-regions',
    priority: 6,
  },
  {
    id: 'continent-europe',
    name: 'European Nation',
    description: 'Country located in Europe.',
    icon: Globe,
    color: 'text-blue-500',
    filter: (country: RealCountryData) => country.continent === 'Europe',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    categoryId: 'geographical-regions',
    priority: 7,
  },
  {
    id: 'continent-north-america',
    name: 'North American Nation',
    description: 'Country located in North America.',
    icon: Globe,
    color: 'text-green-500',
    filter: (country: RealCountryData) => country.continent === 'North America',
    gradient: 'from-green-500/20 to-lime-500/10',
    categoryId: 'geographical-regions',
    priority: 8,
  },
  {
    id: 'continent-south-america',
    name: 'South American Nation',
    description: 'Country located in South America.',
    icon: Globe,
    color: 'text-purple-500',
    filter: (country: RealCountryData) => country.continent === 'South America',
    gradient: 'from-purple-500/20 to-fuchsia-500/10',
    categoryId: 'geographical-regions',
    priority: 9,
  },
  {
    id: 'continent-oceania',
    name: 'Oceanic Nation',
    description: 'Country located in Oceania.',
    icon: Globe,
    color: 'text-teal-500',
    filter: (country: RealCountryData) => country.continent === 'Oceania',
    gradient: 'from-teal-500/20 to-emerald-500/10',
    categoryId: 'geographical-regions',
    priority: 10,
  },

  // Government Types
  {
    id: 'gov-democracy',
    name: 'Democracy',
    description: 'Country with a democratic government system.',
    icon: Building,
    color: 'text-indigo-500',
    filter: (country: RealCountryData) => country.governmentType === 'Democracy',
    gradient: 'from-indigo-500/20 to-purple-500/10',
    categoryId: 'government-types',
    priority: 11,
  },
  {
    id: 'gov-monarchy',
    name: 'Monarchy',
    description: 'Country ruled by a monarch.',
    icon: Crown,
    color: 'text-yellow-600',
    filter: (country: RealCountryData) => country.governmentType === 'Monarchy',
    gradient: 'from-yellow-600/20 to-amber-600/10',
    categoryId: 'government-types',
    priority: 12,
  },
  {
    id: 'gov-republic',
    name: 'Republic',
    description: 'Country with a republican form of government.',
    icon: Building,
    color: 'text-cyan-500',
    filter: (country: RealCountryData) => country.governmentType === 'Republic',
    gradient: 'from-cyan-500/20 to-blue-500/10',
    categoryId: 'government-types',
    priority: 13,
  },
  {
    id: 'gov-dictatorship',
    name: 'Dictatorship',
    description: 'Country ruled by a single dictator or small group.',
    icon: Building,
    color: 'text-gray-700',
    filter: (country: RealCountryData) => country.governmentType === 'Dictatorship',
    gradient: 'from-gray-700/20 to-gray-900/10',
    categoryId: 'government-types',
    priority: 14,
  },

  // Economic Tiers
  {
    id: 'tier-developed',
    name: 'Developed Economy',
    description: 'Country classified as a developed economy.',
    icon: Banknote,
    color: 'text-lime-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Developed',
    gradient: 'from-lime-600/20 to-green-600/10',
    categoryId: 'economic-classifications',
    priority: 15,
  },
  {
    id: 'tier-developing',
    name: 'Developing Economy',
    description: 'Country classified as a developing economy.',
    icon: Banknote,
    color: 'text-orange-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Developing',
    gradient: 'from-orange-600/20 to-red-600/10',
    categoryId: 'economic-classifications',
    priority: 16,
  },
  {
    id: 'tier-emerging',
    name: 'Emerging Economy',
    description: 'Country classified as an emerging economy.',
    icon: Banknote,
    color: 'text-purple-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Emerging',
    gradient: 'from-purple-600/20 to-pink-600/10',
    categoryId: 'economic-classifications',
    priority: 17,
  },

  // Population Tiers
  {
    id: 'pop-high',
    name: 'High Population',
    description: 'Country with a large population.',
    icon: Users,
    color: 'text-red-700',
    filter: (country: RealCountryData) => {
      const tier = getPopulationTier(country.population);
      return tier === 'Very Large' || tier === 'Large';
    },
    gradient: 'from-red-700/20 to-rose-700/10',
    categoryId: 'population-demographics',
    priority: 18,
  },
  {
    id: 'pop-medium',
    name: 'Medium Population',
    description: 'Country with a moderate population.',
    icon: Users,
    color: 'text-amber-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Medium',
    gradient: 'from-amber-700/20 to-yellow-700/10',
    categoryId: 'population-demographics',
    priority: 19,
  },
  {
    id: 'pop-low',
    name: 'Low Population',
    description: 'Country with a small population.',
    icon: Users,
    color: 'text-green-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Small',
    gradient: 'from-green-700/20 to-emerald-700/10',
    categoryId: 'population-demographics',
    priority: 20,
  },

  // Cultural/Religious (Religion)
  {
    id: 'religion-christianity',
    name: 'Predominantly Christian',
    description: 'Country with a majority Christian population.',
    icon: Church,
    color: 'text-sky-500',
    filter: (country: RealCountryData) => country.region === 'Christianity',
    gradient: 'from-sky-500/20 to-blue-500/10',
    categoryId: 'cultural-religious',
    priority: 21,
  },
  {
    id: 'religion-islam',
    name: 'Predominantly Islamic',
    description: 'Country with a majority Islamic population.',
    icon: Church,
    color: 'text-emerald-500',
    filter: (country: RealCountryData) => country.religion === 'Islam',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    categoryId: 'cultural-religious',
    priority: 22,
  },
  {
    id: 'religion-buddhism',
    name: 'Predominantly Buddhist',
    description: 'Country with a majority Buddhist population.',
    icon: Church,
    color: 'text-orange-500',
    filter: (country: RealCountryData) => country.religion === 'Buddhism',
    gradient: 'from-orange-500/20 to-amber-500/10',
    categoryId: 'cultural-religious',
    priority: 23,
  },
  {
    id: 'religion-hinduism',
    name: 'Predominantly Hindu',
    description: 'Country with a majority Hindu population.',
    icon: Church,
    color: 'text-rose-500',
    filter: (country: RealCountryData) => country.religion === 'Hinduism',
    gradient: 'from-rose-500/20 to-pink-500/10',
    categoryId: 'cultural-religious',
    priority: 24,
  },
  {
    id: 'religion-none',
    name: 'Secular/Non-Religious',
    description: 'Country with a significant non-religious or secular population.',
    icon: Church, // Or a different icon for secularism
    color: 'text-gray-500',
    filter: (country: RealCountryData) => country.religion === 'None' || country.religion === 'Secular',
    gradient: 'from-gray-500/20 to-slate-500/10',
    categoryId: 'cultural-religious',
    priority: 25,
  },
];
