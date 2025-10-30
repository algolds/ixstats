/**
 * Wiki Intelligence Tab - Constants
 *
 * Centralized constants for the Wiki Intelligence system including:
 * - Classification styles for security clearance levels
 * - Section icons mapping
 * - Valid infobox fields for display
 * - Field name mappings for human-readable display
 */

import {
  RiBookOpenLine,
  RiGlobalLine,
  RiMapLine,
  RiBuildingLine,
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiHeartLine,
  RiShieldLine,
  RiHistoryLine,
} from "react-icons/ri";

/**
 * Visual styling for classification levels
 * Used to indicate the security clearance required to view wiki sections
 */
export const CLASSIFICATION_STYLES = {
  PUBLIC: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  RESTRICTED: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  CONFIDENTIAL: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

/**
 * Icon mapping for different wiki section types
 * Provides contextual visual indicators for section categories
 */
export const SECTION_ICONS = {
  overview: RiGlobalLine,
  geography: RiMapLine,
  government: RiBuildingLine,
  economy: RiMoneyDollarCircleLine,
  demographics: RiTeamLine,
  history: RiHistoryLine,
  culture: RiHeartLine,
  foreign_relations: RiGlobalLine,
  military: RiShieldLine,
  education: RiBookOpenLine,
  default: RiBookOpenLine
} as const;

/**
 * Valid infobox fields for modal display
 * Filters out technical/internal MediaWiki fields to show only meaningful data
 */
export const VALID_INFOBOX_FIELDS = new Set([
  'name',
  'conventional_long_name',
  'native_name',
  'common_name',
  'capital',
  'largest_city',
  'official_languages',
  'languages',
  'ethnic_groups',
  'religion',
  'demonym',
  'government_type',
  'leader_title1',
  'leader_name1',
  'leader_title2',
  'leader_name2',
  'legislature',
  'upper_house',
  'lower_house',
  'sovereignty_type',
  'established_event1',
  'established_date1',
  'established_event2',
  'established_date2',
  'area_km2',
  'area_sq_mi',
  'area_rank',
  'percent_water',
  'population_estimate',
  'population_census',
  'population_density_km2',
  'population_density_sq_mi',
  'GDP_PPP',
  'GDP_nominal',
  'GDP_PPP_per_capita',
  'GDP_nominal_per_capita',
  'Gini',
  'HDI',
  'currency',
  'currency_code',
  'time_zone',
  'utc_offset',
  'date_format',
  'drives_on',
  'calling_code',
  'cctld',
  'iso3166code'
] as const);

/**
 * Field name mapping for human-readable display
 * Converts technical MediaWiki infobox field names to user-friendly labels
 */
export const FIELD_NAME_MAP: Record<string, string> = {
  conventional_long_name: 'Official Name',
  native_name: 'Native Name',
  common_name: 'Common Name',
  largest_city: 'Largest City',
  official_languages: 'Official Languages',
  ethnic_groups: 'Ethnic Groups',
  government_type: 'Government Type',
  leader_title1: 'Head of State',
  leader_name1: 'Current Leader',
  leader_title2: 'Head of Government',
  leader_name2: 'Government Leader',
  upper_house: 'Upper House',
  lower_house: 'Lower House',
  sovereignty_type: 'Sovereignty',
  established_event1: 'Founded',
  established_date1: 'Foundation Date',
  established_event2: 'Independence',
  established_date2: 'Independence Date',
  area_km2: 'Area (km²)',
  area_sq_mi: 'Area (sq mi)',
  area_rank: 'Area Rank',
  percent_water: 'Water (%)',
  population_estimate: 'Population (est.)',
  population_census: 'Population (census)',
  population_density_km2: 'Density (km²)',
  population_density_sq_mi: 'Density (sq mi)',
  GDP_PPP: 'GDP (PPP)',
  GDP_nominal: 'GDP (nominal)',
  GDP_PPP_per_capita: 'GDP per capita (PPP)',
  GDP_nominal_per_capita: 'GDP per capita (nominal)',
  currency_code: 'Currency Code',
  time_zone: 'Time Zone',
  utc_offset: 'UTC Offset',
  date_format: 'Date Format',
  drives_on: 'Drives On',
  calling_code: 'Calling Code',
  cctld: 'Internet TLD',
  iso3166code: 'ISO Code'
} as const;

/**
 * Type exports for type-safe usage
 */
export type ClassificationLevel = keyof typeof CLASSIFICATION_STYLES;
export type SectionType = keyof typeof SECTION_ICONS;
export type ValidInfoboxField = typeof VALID_INFOBOX_FIELDS extends Set<infer T> ? T : never;
