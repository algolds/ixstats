// Asset Manager configuration, types and pure helpers (no JSX).

import {
  Airplane as Plane,
  DeliveryTruck as Ship,
  DeliveryTruck as Truck,
  AntennaSignal as Radio,
  Archery as Target,
} from "iconoir-react";
import { MILITARY_ERAS } from "~/lib/military/equipment";
import { EXPANDED_MILITARY_DATABASE } from "~/lib/military/equipment-extended";

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

/** One entry of `EXPANDED_MILITARY_DATABASE` (see equipment-extended.json). */
interface EquipmentSpec {
  name: string;
  category: string;
  era?: string;
  manufacturer?: string;
  role?: string;
  /** Kilometres, or a label such as "Unlimited (nuclear)". */
  range?: number | string;
  acquisitionCost?: number;
  maintenanceCost?: number;
  imageUrl?: string | null;
}

export interface EquipmentPreset extends EquipmentSpec {
  key: string;
  type: AssetTypeKey;
}

export const ASSET_TYPE_CONFIG = {
  aircraft: { icon: Plane, color: "text-cyan-600 dark:text-cyan-400", label: "Aircraft" },
  ship: { icon: Ship, color: "text-blue-600 dark:text-blue-400", label: "Naval Vessel" },
  vehicle: { icon: Truck, color: "text-emerald-600 dark:text-emerald-400", label: "Vehicle" },
  installation: { icon: Target, color: "text-indigo-600 dark:text-indigo-400", label: "Installation" },
  weapon_system: { icon: Radio, color: "text-red-600 dark:text-red-400", label: "Weapon System" },
} as const;

export const STATUS_CONFIG = {
  operational: { label: "Operational", color: "bg-emerald-500" },
  maintenance: { label: "Maintenance", color: "bg-amber-500" },
  reserve: { label: "Reserve", color: "bg-blue-500" },
  retired: { label: "Retired", color: "bg-muted-foreground" },
} as const;

/** Matches the `assetType` enum of `security.createMilitaryAsset`. */
type AssetTypeKey = keyof typeof ASSET_TYPE_CONFIG;
/** Matches the `status` enum of `security.createMilitaryAsset`. */
type AssetStatusKey = keyof typeof STATUS_CONFIG;

export const isAssetTypeKey = (value: string): value is AssetTypeKey =>
  value in ASSET_TYPE_CONFIG;
export const isAssetStatusKey = (value: string): value is AssetStatusKey =>
  value in STATUS_CONFIG;

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
      MILITARY_ERAS[equipment.era as keyof typeof MILITARY_ERAS]?.techLevel ?? 50,
    imageUrl: equipment.imageUrl || "",
  };
}

const EQUIPMENT_GROUPS: ReadonlyArray<readonly [string, AssetTypeKey]> = [
  ["fighters_gen5", "aircraft"],
  ["fighters_gen4_5", "aircraft"],
  ["attack_aircraft", "aircraft"],
  ["bombers", "aircraft"],
  ["transport", "aircraft"],
  ["helicopters", "aircraft"],
  ["naval_ships", "ship"],
  ["ground_vehicles", "vehicle"],
  ["weapon_systems", "weapon_system"],
];

// The full equipment catalogue (250+ items with images), flattened once.
const ALL_EQUIPMENT: EquipmentPreset[] = EQUIPMENT_GROUPS.flatMap(([group, type]) => {
  const specs: Record<string, EquipmentSpec> = EXPANDED_MILITARY_DATABASE[group] ?? {};
  return Object.entries(specs).map(([key, spec]) => ({ ...spec, key, type }));
});

interface EquipmentFilter {
  searchQuery: string;
  era: string;
  manufacturer: string;
  assetType: AssetTypeKey;
}

/** Catalogue entries matching the search text, era, manufacturer and asset type. */
export function filterEquipment({
  searchQuery,
  era,
  manufacturer,
  assetType,
}: EquipmentFilter): EquipmentPreset[] {
  return ALL_EQUIPMENT.filter((eq) => {
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
