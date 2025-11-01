// src/lib/poi-taxonomy.ts
// Point of Interest Category Taxonomy for IxStats Map Editor
// Icons from lucide-react, colors from Tailwind CSS palette

import type { LucideIcon } from "lucide-react";

/**
 * Defines the structure for a main Point of Interest category.
 */
export type POICategory = {
  label: string;
  color: string;
  subcategories: {
    [key: string]: POISubcategory;
  };
};

/**
 * Defines the structure for a POI subcategory, including its display name and icon.
 */
export type POISubcategory = {
  label: string;
  icon: string; // Using string to represent the icon name from lucide-react
};

/**
 * Represents the entire POI taxonomy structure.
 * The keys are unique identifiers for the main categories.
 */
export type POITaxonomy = {
  [key: string]: POICategory;
};

/**
 * The complete POI category and subcategory taxonomy for the IxStats Map Editor.
 * Icons are sourced from the 'lucide-react' library.
 * Colors are based on Tailwind CSS color palette for modern UI consistency.
 */
export const poiTaxonomy: POITaxonomy = {
  civilian_cultural: {
    label: "Civilian & Cultural",
    color: "#3B82F6", // blue-500
    subcategories: {
      landmark: { label: "Landmark", icon: "Landmark" },
      monument: { label: "Monument", icon: "Monument" },
      museum: { label: "Museum", icon: "Library" },
      place_of_worship: { label: "Place of Worship", icon: "Church" },
      university: { label: "University/College", icon: "GraduationCap" },
      school: { label: "School", icon: "School" },
      hospital: { label: "Hospital", icon: "Hospital" },
      park_garden: { label: "Park / Garden", icon: "Sprout" },
      theater_venue: { label: "Theater / Venue", icon: "Theater" },
      library: { label: "Library", icon: "BookMarked" },
    },
  },
  military_defense: {
    label: "Military & Defense",
    color: "#EF4444", // red-500
    subcategories: {
      military_base: { label: "Military Base", icon: "Shield" },
      airbase: { label: "Airbase", icon: "Plane" },
      naval_base: { label: "Naval Base", icon: "Anchor" },
      fortress_castle: { label: "Fortress / Castle", icon: "Castle" },
      bunker: { label: "Bunker / Fortification", icon: "TowerControl" },
      checkpoint: { label: "Checkpoint", icon: "TrafficCone" },
      radar_installation: { label: "Radar Installation", icon: "Radar" },
      missile_silo: { label: "Missile Silo", icon: "Rocket" },
    },
  },
  natural_features: {
    label: "Natural Features",
    color: "#22C55E", // green-500
    subcategories: {
      mountain_peak: { label: "Mountain Peak", icon: "Mountain" },
      volcano: { label: "Volcano", icon: "MountainSnow" },
      waterfall: { label: "Waterfall", icon: "Waves" },
      lake: { label: "Lake", icon: "Droplets" },
      cave_entrance: { label: "Cave Entrance", icon: "Torus" },
      natural_arch: { label: "Natural Arch", icon: "Gateway" },
      oasis: { label: "Oasis", icon: "Palmtree" },
      canyon: { label: "Canyon / Gorge", icon: "GalleryVertical" },
    },
  },
  infrastructure_transport: {
    label: "Infrastructure & Transport",
    color: "#6B7280", // gray-500
    subcategories: {
      airport: { label: "Airport", icon: "PlaneTakeoff" },
      seaport: { label: "Seaport", icon: "Ship" },
      train_station: { label: "Train Station", icon: "Train" },
      bridge: { label: "Bridge", icon: "GitCommitHorizontal" },
      dam: { label: "Dam", icon: "AreaChart" },
      power_plant: { label: "Power Plant", icon: "Bolt" },
      comm_tower: { label: "Communications Tower", icon: "Signal" },
      spaceport: { label: "Spaceport", icon: "Milestone" },
    },
  },
  commercial_economic: {
    label: "Commercial & Economic",
    color: "#F97316", // orange-500
    subcategories: {
      mine: { label: "Mine", icon: "Pickaxe" },
      oil_well: { label: "Oil Well / Derrick", icon: "Fuel" },
      factory: { label: "Factory / Industrial", icon: "Factory" },
      major_farm: { label: "Major Farm / Plantation", icon: "Tractor" },
      marketplace: { label: "Marketplace", icon: "Store" },
      major_building: { label: "Skyscraper / Major Building", icon: "Building" },
      research_facility: { label: "Research Facility", icon: "FlaskConical" },
    },
  },
  government_services: {
    label: "Government & Services",
    color: "#475569", // slate-600
    subcategories: {
      city_hall: { label: "City Hall / Capitol", icon: "Landmark" },
      embassy: { label: "Embassy", icon: "Flag" },
      police_station: { label: "Police Station", icon: "Siren" },
      fire_station: { label: "Fire Station", icon: "Flame" },
      post_office: { label: "Post Office", icon: "Mail" },
    },
  },
};

// Dynamically create string literal types from the taxonomy object for type safety.
export type POIMainCategoryKey = keyof typeof poiTaxonomy;

// This creates a union of all possible subcategory keys.
export type POISubCategoryKey = {
  [K in POIMainCategoryKey]: keyof (typeof poiTaxonomy)[K]["subcategories"];
}[POIMainCategoryKey];

/**
 * Utility function to get category color by main category key
 */
export function getCategoryColor(category: POIMainCategoryKey): string {
  return poiTaxonomy[category]?.color || "#6B7280";
}

/**
 * Utility function to get subcategory icon name by category and subcategory keys
 */
export function getSubcategoryIcon(
  category: POIMainCategoryKey,
  subcategory: string
): string {
  return poiTaxonomy[category]?.subcategories[subcategory]?.icon || "MapPin";
}

/**
 * Utility function to get all subcategories for a given main category
 */
export function getSubcategories(category: POIMainCategoryKey): Array<POISubcategory & { key: string }> {
  const cat = poiTaxonomy[category];
  if (!cat) return [];

  return Object.entries(cat.subcategories).map(([key, value]) => ({
    key,
    ...value,
  }));
}

/**
 * Utility function to get all main categories as an array
 */
export function getMainCategories(): Array<{
  key: POIMainCategoryKey;
  label: string;
  color: string;
}> {
  return Object.entries(poiTaxonomy).map(([key, value]) => ({
    key: key as POIMainCategoryKey,
    label: value.label,
    color: value.color,
  }));
}
