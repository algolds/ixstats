import {
  Book,
  Building,
  ClockRotateRight,
  Coins,
  Globe,
  Group,
  Heart,
  Map,
  Shield,
} from "iconoir-react";

/**
 * Wiki Intelligence Tab - Constants
 *
 * Centralized constants for the Wiki Intelligence system including:
 * - Classification styles for security clearance levels
 * - Section icons mapping
 * - Valid infobox fields for display
 * - Field name mappings for human-readable display
 */

/**
 * Visual styling for classification levels
 * Used to indicate the security clearance required to view wiki sections
 */
export const CLASSIFICATION_STYLES = {
  PUBLIC: {
    color: "text-green",
    bg: "bg-green/10",
    border: "border-green/30",
    label: "PUBLIC",
  },
  RESTRICTED: {
    color: "text-yellow",
    bg: "bg-yellow/10",
    border: "border-yellow/30",
    label: "RESTRICTED",
  },
  CONFIDENTIAL: {
    color: "text-orange",
    bg: "bg-orange/10",
    border: "border-orange/30",
    label: "CONFIDENTIAL",
  },
  TOP_SECRET: {
    color: "text-destructive",
    bg: "bg-red/10",
    border: "border-red/30",
    label: "TOP SECRET",
  },
} as const;

/**
 * Icon mapping for different wiki section types
 * Provides contextual visual indicators for section categories
 */
export const SECTION_ICONS = {
  overview: Globe,
  geography: Map,
  government: Building,
  economy: Coins,
  demographics: Group,
  history: ClockRotateRight,
  culture: Heart,
  foreign_relations: Globe,
  military: Shield,
  education: Book,
  default: Book,
} as const;

/**
 * Valid infobox fields for modal display
 * Filters out technical/internal MediaWiki fields to show only meaningful data
 */
const VALID_INFOBOX_FIELDS = new Set([
  "name",
  "conventional_long_name",
  "native_name",
  "common_name",
  "capital",
  "largest_city",
  "official_languages",
  "languages",
  "ethnic_groups",
  "religion",
  "demonym",
  "government_type",
  "leader_title1",
  "leader_name1",
  "leader_title2",
  "leader_name2",
  "legislature",
  "upper_house",
  "lower_house",
  "sovereignty_type",
  "established_event1",
  "established_date1",
  "established_event2",
  "established_date2",
  "area_km2",
  "area_sq_mi",
  "area_rank",
  "percent_water",
  "population_estimate",
  "population_census",
  "population_density_km2",
  "population_density_sq_mi",
  "GDP_PPP",
  "GDP_nominal",
  "GDP_PPP_per_capita",
  "GDP_nominal_per_capita",
  "Gini",
  "HDI",
  "currency",
  "currency_code",
  "time_zone",
  "utc_offset",
  "date_format",
  "drives_on",
  "calling_code",
  "cctld",
  "iso3166code",
] as const);
