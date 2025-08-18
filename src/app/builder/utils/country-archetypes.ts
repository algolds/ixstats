import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Crown
} from 'lucide-react';
import type { CountryArchetype } from './country-selector-utils';
import type { RealCountryData } from '../lib/economy-data-service';

export const archetypes: CountryArchetype[] = [
  {
    id: 'economic-powerhouse',
    name: 'Economic Powerhouse',
    description: 'High GDP per capita, strong financial systems',
    icon: DollarSign,
    color: 'text-[var(--color-success)]',
    filter: (country: RealCountryData) => country.gdpPerCapita > 40000,
    gradient: 'from-emerald-500/20 to-green-500/10'
  },
  {
    id: 'developing-giant',
    name: 'Developing Giant',
    description: 'Large population, growing economy',
    icon: TrendingUp,
    color: 'text-[var(--color-brand-primary)]',
    filter: (country: RealCountryData) => country.population > 50000000 && country.gdpPerCapita < 15000,
    gradient: 'from-blue-500/20 to-indigo-500/10'
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
    gradient: 'from-purple-500/20 to-pink-500/10'
  },
  {
    id: 'small-prosperous',
    name: 'Small & Prosperous',
    description: 'High living standards, compact size',
    icon: Crown,
    color: 'text-[var(--color-warning)]',
    filter: (country: RealCountryData) => country.population < 10000000 && country.gdpPerCapita > 25000,
    gradient: 'from-amber-500/20 to-yellow-500/10'
  }
];