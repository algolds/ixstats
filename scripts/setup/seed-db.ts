#!/usr/bin/env bun

/**
 * Database seeding script for IxStats
 * Populates the database with preview data for development
 */

import { PrismaClient } from "@prisma/client";
import { seedCardPacks } from "../../prisma/seeds/card-packs";
import { seedSmallArmsEquipment } from "../../prisma/seeds/seed-small-arms-equipment";
import { seedMilitaryEquipmentCatalog } from "../../prisma/seeds/military-equipment-catalog";
import { seedOnomaPresets } from "../../prisma/seeds/onoma-presets";

const db = new PrismaClient();

async function seedDatabase() {
  try {
    console.log("🌱 Seeding IxStats database...");

    // Check if we're in production
    if (process.env.NODE_ENV === "production") {
      console.error("❌ Database seeding is disabled in production environment");
      process.exit(1);
    }

    // Get user confirmation for clearing existing data
    const countryCount = await db.country.count();
    const userCount = await db.user.count();

    if (countryCount > 0 || userCount > 0) {
      console.log(`📊 Database currently contains: ${countryCount} countries, ${userCount} users`);
      console.log("⚠️  This will clear existing data and reseed the database");

      // Check for --force flag
      const hasForceFlag = process.argv.includes("--force");

      // In non-interactive mode, skip confirmation
      if (process.env.CI || process.env.NODE_ENV === "test" || hasForceFlag) {
        if (hasForceFlag) {
          console.log("🚀 Force flag detected - proceeding with reseed");
        } else {
          console.log("🤖 CI/Test environment detected - proceeding with reseed");
        }
      } else {
        console.log("💡 Use --force flag to skip confirmation: bun run db:seed -- --force");
        process.exit(0);
      }
    }

    // Seed card packs
    await seedCardPacks();

    // Seed reference catalogs (idempotent — each clears + repopulates its own tables)
    console.log("🔫 Seeding small arms equipment catalog...");
    await seedSmallArmsEquipment();
    console.log("🪖 Seeding military equipment catalog...");
    await seedMilitaryEquipmentCatalog();
    console.log("📚 Seeding Onoma default dictionary presets...");
    await seedOnomaPresets(db);

    // Seed canonical sports leagues
    const firstCountry = await db.country.findFirst({ select: { id: true } });
    const firstUser = await db.user.findFirst({ select: { id: true } });
    if (firstCountry && firstUser) {
      console.log("⚽ Seeding canonical sports leagues...");
      const { seedSportsLeagues } = await import("../../src/lib/demo-seed/seed-sports");
      const sportsCount = await seedSportsLeagues(db, firstCountry.id, firstUser.id);
      console.log(`🏆 Seeded ${sportsCount} sports records!`);
    } else {
      console.warn("⚠️ Could not seed sports: no country or user found.");
    }

    console.log("✅ Database seeding complete!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
