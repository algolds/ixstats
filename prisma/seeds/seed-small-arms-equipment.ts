/**
 * Small Arms Equipment Database Seeding Script
 * Phase 9 Migration - October 2025
 *
 * This script migrates hardcoded small arms equipment data from
 * src/lib/small-arms-equipment.ts to the database.
 *
 * Total items: 238 weapons and equipment
 * Categories: 11 main types
 * Manufacturers: 34 unique manufacturers
 * Eras: 4 time periods
 */

import { PrismaClient } from "@prisma/client";
import {
  SMALL_ARMS_DATABASE,
  SMALL_ARMS_MANUFACTURERS,
  WEAPON_ERAS,
  type SmallArmsItem,
} from "../../src/lib/small-arms-equipment";

const prisma = new PrismaClient();

/**
 * Determines the equipment type based on the weapon category
 */
function determineEquipmentType(item: SmallArmsItem): string {
  const categoryMap: Record<string, string> = {
    // Pistols
    "Service Pistol": "pistols",
    "Compact Pistol": "pistols",
    "Magnum Pistol": "pistols",
    "Target Pistol": "pistols",
    "Military Pistol": "pistols",

    // Assault Rifles
    "Assault Rifle": "assault_rifles",
    Carbine: "assault_rifles",
    "Service Rifle": "assault_rifles",
    "Combat Rifle": "assault_rifles",
    "Infantry Rifle": "assault_rifles",

    // Battle Rifles
    "Battle Rifle": "battle_rifles",
    "Marksman Rifle": "battle_rifles",
    "Designated Marksman Rifle": "battle_rifles",

    // Sniper Rifles
    "Sniper Rifle": "sniper_rifles",
    "Anti-Material Rifle": "sniper_rifles",
    "Bolt-Action Sniper": "sniper_rifles",
    "Precision Rifle": "sniper_rifles",
    "Long Range Rifle": "sniper_rifles",

    // Submachine Guns
    "Submachine Gun": "submachine_guns",
    "Personal Defense Weapon": "submachine_guns",
    "Compact SMG": "submachine_guns",
    PDW: "submachine_guns",

    // Machine Guns
    "Light Machine Gun": "machine_guns",
    "General Purpose Machine Gun": "machine_guns",
    "Heavy Machine Gun": "machine_guns",
    "Squad Automatic Weapon": "machine_guns",
    "Medium Machine Gun": "machine_guns",

    // Grenade Launchers
    "Grenade Launcher": "grenade_launchers",
    "Automatic Grenade Launcher": "grenade_launchers",
    "Under-barrel Launcher": "grenade_launchers",

    // Shotguns
    "Combat Shotgun": "shotguns",
    "Tactical Shotgun": "shotguns",
    "Breaching Shotgun": "shotguns",
    "Semi-Auto Shotgun": "shotguns",
    "Pump-Action Shotgun": "shotguns",

    // Anti-Tank Weapons
    "Anti-Tank Missile": "anti_tank_weapons",
    "Rocket Launcher": "anti_tank_weapons",
    "Recoilless Rifle": "anti_tank_weapons",
    "Anti-Tank System": "anti_tank_weapons",

    // MANPADS
    "Man-Portable Air Defense": "manpads",
    "Surface-to-Air Missile": "manpads",

    // Tactical Equipment
    "Body Armor": "tactical_equipment",
    "Combat Helmet": "tactical_equipment",
    "Night Vision": "tactical_equipment",
    "Thermal Optics": "tactical_equipment",
    "Radio Equipment": "tactical_equipment",
    "Tactical Gear": "tactical_equipment",
    "Medical Equipment": "tactical_equipment",
    "Survival Equipment": "tactical_equipment",
    "Breaching Equipment": "tactical_equipment",
    "EOD Equipment": "tactical_equipment",
    "Surveillance Equipment": "tactical_equipment",
    "Combat Optics": "tactical_equipment",
    "Laser Designator": "tactical_equipment",
    "Range Finder": "tactical_equipment",
  };

  return categoryMap[item.category] || "tactical_equipment";
}

/**
 * Seeds the small arms equipment database
 */
async function seedSmallArmsEquipment() {
  console.log("🔫 Starting Small Arms Equipment Database Seeding...\n");

  try {
    // Step 1: Clear existing data (if any)
    console.log("📋 Clearing existing data...");
    await prisma.smallArmsEquipment.deleteMany();
    await prisma.weaponEra.deleteMany();
    await prisma.smallArmsManufacturer.deleteMany();
    console.log("✅ Existing data cleared\n");

    // Step 2: Seed Manufacturers
    console.log("🏭 Seeding manufacturers...");
    const manufacturerData = Object.entries(SMALL_ARMS_MANUFACTURERS).map(
      ([key, manufacturer]) => ({
        key,
        name: manufacturer.name,
        country: manufacturer.country,
        specialty: JSON.stringify(manufacturer.specialty),
        isActive: true,
      })
    );

    await prisma.smallArmsManufacturer.createMany({
      data: manufacturerData,
      skipDuplicates: true,
    });
    console.log(`✅ Seeded ${manufacturerData.length} manufacturers\n`);

    // Step 3: Seed Weapon Eras
    console.log("📅 Seeding weapon eras...");
    const eraData = Object.entries(WEAPON_ERAS).map(([key, era]) => ({
      key,
      label: era.label,
      years: era.years,
      reliability: era.reliability,
      isActive: true,
    }));

    await prisma.weaponEra.createMany({
      data: eraData,
      skipDuplicates: true,
    });
    console.log(`✅ Seeded ${eraData.length} weapon eras\n`);

    // Step 4: Seed Equipment Items
    console.log("🔫 Seeding equipment items...");
    const equipmentCategories = {
      pistols: [] as SmallArmsItem[],
      assault_rifles: [] as SmallArmsItem[],
      battle_rifles: [] as SmallArmsItem[],
      sniper_rifles: [] as SmallArmsItem[],
      submachine_guns: [] as SmallArmsItem[],
      machine_guns: [] as SmallArmsItem[],
      grenade_launchers: [] as SmallArmsItem[],
      shotguns: [] as SmallArmsItem[],
      tactical_equipment: [] as SmallArmsItem[],
      anti_tank_weapons: [] as SmallArmsItem[],
      manpads: [] as SmallArmsItem[],
    };

    // Categorize all items
    Object.entries(SMALL_ARMS_DATABASE).forEach(([category, categoryItems]) => {
      // categoryItems is an object with weapon keys, not an array
      if (typeof categoryItems === "object" && categoryItems !== null) {
        Object.values(categoryItems).forEach((item) => {
          // Type assertion since we know the structure
          const weaponItem = item as SmallArmsItem;
          const equipmentType = determineEquipmentType(weaponItem);
          if (equipmentCategories[equipmentType as keyof typeof equipmentCategories]) {
            equipmentCategories[equipmentType as keyof typeof equipmentCategories].push(weaponItem);
          }
        });
      }
    });

    // Process each category
    let totalSeeded = 0;
    for (const [equipmentType, items] of Object.entries(equipmentCategories)) {
      if (items.length === 0) continue;

      console.log(`  📦 Processing ${equipmentType}: ${items.length} items`);

      const equipmentData = items.map((item) => ({
        // Generate a unique key based on name
        key: item.name
          .toUpperCase()
          .replace(/[\s\-\.\/]/g, "_")
          .replace(/[^A-Z0-9_]/g, ""),
        name: item.name,
        manufacturerKey: item.manufacturer,
        category: item.category,
        equipmentType,
        eraKey: item.era,
        weight: item.weight,
        unitCost: item.unitCost,
        maintenanceCost: item.maintenanceCost,
        imageUrl: item.imageUrl || null,
        // Weapon-specific fields
        caliber: "caliber" in item ? (item.caliber as string) : null,
        capacity: "capacity" in item ? Number(item.capacity) : null,
        effectiveRange: "effectiveRange" in item ? Number(item.effectiveRange) : null,
        fireRate: "fireRate" in item ? Number(item.fireRate) : null,
        // Tactical equipment fields
        protectionLevel: "protectionLevel" in item ? (item.protectionLevel as string) : null,
        // Missile/Anti-tank fields - ensure numbers
        range: "range" in item && item.range !== undefined ? Number(item.range) : null,
        altitude: "altitude" in item && item.altitude !== undefined ? Number(item.altitude) : null,
        // Metadata
        description: null,
        isActive: true,
        usageCount: 0,
      }));

      // Process items one by one to catch foreign key errors
      for (const itemData of equipmentData) {
        try {
          await prisma.smallArmsEquipment.create({
            data: itemData,
          });
          totalSeeded++;
        } catch (error: any) {
          if (error.code === "P2003") {
            console.log(
              `    ⚠️  Skipping ${itemData.name} - manufacturer "${itemData.manufacturerKey}" not found`
            );
          } else if (error.code === "P2002") {
            // Duplicate key, skip silently (already seeded)
          } else {
            console.log(`    ❌ Error seeding ${itemData.name}:`, error.message);
          }
        }
      }
    }

    console.log(`\n✅ Successfully seeded ${totalSeeded} equipment items!\n`);

    // Step 5: Verify the seeding
    console.log("📊 Verifying database contents...");
    const manufacturerCount = await prisma.smallArmsManufacturer.count();
    const eraCount = await prisma.weaponEra.count();
    const equipmentCount = await prisma.smallArmsEquipment.count();

    console.log(`  🏭 Manufacturers: ${manufacturerCount}`);
    console.log(`  📅 Weapon Eras: ${eraCount}`);
    console.log(`  🔫 Equipment Items: ${equipmentCount}`);

    // Show category breakdown
    console.log("\n📈 Equipment breakdown by type:");
    const typeGroups = await prisma.smallArmsEquipment.groupBy({
      by: ["equipmentType"],
      _count: true,
    });

    typeGroups.forEach((group) => {
      console.log(`  • ${group.equipmentType}: ${group._count} items`);
    });

    console.log("\n🎉 Small Arms Equipment database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the seeding
seedSmallArmsEquipment().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
