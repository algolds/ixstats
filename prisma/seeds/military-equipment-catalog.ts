/**
 * Military Equipment Catalog Seed Script
 *
 * Migrates all military equipment from TypeScript data files to the database.
 * Includes 22 manufacturers and 250+ equipment items across all categories.
 *
 * Categories:
 * - Aircraft: Fighters (Gen 5 & 4.5), Attack, Bombers, Transport, Helicopters
 * - Naval: Carriers, Destroyers, Frigates, Submarines, Amphibious
 * - Vehicles: Main Battle Tanks, IFVs, APCs, Artillery, MLRS
 * - Weapons: Air Defense, Missiles, Naval Systems
 *
 * Run with: npx tsx prisma/seeds/military-equipment-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  DEFENSE_MANUFACTURERS,
  MILITARY_ERAS,
  MILITARY_AIRCRAFT,
  MILITARY_SHIPS,
  MILITARY_VEHICLES,
  WEAPON_SYSTEMS,
} from "../../src/lib/military-equipment";
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
} from "../../src/lib/military-equipment-extended";

const prisma = new PrismaClient();

// Helper to get technology level from era
function getTechLevelFromEra(era: string): number {
  const eraKey = era as keyof typeof MILITARY_ERAS;
  return MILITARY_ERAS[eraKey]?.techLevel || 75;
}

// Helper to safely stringify JSON
function safeStringify(obj: any): string {
  if (!obj) return "{}";
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

export async function seedMilitaryEquipmentCatalog() {
  console.log("\n🔧 Starting military equipment catalog seed...\n");

  let manufacturersCreated = 0;
  let manufacturersSkipped = 0;
  let equipmentCreated = 0;
  let equipmentSkipped = 0;

  // ============================================================================
  // SEED MANUFACTURERS (into DefenseManufacturer table)
  // ============================================================================
  console.log("🏭 Seeding defense manufacturers...\n");

  const manufacturerEntries = Object.entries(DEFENSE_MANUFACTURERS);

  for (const [key, manufacturer] of manufacturerEntries) {
    try {
      // Check if manufacturer exists in DefenseManufacturer table
      const existing = await prisma.defenseManufacturer.findFirst({
        where: { key },
      });

      if (existing) {
        console.log(`⏭️  Manufacturer exists: ${manufacturer.name} (${manufacturer.country})`);
        manufacturersSkipped++;
        continue;
      }

      // Create manufacturer in proper DefenseManufacturer table
      await prisma.defenseManufacturer.create({
        data: {
          key,
          name: manufacturer.name,
          country: manufacturer.country,
          specialty: Array.isArray(manufacturer.specialty)
            ? manufacturer.specialty.join(", ")
            : manufacturer.specialty,
          isActive: true,
        },
      });

      console.log(`✅ Created manufacturer: ${manufacturer.name} (${manufacturer.country})`);
      manufacturersCreated++;
    } catch (error) {
      console.error(`❌ Error creating manufacturer ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - GENERATION 5 FIGHTERS
  // ============================================================================
  console.log("\n✈️  Seeding Generation 5 Fighters...\n");

  for (const [key, aircraft] of Object.entries(FIGHTERS_GENERATION_5)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "fighter_gen5",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - GENERATION 4.5 FIGHTERS
  // ============================================================================
  console.log("\n✈️  Seeding Generation 4.5 Fighters...\n");

  for (const [key, aircraft] of Object.entries(FIGHTERS_GENERATION_4_5)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "fighter_gen4_5",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - ATTACK AIRCRAFT
  // ============================================================================
  console.log("\n💥 Seeding Attack Aircraft...\n");

  for (const [key, aircraft] of Object.entries(ATTACK_AIRCRAFT)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "attack",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - BOMBERS
  // ============================================================================
  console.log("\n💣 Seeding Bombers...\n");

  for (const [key, aircraft] of Object.entries(BOMBERS)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "bomber",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - TRANSPORT
  // ============================================================================
  console.log("\n🚚 Seeding Transport Aircraft...\n");

  for (const [key, aircraft] of Object.entries(TRANSPORT_AIRCRAFT)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "transport",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - HELICOPTERS
  // ============================================================================
  console.log("\n🚁 Seeding Helicopters...\n");

  for (const [key, aircraft] of Object.entries(HELICOPTERS)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory: "helicopter",
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          imageUrl: "imageUrl" in aircraft ? (aircraft.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED AIRCRAFT - BASE MILITARY_AIRCRAFT (additional items not in extended)
  // ============================================================================
  console.log("\n✈️  Seeding base Military Aircraft...\n");

  for (const [key, aircraft] of Object.entries(MILITARY_AIRCRAFT)) {
    try {
      // Skip if already exists from extended collections
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      // Determine subcategory from aircraft properties
      let subcategory = "fighter";
      if (aircraft.category.toLowerCase().includes("bomber")) subcategory = "bomber";
      else if (aircraft.category.toLowerCase().includes("transport")) subcategory = "transport";
      else if (aircraft.category.toLowerCase().includes("helicopter")) subcategory = "helicopter";
      else if (aircraft.category.toLowerCase().includes("attack")) subcategory = "attack";

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: aircraft.name,
          manufacturer: aircraft.manufacturer,
          category: "aircraft",
          subcategory,
          era: aircraft.era,
          specifications: safeStringify({
            crew: aircraft.crew,
            speed: aircraft.speed,
            range: aircraft.range,
            ceiling: aircraft.ceiling,
            variants: "variants" in aircraft ? aircraft.variants : undefined,
          }),
          capabilities: safeStringify({
            role: aircraft.role,
            category: aircraft.category,
          }),
          acquisitionCost: aircraft.acquisitionCost,
          maintenanceCost: aircraft.maintenanceCost,
          technologyLevel: getTechLevelFromEra(aircraft.era),
          crewRequirement: aircraft.crew,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${aircraft.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED NAVAL SHIPS
  // ============================================================================
  console.log("\n🚢 Seeding Naval Ships...\n");

  // Combine base and extended naval ships
  const allNavalShips = { ...MILITARY_SHIPS, ...NAVAL_SHIPS };

  for (const [key, ship] of Object.entries(allNavalShips)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      // Determine subcategory
      let subcategory = "destroyer";
      const categoryLower = ship.category.toLowerCase();
      if (categoryLower.includes("carrier")) subcategory = "carrier";
      else if (categoryLower.includes("submarine")) subcategory = "submarine";
      else if (categoryLower.includes("frigate")) subcategory = "frigate";
      else if (categoryLower.includes("destroyer")) subcategory = "destroyer";
      else if (categoryLower.includes("amphibious")) subcategory = "amphibious";

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: ship.name,
          manufacturer: ship.manufacturer,
          category: "naval",
          subcategory,
          era: ship.era,
          specifications: safeStringify({
            displacement: ship.displacement,
            crew: ship.crew,
            speed: ship.speed,
            range: "range" in ship ? ship.range : undefined,
            depth: "depth" in ship ? ship.depth : undefined,
            aircraft: "aircraft" in ship ? ship.aircraft : undefined,
          }),
          capabilities: safeStringify({
            category: ship.category,
          }),
          acquisitionCost: ship.acquisitionCost,
          maintenanceCost: ship.maintenanceCost,
          technologyLevel: getTechLevelFromEra(ship.era),
          crewRequirement: ship.crew,
          imageUrl: "imageUrl" in ship ? (ship.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${ship.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED GROUND VEHICLES
  // ============================================================================
  console.log("\n🚜 Seeding Ground Vehicles...\n");

  // Combine base and extended vehicles
  const allVehicles = { ...MILITARY_VEHICLES, ...GROUND_VEHICLES };

  for (const [key, vehicle] of Object.entries(allVehicles)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      // Determine subcategory
      let subcategory = "tank";
      const categoryLower = vehicle.category.toLowerCase();
      if (categoryLower.includes("tank")) subcategory = "tank";
      else if (categoryLower.includes("ifv") || categoryLower.includes("fighting"))
        subcategory = "ifv";
      else if (categoryLower.includes("apc") || categoryLower.includes("personnel"))
        subcategory = "apc";
      else if (categoryLower.includes("artillery") || categoryLower.includes("howitzer"))
        subcategory = "artillery";
      else if (categoryLower.includes("rocket") || categoryLower.includes("mlrs"))
        subcategory = "mlrs";

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: vehicle.name,
          manufacturer: vehicle.manufacturer,
          category: "vehicle",
          subcategory,
          era: vehicle.era,
          specifications: safeStringify({
            crew: vehicle.crew,
            speed: vehicle.speed,
            range: vehicle.range,
            armament: "armament" in vehicle ? vehicle.armament : undefined,
            troops: "troops" in vehicle ? vehicle.troops : undefined,
            firingRange: "firingRange" in vehicle ? vehicle.firingRange : undefined,
          }),
          capabilities: safeStringify({
            category: vehicle.category,
          }),
          acquisitionCost: vehicle.acquisitionCost,
          maintenanceCost: vehicle.maintenanceCost,
          technologyLevel: getTechLevelFromEra(vehicle.era),
          crewRequirement: vehicle.crew,
          imageUrl: "imageUrl" in vehicle ? (vehicle.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${vehicle.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SEED WEAPON SYSTEMS
  // ============================================================================
  console.log("\n🚀 Seeding Weapon Systems...\n");

  // Combine base and extended weapon systems
  const allWeapons = { ...WEAPON_SYSTEMS, ...WEAPON_SYSTEMS_EXTENDED };

  for (const [key, weapon] of Object.entries(allWeapons)) {
    try {
      const existing = await prisma.militaryEquipmentCatalog.findFirst({
        where: { key },
      });

      if (existing) {
        equipmentSkipped++;
        continue;
      }

      // Determine subcategory
      let subcategory = "air_defense";
      const categoryLower = weapon.category.toLowerCase();
      if (categoryLower.includes("air defense") || categoryLower.includes("sam"))
        subcategory = "air_defense";
      else if (categoryLower.includes("missile")) subcategory = "missile";
      else if (categoryLower.includes("naval") || categoryLower.includes("ciws"))
        subcategory = "naval_weapon";
      else if (categoryLower.includes("torpedo")) subcategory = "torpedo";

      await prisma.militaryEquipmentCatalog.create({
        data: {
          key,
          name: weapon.name,
          manufacturer: weapon.manufacturer,
          category: "missile",
          subcategory,
          era: weapon.era,
          specifications: safeStringify({
            range: "range" in weapon ? weapon.range : undefined,
            altitude: "altitude" in weapon ? weapon.altitude : undefined,
            speed: "speed" in weapon ? weapon.speed : undefined,
          }),
          capabilities: safeStringify({
            category: weapon.category,
          }),
          acquisitionCost: weapon.acquisitionCost,
          maintenanceCost: "maintenanceCost" in weapon ? weapon.maintenanceCost : 0,
          technologyLevel: getTechLevelFromEra(weapon.era),
          crewRequirement: 0,
          imageUrl: "imageUrl" in weapon ? (weapon.imageUrl as string) : undefined,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${weapon.name}`);
      equipmentCreated++;
    } catch (error) {
      console.error(`❌ Error creating ${key}:`, error);
    }
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n=================================================================");
  console.log("📊 Seed Summary:");
  console.log("=================================================================");
  console.log(`🏭 Manufacturers:`);
  console.log(`   ✅ Created:       ${manufacturersCreated}`);
  console.log(`   ⏭️  Skipped:       ${manufacturersSkipped}`);
  console.log(`   📦 Total:         ${manufacturersCreated + manufacturersSkipped}`);
  console.log("");
  console.log(`⚔️  Equipment:`);
  console.log(`   ✅ Created:       ${equipmentCreated}`);
  console.log(`   ⏭️  Skipped:       ${equipmentSkipped}`);
  console.log(`   📦 Total:         ${equipmentCreated + equipmentSkipped}`);
  console.log("=================================================================\n");

  // Fetch and display category breakdown
  console.log("📂 Equipment by Category:\n");

  const categoryBreakdown = await prisma.militaryEquipmentCatalog.groupBy({
    by: ["category", "subcategory"],
    _count: true,
    orderBy: {
      category: "asc",
    },
  });

  let currentCategory = "";
  for (const item of categoryBreakdown) {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      console.log(`\n${currentCategory.toUpperCase()}:`);
    }
    console.log(`   ${item.subcategory || "general"}: ${item._count}`);
  }

  console.log("\n=================================================================\n");
}

// Execute only when run directly (not when imported by the master seed)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMilitaryEquipmentCatalog()
    .catch((e) => {
      console.error("\n❌ Fatal error during seed:");
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
