// src/lib/manufacturer-utils.ts
// Pure logic + constants for the defense manufacturer admin.
// No React dependencies — fully unit-testable.

// Manufacturer specialties
export const SPECIALTIES = [
  "aircraft",
  "ships",
  "vehicles",
  "weapons",
  "missiles",
  "electronics",
  "radar",
  "communications",
  "naval",
  "aerospace",
  "armored-vehicles",
  "artillery",
  "small-arms",
  "submarines",
  "helicopters",
  "drones",
  "cyber-systems",
  "satellites",
] as const;

export type SortField = "name" | "country" | "equipmentCount" | "founded";
export type SortDirection = "asc" | "desc";

export interface Manufacturer {
  id: string;
  name: string;
  country: string;
  specialty: string | null;
  founded?: number | null;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  equipment?: {
    id: string;
    name: string;
    category: string;
    technologyTier?: number;
    technologyLevel?: number;
  }[];
}

export type ManufacturerWithCount = Manufacturer & { equipmentCount: number };

export interface ManufacturerFormData {
  name: string;
  country: string;
  specialty: string[];
  founded: number | undefined;
  description: string;
  isActive: boolean;
}

export const DEFAULT_MANUFACTURER_FORM: ManufacturerFormData = {
  name: "",
  country: "",
  specialty: [],
  founded: undefined,
  description: "",
  isActive: true,
};

/**
 * Normalizes raw manufacturer records from the API into the Manufacturer shape,
 * coercing nullable fields to predictable defaults.
 */
export function normalizeManufacturers(manufacturersAll: any[] | undefined): Manufacturer[] {
  if (!manufacturersAll) return [];
  return manufacturersAll.map((m) => ({
    ...m,
    specialty: m.specialty ?? "",
    founded: (m as Manufacturer).founded ?? null,
    description: (m as Manufacturer).description ?? null,
    equipment: (m as Manufacturer).equipment ?? [],
  })) as Manufacturer[];
}

/**
 * Returns the sorted list of unique manufacturer countries.
 */
export function getUniqueCountries(normalizedManufacturers: Manufacturer[]): string[] {
  if (normalizedManufacturers.length === 0) return [];
  const uniqueCountries = new Set(normalizedManufacturers.map((m) => m.country));
  return Array.from(uniqueCountries).sort();
}

/**
 * Filters by country + search query, decorates with equipment counts, and sorts.
 */
export function filterAndSortManufacturers(
  normalizedManufacturers: Manufacturer[],
  countryFilter: string,
  manufacturerSearchQuery: string,
  sortField: SortField,
  sortDirection: SortDirection
): ManufacturerWithCount[] {
  if (normalizedManufacturers.length === 0) return [];

  const filtered = normalizedManufacturers.filter((manufacturer) => {
    // Country filter
    if (countryFilter !== "all" && manufacturer.country !== countryFilter) return false;

    // Search filter
    if (manufacturerSearchQuery) {
      const query = manufacturerSearchQuery.toLowerCase();
      return (
        manufacturer.name.toLowerCase().includes(query) ||
        manufacturer.country.toLowerCase().includes(query) ||
        manufacturer.specialty?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Add equipment count for sorting
  const withCounts: ManufacturerWithCount[] = filtered.map((m) => ({
    ...m,
    equipmentCount: m.equipment?.length ?? 0,
  }));

  // Sort
  withCounts.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "country":
        comparison = a.country.localeCompare(b.country);
        break;
      case "equipmentCount":
        comparison = a.equipmentCount - b.equipmentCount;
        break;
      case "founded":
        comparison = (a.founded || 0) - (b.founded || 0);
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  return withCounts;
}

/**
 * Splits a comma-separated specialty string into a trimmed array.
 */
export function parseSpecialties(specialty: string | null): string[] {
  if (!specialty) return [];
  return specialty
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
