// src/app/countries/_components/index.ts
// Countries page component exports for clean imports

export { CountriesPageHeader } from './CountriesPageHeader';
export { CountriesSearch } from './CountriesSearch';
export { CountriesGrid } from './CountriesGrid';
export { CountryListCard } from './CountryListCard';
export { CountryInfobox } from './CountryInfobox';

// Re-export types for convenience
export type {
  SortField,
  SortDirection,
  TierFilter
} from './CountriesSearch';

// It might be useful to export CountryData type if used by parent components
// export type { CountryData } from './CountryListCard'; // Or from a central types file