// Asset Manager configuration, types and pure helpers (no JSX).

import {
  Airplane as Plane,
  DeliveryTruck as Ship,
  DeliveryTruck as Truck,
  AntennaSignal as Radio,
  Archery as Target,
} from "iconoir-react";
import { MILITARY_ERAS } from "~/lib/military/equipment";
import type { AssetTypeKey, EquipmentPreset } from "~/lib/military/player-catalog";

export type { EquipmentPreset } from "~/lib/military/player-catalog";

// Define a more specific type for our asset
export interface Asset {
  id: string;
  name: string;
  assetType: string;
  category: string;
  status: string;
  operational: number;
  quantity: number;
  acquisitionCost: number;
  maintenanceCost: number;
  modernizationLevel: number;
  capability: string | null;
  imageUrl?: string | null;
}

/** Asset types share one quiet icon colour; type is carried by the icon and label, not hue. */
export const ASSET_TYPE_CONFIG = {
  aircraft: { icon: Plane, color: "text-label-secondary", label: "Aircraft" },
  ship: { icon: Ship, color: "text-label-secondary", label: "Naval Vessel" },
  vehicle: { icon: Truck, color: "text-label-secondary", label: "Vehicle" },
  installation: { icon: Target, color: "text-label-secondary", label: "Installation" },
  weapon_system: { icon: Radio, color: "text-label-secondary", label: "Weapon System" },
} as const satisfies Record<AssetTypeKey, unknown>;

/** `color` is the outline-badge status colour (semantic: ready / degraded / idle). */
export const STATUS_CONFIG = {
  operational: { label: "Operational", color: "border-green/30 text-green" },
  maintenance: { label: "Maintenance", color: "border-yellow/30 text-yellow" },
  reserve: { label: "Reserve", color: "text-label-secondary" },
  retired: { label: "Retired", color: "text-label-secondary" },
} as const;

/** Matches the `status` enum of `security.createMilitaryAsset`. */
type AssetStatusKey = keyof typeof STATUS_CONFIG;

export const isAssetTypeKey = (value: string): value is AssetTypeKey => value in ASSET_TYPE_CONFIG;
export const isAssetStatusKey = (value: string): value is AssetStatusKey => value in STATUS_CONFIG;

/** Form state; `range` and `payload` are display-only and are not persisted. */
export interface AssetFormData {
  assetType: AssetTypeKey;
  category: string;
  name: string;
  quantity: number;
  operational: number;
  capability: string;
  range: number;
  payload: number;
  status: AssetStatusKey;
  modernizationLevel: number;
  acquisitionCost: number;
  maintenanceCost: number;
  imageUrl: string;
}

export function toFormData(asset: Asset | null): AssetFormData {
  return {
    assetType: asset && isAssetTypeKey(asset.assetType) ? asset.assetType : "aircraft",
    category: asset?.category ?? "",
    name: asset?.name ?? "",
    quantity: asset?.quantity ?? 1,
    operational: asset?.operational ?? 1,
    capability: asset?.capability ?? "",
    range: 0,
    payload: 0,
    status: asset && isAssetStatusKey(asset.status) ? asset.status : "operational",
    modernizationLevel: asset?.modernizationLevel ?? 50,
    acquisitionCost: asset?.acquisitionCost ?? 0,
    maintenanceCost: asset?.maintenanceCost ?? 0,
    imageUrl: asset?.imageUrl || "",
  };
}

/** Form data after loading an equipment template on top of `current`. */
export function applyEquipmentPreset(
  current: AssetFormData,
  equipment: EquipmentPreset
): AssetFormData {
  return {
    ...current,
    name: equipment.name,
    category: equipment.category,
    capability: equipment.role ?? equipment.category,
    range: typeof equipment.range === "number" ? equipment.range : 0,
    payload: 0,
    acquisitionCost: equipment.acquisitionCost ?? 0,
    maintenanceCost: equipment.maintenanceCost ?? 0,
    modernizationLevel:
      equipment.technologyLevel ??
      MILITARY_ERAS[equipment.era as keyof typeof MILITARY_ERAS]?.techLevel ??
      50,
    imageUrl: equipment.imageUrl || "",
  };
}

interface EquipmentFilter {
  searchQuery: string;
  era: string;
  manufacturer: string;
  assetType: AssetTypeKey;
}

/** Catalogue entries matching the search text, era, manufacturer and asset type. */
export function filterEquipment(
  equipment: readonly EquipmentPreset[],
  { searchQuery, era, manufacturer, assetType }: EquipmentFilter
): EquipmentPreset[] {
  return equipment.filter((eq) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      eq.name.toLowerCase().includes(q) ||
      eq.type.toLowerCase().includes(q) ||
      (eq.category && eq.category.toLowerCase().includes(q)) ||
      eq.key.toLowerCase().includes(q);
    const matchesEra = era === "all" || eq.era === era;
    const matchesManufacturer = manufacturer === "all" || eq.manufacturer === manufacturer;
    const matchesType = assetType === eq.type;

    return matchesSearch && matchesEra && matchesManufacturer && matchesType;
  });
}
