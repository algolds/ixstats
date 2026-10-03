// src/lib/military/player-catalog.ts
// The equipment templates players pick from in the Defense asset dialog, built from
// MilitaryEquipmentCatalog rows (edited at /admin/military-equipment). The built-in
// equipment data is the fallback when the catalog can't be read.

import { buildEquipmentCatalogSeed, buildManufacturerSeed } from "./catalog-seed";

/** Matches the `assetType` enum of `security.createMilitaryAsset`. */
export type AssetTypeKey = "aircraft" | "ship" | "vehicle" | "installation" | "weapon_system";

export interface EquipmentPreset {
  key: string;
  type: AssetTypeKey;
  name: string;
  /** Display category, such as "Main Battle Tank". */
  category: string;
  era?: string;
  /** Manufacturer key (or name, for catalog rows created before keys were stored). */
  manufacturer?: string;
  role?: string;
  /** Kilometres, or a label such as "Unlimited (nuclear)". */
  range?: number | string;
  acquisitionCost?: number;
  maintenanceCost?: number;
  technologyLevel?: number;
  imageUrl?: string | null;
}

export interface CatalogManufacturer {
  key: string;
  name: string;
  country: string;
}

/** The catalog row fields the player template needs. */
interface CatalogEquipmentRow {
  key: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string | null;
  era: string;
  specifications: string | null;
  capabilities: string | null;
  acquisitionCost: number;
  maintenanceCost: number;
  technologyLevel: number;
  imageUrl?: string | null;
}

/** Catalog category (see CATEGORIES in ./catalog-utils) → player asset type. */
const ASSET_TYPE_BY_CATEGORY: Record<string, AssetTypeKey> = {
  aircraft: "aircraft",
  naval: "ship",
  vehicle: "vehicle",
  missile: "weapon_system",
  support: "installation",
};

function parseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function catalogRowToPreset(row: CatalogEquipmentRow): EquipmentPreset {
  const specifications = parseObject(row.specifications);
  const capabilities = parseObject(row.capabilities);
  const range = specifications.range;

  return {
    key: row.key,
    type: ASSET_TYPE_BY_CATEGORY[row.category] ?? "installation",
    name: row.name,
    category: asString(capabilities.category) ?? row.subcategory ?? row.category,
    era: row.era,
    manufacturer: row.manufacturer,
    role: asString(capabilities.role),
    range: typeof range === "number" || typeof range === "string" ? range : undefined,
    acquisitionCost: row.acquisitionCost,
    maintenanceCost: row.maintenanceCost,
    technologyLevel: row.technologyLevel,
    imageUrl: row.imageUrl ?? null,
  };
}

/** The built-in equipment as player templates (the same items the catalog is seeded with). */
export function builtinEquipmentPresets(): EquipmentPreset[] {
  return buildEquipmentCatalogSeed().map((row) => catalogRowToPreset(row));
}

export function builtinManufacturers(): CatalogManufacturer[] {
  return buildManufacturerSeed().map(({ key, name, country }) => ({ key, name, country }));
}
