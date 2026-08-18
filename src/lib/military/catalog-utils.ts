// src/lib/equipment-catalog-utils.ts
// Pure logic + constants for the military equipment catalog admin.
// No React dependencies — fully unit-testable.

import { Plane, Ship, Car, Rocket, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Equipment categories (must match tRPC router and seed script)
export const CATEGORIES = {
  all: "All Equipment",
  aircraft: "Aircraft",
  naval: "Naval Vessels",
  vehicle: "Vehicles",
  missile: "Missiles & Weapons",
  support: "Support Equipment",
} as const;

export const SUBCATEGORIES = {
  aircraft: [
    "fighter_gen5",
    "fighter_gen4_5",
    "fighter",
    "bomber",
    "attack",
    "transport",
    "helicopter",
  ],
  naval: ["carrier", "destroyer", "frigate", "submarine", "amphibious"],
  vehicle: ["tank", "ifv", "apc", "artillery", "mlrs"],
  missile: ["air_defense", "missile", "naval_weapon", "torpedo"],
  support: ["logistics", "medical", "command", "reconnaissance", "electronic-warfare"],
} as const;

export const ERAS = [
  { value: "COLD_WAR", label: "Cold War" },
  { value: "MODERN", label: "Modern" },
  { value: "CONTEMPORARY", label: "Contemporary" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "NEXT_GEN", label: "Next Generation" },
];

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  aircraft: Plane,
  naval: Ship,
  vehicle: Car,
  missile: Rocket,
  support: Wrench,
};

export interface EquipmentFormData {
  key: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  era: string;
  specifications: Record<string, any>;
  capabilities: Record<string, any>;
  acquisitionCost: number;
  maintenanceCost: number;
  technologyLevel: number;
  crewRequirement: number;
  maintenanceHours: number;
  imageUrl: string;
  description: string;
  historicalContext: string;
  isActive: boolean;
}

export const DEFAULT_EQUIPMENT_FORM: EquipmentFormData = {
  key: "",
  name: "",
  manufacturer: "",
  category: "aircraft",
  subcategory: "fighter",
  era: "MODERN",
  specifications: {},
  capabilities: {},
  acquisitionCost: 1000000,
  maintenanceCost: 100000,
  technologyLevel: 80,
  crewRequirement: 1,
  maintenanceHours: 100,
  imageUrl: "",
  description: "",
  historicalContext: "",
  isActive: true,
};

export interface FilterableEquipmentItem {
  subcategory?: string | null;
  technologyLevel?: number | null;
  acquisitionCost?: number | null;
}

/**
 * Filters catalog equipment by subcategory, tech-level range, and cost range.
 * The category/era/search filters are applied server-side via the tRPC query.
 */
export function filterEquipment<T extends FilterableEquipmentItem>(
  equipmentData: T[] | undefined,
  subcategoryFilter: string,
  techLevelRange: [number, number],
  costRange: [number, number]
): T[] {
  if (!equipmentData) return [];

  return equipmentData.filter((item) => {
    // Subcategory filter
    if (subcategoryFilter !== "all" && item.subcategory !== subcategoryFilter) return false;

    // Tech level filter
    const techLevel = item.technologyLevel ?? 0;
    if (techLevel < techLevelRange[0]! || techLevel > techLevelRange[1]!)
      return false;

    // Cost filter
    const cost = item.acquisitionCost ?? 0;
    if (cost < costRange[0]! || cost > costRange[1]!) return false;

    return true;
  });
}
