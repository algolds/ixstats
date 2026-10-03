// src/lib/military/catalog-seed.ts
// Rows that seed the MilitaryEquipmentCatalog and DefenseManufacturer tables from the
// built-in equipment data in ./equipment and ./equipment-extended.
//
// Used by prisma/seeds/military-equipment-catalog.ts and by the militaryEquipment router,
// which seeds an empty catalog on first read (db:seed doesn't run in production).

import {
  DEFENSE_MANUFACTURERS,
  MILITARY_ERAS,
  MILITARY_AIRCRAFT,
  MILITARY_SHIPS,
  MILITARY_VEHICLES,
  WEAPON_SYSTEMS,
} from "./equipment";
import {
  FIGHTERS_GENERATION_5,
  FIGHTERS_GENERATION_4_5,
  ATTACK_AIRCRAFT,
  BOMBERS,
  TRANSPORT_AIRCRAFT,
  HELICOPTERS,
  NAVAL_SHIPS,
  GROUND_VEHICLES,
  WEAPON_SYSTEMS_EXTENDED,
} from "./equipment-extended";

interface EquipmentCatalogSeedRow {
  key: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  era: string;
  specifications: string;
  capabilities: string;
  acquisitionCost: number;
  maintenanceCost: number;
  technologyLevel: number;
  crewRequirement: number;
  imageUrl?: string;
  isActive: boolean;
}

interface ManufacturerSeedRow {
  key: string;
  name: string;
  country: string;
  specialty: string;
  isActive: boolean;
}

/** One item of the built-in equipment data; the groups share these fields loosely. */
interface EquipmentSource {
  name: string;
  manufacturer: string;
  category: string;
  era: string;
  role?: string;
  crew?: number;
  speed?: number;
  range?: number | string;
  ceiling?: number;
  variants?: readonly string[];
  displacement?: number;
  depth?: number;
  aircraft?: number;
  armament?: string;
  troops?: number;
  firingRange?: number;
  altitude?: number;
  acquisitionCost: number;
  maintenanceCost?: number;
  imageUrl?: string;
}

type EquipmentGroup = Record<string, EquipmentSource>;

function techLevelForEra(era: string): number {
  return MILITARY_ERAS[era as keyof typeof MILITARY_ERAS]?.techLevel ?? 75;
}

function json(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function aircraftSubcategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("bomber")) return "bomber";
  if (c.includes("transport")) return "transport";
  if (c.includes("helicopter")) return "helicopter";
  if (c.includes("attack")) return "attack";
  return "fighter";
}

function shipSubcategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("carrier")) return "carrier";
  if (c.includes("submarine")) return "submarine";
  if (c.includes("frigate")) return "frigate";
  if (c.includes("amphibious")) return "amphibious";
  return "destroyer";
}

function vehicleSubcategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("tank")) return "tank";
  if (c.includes("ifv") || c.includes("fighting")) return "ifv";
  if (c.includes("apc") || c.includes("personnel")) return "apc";
  if (c.includes("artillery") || c.includes("howitzer")) return "artillery";
  if (c.includes("rocket") || c.includes("mlrs")) return "mlrs";
  return "tank";
}

function weaponSubcategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("air defense") || c.includes("sam")) return "air_defense";
  if (c.includes("missile")) return "missile";
  if (c.includes("naval") || c.includes("ciws")) return "naval_weapon";
  if (c.includes("torpedo")) return "torpedo";
  return "air_defense";
}

function aircraftRow(
  key: string,
  item: EquipmentSource,
  subcategory: string
): EquipmentCatalogSeedRow {
  return {
    key,
    name: item.name,
    manufacturer: item.manufacturer,
    category: "aircraft",
    subcategory,
    era: item.era,
    specifications: json({
      crew: item.crew,
      speed: item.speed,
      range: item.range,
      ceiling: item.ceiling,
      variants: item.variants,
    }),
    capabilities: json({ role: item.role, category: item.category }),
    acquisitionCost: item.acquisitionCost,
    maintenanceCost: item.maintenanceCost ?? 0,
    technologyLevel: techLevelForEra(item.era),
    crewRequirement: item.crew ?? 0,
    imageUrl: item.imageUrl,
    isActive: true,
  };
}

function shipRow(key: string, item: EquipmentSource): EquipmentCatalogSeedRow {
  return {
    key,
    name: item.name,
    manufacturer: item.manufacturer,
    category: "naval",
    subcategory: shipSubcategory(item.category),
    era: item.era,
    specifications: json({
      displacement: item.displacement,
      crew: item.crew,
      speed: item.speed,
      range: item.range,
      depth: item.depth,
      aircraft: item.aircraft,
    }),
    capabilities: json({ category: item.category }),
    acquisitionCost: item.acquisitionCost,
    maintenanceCost: item.maintenanceCost ?? 0,
    technologyLevel: techLevelForEra(item.era),
    crewRequirement: item.crew ?? 0,
    imageUrl: item.imageUrl,
    isActive: true,
  };
}

function vehicleRow(key: string, item: EquipmentSource): EquipmentCatalogSeedRow {
  return {
    key,
    name: item.name,
    manufacturer: item.manufacturer,
    category: "vehicle",
    subcategory: vehicleSubcategory(item.category),
    era: item.era,
    specifications: json({
      crew: item.crew,
      speed: item.speed,
      range: item.range,
      armament: item.armament,
      troops: item.troops,
      firingRange: item.firingRange,
    }),
    capabilities: json({ category: item.category }),
    acquisitionCost: item.acquisitionCost,
    maintenanceCost: item.maintenanceCost ?? 0,
    technologyLevel: techLevelForEra(item.era),
    crewRequirement: item.crew ?? 0,
    imageUrl: item.imageUrl,
    isActive: true,
  };
}

function weaponRow(key: string, item: EquipmentSource): EquipmentCatalogSeedRow {
  return {
    key,
    name: item.name,
    manufacturer: item.manufacturer,
    category: "missile",
    subcategory: weaponSubcategory(item.category),
    era: item.era,
    specifications: json({ range: item.range, altitude: item.altitude, speed: item.speed }),
    capabilities: json({ category: item.category }),
    acquisitionCost: item.acquisitionCost,
    maintenanceCost: item.maintenanceCost ?? 0,
    technologyLevel: techLevelForEra(item.era),
    crewRequirement: 0,
    imageUrl: item.imageUrl,
    isActive: true,
  };
}

/**
 * Every built-in equipment item as a catalog row, keyed uniquely. Where two groups share a
 * key the first one wins (the extended aircraft groups before the base aircraft list).
 */
export function buildEquipmentCatalogSeed(): EquipmentCatalogSeedRow[] {
  const rows = new Map<string, EquipmentCatalogSeedRow>();
  const add = (row: EquipmentCatalogSeedRow) => {
    if (!rows.has(row.key)) rows.set(row.key, row);
  };

  const aircraftGroups: Array<[EquipmentGroup, string]> = [
    [FIGHTERS_GENERATION_5, "fighter_gen5"],
    [FIGHTERS_GENERATION_4_5, "fighter_gen4_5"],
    [ATTACK_AIRCRAFT, "attack"],
    [BOMBERS, "bomber"],
    [TRANSPORT_AIRCRAFT, "transport"],
    [HELICOPTERS, "helicopter"],
  ];
  for (const [group, subcategory] of aircraftGroups) {
    for (const [key, item] of Object.entries(group)) add(aircraftRow(key, item, subcategory));
  }
  for (const [key, item] of Object.entries(MILITARY_AIRCRAFT as unknown as EquipmentGroup)) {
    add(aircraftRow(key, item, aircraftSubcategory(item.category)));
  }

  const ships = { ...(MILITARY_SHIPS as unknown as EquipmentGroup), ...NAVAL_SHIPS };
  for (const [key, item] of Object.entries(ships)) add(shipRow(key, item));

  const vehicles = { ...(MILITARY_VEHICLES as unknown as EquipmentGroup), ...GROUND_VEHICLES };
  for (const [key, item] of Object.entries(vehicles)) add(vehicleRow(key, item));

  const weapons = { ...(WEAPON_SYSTEMS as unknown as EquipmentGroup), ...WEAPON_SYSTEMS_EXTENDED };
  for (const [key, item] of Object.entries(weapons)) add(weaponRow(key, item));

  return Array.from(rows.values());
}

/** Every built-in defense manufacturer as a DefenseManufacturer row. */
export function buildManufacturerSeed(): ManufacturerSeedRow[] {
  return Object.entries(DEFENSE_MANUFACTURERS).map(([key, manufacturer]) => ({
    key,
    name: manufacturer.name,
    country: manufacturer.country,
    specialty: manufacturer.specialty.join(", "),
    isActive: true,
  }));
}
