export function capitalizedOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));
}

export const CITY_TYPES = ["capital", "city", "town", "village", "hamlet", "port", "fortress"];
const SUBDIVISION_TYPES = [
  "province",
  "state",
  "region",
  "territory",
  "district",
  "county",
  "department",
];
const POI_CATEGORIES = [
  "landmark",
  "historical",
  "natural",
  "religious",
  "military",
  "cultural",
  "economic",
  "educational",
  "monument",
  "ruins",
];

export const CITY_TYPE_OPTIONS = capitalizedOptions(CITY_TYPES);
export const SUBDIVISION_TYPE_OPTIONS = capitalizedOptions(SUBDIVISION_TYPES);
export const POI_CATEGORY_OPTIONS = capitalizedOptions(POI_CATEGORIES);
