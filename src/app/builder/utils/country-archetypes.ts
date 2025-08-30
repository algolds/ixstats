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
  Scale, // For legal systems
  Shield, // For military/security
  Vote, // For democratic systems
  Gavel, // For judicial systems
  BookOpen, // For legal codes
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
    description: 'Archetypes based on economic development and performance indicators.',
    color: 'text-blue-500',
    maxSelectable: 2,
    priority: 10,
    isActive: true,
  },
  {
    id: 'population-demographics',
    name: 'Population Demographics',
    description: 'Archetypes based on population size and demographics.',
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
    maxSelectable: 1,
    priority: 30,
    isActive: true,
  },
  {
    id: 'political-systems',
    name: 'Political Systems',
    description: 'Archetypes based on government type and political structure.',
    color: 'text-red-500',
    maxSelectable: 1,
    priority: 40,
    isActive: true,
  },
  {
    id: 'legal-systems',
    name: 'Legal Systems',
    description: 'Archetypes based on legal framework and judicial systems.',
    color: 'text-amber-500',
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

  // Economic Tier Classifications (working with actual data)
  {
    id: 'tier-advanced',
    name: 'Advanced Economy',
    description: 'Countries with very high GDP per capita (>$50,000).',
    icon: Banknote,
    color: 'text-emerald-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Advanced',
    gradient: 'from-emerald-600/20 to-green-600/10',
    categoryId: 'economic-classifications',
    priority: 5,
  },
  {
    id: 'tier-developed',
    name: 'Developed Economy',
    description: 'Countries with high GDP per capita ($25,000-$50,000).',
    icon: Banknote,
    color: 'text-lime-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Developed',
    gradient: 'from-lime-600/20 to-green-600/10',
    categoryId: 'economic-classifications',
    priority: 6,
  },
  {
    id: 'tier-emerging',
    name: 'Emerging Economy',
    description: 'Countries with moderate GDP per capita ($10,000-$25,000).',
    icon: Banknote,
    color: 'text-purple-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Emerging',
    gradient: 'from-purple-600/20 to-pink-600/10',
    categoryId: 'economic-classifications',
    priority: 7,
  },
  {
    id: 'tier-developing',
    name: 'Developing Economy',
    description: 'Countries with lower GDP per capita (<$10,000).',
    icon: Banknote,
    color: 'text-orange-600',
    filter: (country: RealCountryData) => getEconomicTier(country.gdpPerCapita) === 'Developing',
    gradient: 'from-orange-600/20 to-red-600/10',
    categoryId: 'economic-classifications',
    priority: 8,
  },

  // Population Tiers (working with actual data)
  {
    id: 'pop-mega',
    name: 'Mega Population',
    description: 'Countries with extremely large populations (>100M people).',
    icon: Users,
    color: 'text-red-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Very Large',
    gradient: 'from-red-700/20 to-rose-700/10',
    categoryId: 'population-demographics',
    priority: 9,
  },
  {
    id: 'pop-large',
    name: 'Large Population',
    description: 'Countries with large populations (25M-100M people).',
    icon: Users,
    color: 'text-orange-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Large',
    gradient: 'from-orange-700/20 to-red-700/10',
    categoryId: 'population-demographics',
    priority: 10,
  },
  {
    id: 'pop-medium',
    name: 'Medium Population',
    description: 'Countries with moderate populations (5M-25M people).',
    icon: Users,
    color: 'text-amber-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Medium',
    gradient: 'from-amber-700/20 to-yellow-700/10',
    categoryId: 'population-demographics',
    priority: 11,
  },
  {
    id: 'pop-small',
    name: 'Small Population',
    description: 'Countries with smaller populations (<5M people).',
    icon: Users,
    color: 'text-green-700',
    filter: (country: RealCountryData) => getPopulationTier(country.population) === 'Small',
    gradient: 'from-green-700/20 to-emerald-700/10',
    categoryId: 'population-demographics',
    priority: 12,
  },

  // Economic Performance Indicators (using available data)
  {
    id: 'tax-efficient',
    name: 'Tax Efficient',
    description: 'Countries with moderate tax revenue rates (indicating efficient collection).',
    icon: DollarSign,
    color: 'text-blue-600',
    filter: (country: RealCountryData) => country.taxRevenuePercent !== undefined && country.taxRevenuePercent > 15 && country.taxRevenuePercent < 30,
    gradient: 'from-blue-600/20 to-cyan-600/10',
    categoryId: 'economic-classifications',
    priority: 13,
  },
  {
    id: 'low-unemployment',
    name: 'Low Unemployment',
    description: 'Countries with healthy employment rates (<5% unemployment).',
    icon: TrendingUp,
    color: 'text-emerald-600',
    filter: (country: RealCountryData) => country.unemploymentRate < 5,
    gradient: 'from-emerald-600/20 to-green-600/10',
    categoryId: 'economic-classifications',
    priority: 14,
  },
  {
    id: 'high-unemployment',
    name: 'High Unemployment',
    description: 'Countries facing employment challenges (>10% unemployment).',
    icon: BarChart3,
    color: 'text-red-600',
    filter: (country: RealCountryData) => country.unemploymentRate > 10,
    gradient: 'from-red-600/20 to-rose-600/10',
    categoryId: 'economic-classifications',
    priority: 15,
  },

  // Geographic Clusters (based on country name patterns - simple heuristic)
  {
    id: 'region-africa',
    name: 'African Nations',
    description: 'Countries from the African continent.',
    icon: Globe,
    color: 'text-orange-500',
    filter: (country: RealCountryData) => {
      const africanCountries = [
        'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde',
        'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Democratic Republic of Congo', 'Djibouti',
        'Egypt', 'Equatorial Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea',
        'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi',
        'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
        'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
        'South Africa', 'South Sudan', 'Sudan', 'Swaziland', 'Tanzania', 'Togo', 'Tunisia', 'Uganda',
        'Zambia', 'Zimbabwe'
      ];
      return africanCountries.includes(country.name);
    },
    gradient: 'from-orange-500/20 to-yellow-500/10',
    categoryId: 'geographical-regions',
    priority: 16,
  },
  {
    id: 'region-europe',
    name: 'European Nations',
    description: 'Countries from the European continent.',
    icon: Globe,
    color: 'text-blue-500',
    filter: (country: RealCountryData) => {
      const europeanCountries = [
        'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria',
        'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
        'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania',
        'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
        'Norway', 'Poland', 'Portugal', 'Romania', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia',
        'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican City'
      ];
      return europeanCountries.includes(country.name);
    },
    gradient: 'from-blue-500/20 to-cyan-500/10',
    categoryId: 'geographical-regions',
    priority: 17,
  },
  {
    id: 'region-asia',
    name: 'Asian Nations',
    description: 'Countries from the Asian continent.',
    icon: Globe,
    color: 'text-red-500',
    filter: (country: RealCountryData) => {
      const asianCountries = [
        'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia',
        'China', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan',
        'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia',
        'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar',
        'Russia', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan',
        'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates',
        'Uzbekistan', 'Vietnam', 'Yemen'
      ];
      return asianCountries.includes(country.name);
    },
    gradient: 'from-red-500/20 to-pink-500/10',
    categoryId: 'geographical-regions',
    priority: 18,
  },
  {
    id: 'region-americas',
    name: 'American Nations',
    description: 'Countries from North and South America.',
    icon: Globe,
    color: 'text-green-500',
    filter: (country: RealCountryData) => {
      const americanCountries = [
        'Antigua and Barbuda', 'Argentina', 'Bahamas', 'Barbados', 'Belize', 'Bolivia', 'Brazil',
        'Canada', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'Dominica', 'Dominican Republic',
        'Ecuador', 'El Salvador', 'Grenada', 'Guatemala', 'Guyana', 'Haiti', 'Honduras', 'Jamaica',
        'Mexico', 'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Saint Kitts and Nevis', 'Saint Lucia',
        'Saint Vincent and the Grenadines', 'Suriname', 'Trinidad and Tobago', 'United States',
        'Uruguay', 'Venezuela'
      ];
      return americanCountries.includes(country.name);
    },
    gradient: 'from-green-500/20 to-lime-500/10',
    categoryId: 'geographical-regions',
    priority: 19,
  },

  // Political Systems (based on CIA World Factbook common government types)
  {
    id: 'gov-democracy',
    name: 'Democratic Republic',
    description: 'Countries with democratic systems and elected representatives.',
    icon: Vote,
    color: 'text-blue-600',
    filter: (country: RealCountryData) => {
      const democraticCountries = [
        'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain',
        'Australia', 'New Zealand', 'Japan', 'South Korea', 'India', 'Brazil', 'Argentina',
        'South Africa', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland',
        'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Estonia', 'Latvia', 'Lithuania',
        'Slovenia', 'Croatia', 'Romania', 'Bulgaria', 'Greece', 'Portugal', 'Ireland',
        'Austria', 'Switzerland', 'Iceland', 'Luxembourg', 'Malta', 'Cyprus'
      ];
      return democraticCountries.includes(country.name);
    },
    gradient: 'from-blue-600/20 to-indigo-600/10',
    categoryId: 'political-systems',
    priority: 20,
  },
  {
    id: 'gov-constitutional-monarchy',
    name: 'Constitutional Monarchy',
    description: 'Countries with monarchs but constitutional democratic systems.',
    icon: Crown,
    color: 'text-purple-600',
    filter: (country: RealCountryData) => {
      const constitutionalMonarchies = [
        'United Kingdom', 'Canada', 'Australia', 'New Zealand', 'Sweden', 'Norway',
        'Denmark', 'Netherlands', 'Belgium', 'Spain', 'Japan', 'Thailand', 'Malaysia',
        'Morocco', 'Jordan', 'Luxembourg', 'Monaco', 'Liechtenstein', 'Andorra'
      ];
      return constitutionalMonarchies.includes(country.name);
    },
    gradient: 'from-purple-600/20 to-pink-600/10',
    categoryId: 'political-systems',
    priority: 21,
  },
  {
    id: 'gov-federal-republic',
    name: 'Federal Republic',
    description: 'Countries with federal systems and state/provincial autonomy.',
    icon: Building,
    color: 'text-emerald-600',
    filter: (country: RealCountryData) => {
      const federalRepublics = [
        'United States', 'Germany', 'Brazil', 'India', 'Canada', 'Australia',
        'Argentina', 'Mexico', 'Russia', 'Nigeria', 'Pakistan', 'Malaysia',
        'Switzerland', 'Austria', 'Belgium', 'United Arab Emirates'
      ];
      return federalRepublics.includes(country.name);
    },
    gradient: 'from-emerald-600/20 to-green-600/10',
    categoryId: 'political-systems',
    priority: 22,
  },
  {
    id: 'gov-authoritarian',
    name: 'Authoritarian System',
    description: 'Countries with limited political freedoms and centralized power.',
    icon: Shield,
    color: 'text-red-600',
    filter: (country: RealCountryData) => {
      const authoritarianCountries = [
        'China', 'Russia', 'Iran', 'North Korea', 'Belarus', 'Myanmar', 'Cuba',
        'Venezuela', 'Syria', 'Eritrea', 'Turkmenistan', 'Uzbekistan', 'Azerbaijan',
        'Kazakhstan', 'Tajikistan', 'Laos', 'Vietnam', 'Cambodia'
      ];
      return authoritarianCountries.includes(country.name);
    },
    gradient: 'from-red-600/20 to-rose-600/10',
    categoryId: 'political-systems',
    priority: 23,
  },
  {
    id: 'gov-absolute-monarchy',
    name: 'Absolute Monarchy',
    description: 'Countries ruled by monarchs with absolute or near-absolute power.',
    icon: Crown,
    color: 'text-yellow-600',
    filter: (country: RealCountryData) => {
      const absoluteMonarchies = [
        'Saudi Arabia', 'Brunei', 'Oman', 'Qatar', 'United Arab Emirates',
        'Kuwait', 'Bahrain', 'Eswatini', 'Vatican City'
      ];
      return absoluteMonarchies.includes(country.name);
    },
    gradient: 'from-yellow-600/20 to-amber-600/10',
    categoryId: 'political-systems',
    priority: 24,
  },

  // Legal Systems (based on CIA World Factbook legal system classifications)
  {
    id: 'legal-common-law',
    name: 'Common Law System',
    description: 'Countries using English common law tradition and judicial precedent.',
    icon: Gavel,
    color: 'text-indigo-600',
    filter: (country: RealCountryData) => {
      const commonLawCountries = [
        'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand',
        'India', 'Ireland', 'Nigeria', 'South Africa', 'Kenya', 'Uganda', 'Tanzania',
        'Ghana', 'Zimbabwe', 'Zambia', 'Malawi', 'Botswana', 'Cyprus', 'Malta',
        'Belize', 'Jamaica', 'Trinidad and Tobago', 'Barbados', 'Bahamas'
      ];
      return commonLawCountries.includes(country.name);
    },
    gradient: 'from-indigo-600/20 to-blue-600/10',
    categoryId: 'legal-systems',
    priority: 25,
  },
  {
    id: 'legal-civil-law',
    name: 'Civil Law System',
    description: 'Countries using continental European civil law tradition with written codes.',
    icon: BookOpen,
    color: 'text-emerald-600',
    filter: (country: RealCountryData) => {
      const civilLawCountries = [
        'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland',
        'Austria', 'Portugal', 'Poland', 'Czech Republic', 'Slovakia', 'Hungary',
        'Romania', 'Bulgaria', 'Slovenia', 'Croatia', 'Estonia', 'Latvia', 'Lithuania',
        'Finland', 'Luxembourg', 'Greece', 'Japan', 'South Korea', 'Brazil', 'Argentina',
        'Chile', 'Colombia', 'Peru', 'Mexico', 'Turkey', 'Russia', 'China'
      ];
      return civilLawCountries.includes(country.name);
    },
    gradient: 'from-emerald-600/20 to-teal-600/10',
    categoryId: 'legal-systems',
    priority: 26,
  },
  {
    id: 'legal-islamic-law',
    name: 'Islamic Law System',
    description: 'Countries incorporating Islamic law (Sharia) in their legal framework.',
    icon: Scale,
    color: 'text-teal-600',
    filter: (country: RealCountryData) => {
      const islamicLawCountries = [
        'Saudi Arabia', 'Iran', 'Afghanistan', 'Pakistan', 'Sudan', 'Mauritania',
        'Yemen', 'Somalia', 'Brunei', 'Maldives', 'United Arab Emirates', 'Qatar',
        'Kuwait', 'Bahrain', 'Oman', 'Iraq', 'Syria', 'Jordan', 'Egypt', 'Libya',
        'Algeria', 'Morocco', 'Tunisia', 'Malaysia', 'Indonesia', 'Bangladesh'
      ];
      return islamicLawCountries.includes(country.name);
    },
    gradient: 'from-teal-600/20 to-cyan-600/10',
    categoryId: 'legal-systems',
    priority: 27,
  },
  {
    id: 'legal-mixed-system',
    name: 'Mixed Legal System',
    description: 'Countries combining multiple legal traditions (common law, civil law, religious law).',
    icon: Scale,
    color: 'text-purple-600',
    filter: (country: RealCountryData) => {
      const mixedSystemCountries = [
        'Israel', 'Lebanon', 'Philippines', 'Thailand', 'Sri Lanka', 'Singapore',
        'Hong Kong', 'Scotland', 'Louisiana', 'Quebec', 'Mauritius', 'Seychelles',
        'Madagascar', 'Cameroon', 'Democratic Republic of Congo', 'Central African Republic',
        'Chad', 'Gabon', 'Republic of Congo', 'Ivory Coast', 'Burkina Faso', 'Mali',
        'Niger', 'Senegal', 'Guinea', 'Benin', 'Togo'
      ];
      return mixedSystemCountries.includes(country.name);
    },
    gradient: 'from-purple-600/20 to-fuchsia-600/10',
    categoryId: 'legal-systems',
    priority: 28,
  },
];
