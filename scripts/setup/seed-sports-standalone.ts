#!/usr/bin/env tsx

/**
 * Standalone seeding script for MyLeague sports leagues
 */

import { PrismaClient } from "@prisma/client";
import { seedSportsLeagues } from "../../src/lib/demo-seed/seed-sports";

const db = new PrismaClient();

async function run() {
  try {
    console.log("🧹 Cleaning existing canonical sports leagues...");
    await db.sportLeague.deleteMany({
      where: { isCanonical: true },
    });

    const firstCountry = await db.country.findFirst({ select: { id: true } });
    const firstUser = await db.user.findFirst({ select: { id: true } });

    if (!firstCountry || !firstUser) {
      console.error(
        "❌ Could not seed sports: No country or user found in the database. Please seed the main DB first."
      );
      process.exit(1);
    }

    console.log("🌱 Seeding sports leagues...");
    const count = await seedSportsLeagues(db, firstCountry.id, firstUser.id);
    console.log(`✅ Sports seeding complete! Created ${count} records.`);
  } catch (error) {
    console.error("❌ Standalone sports seeding failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

run();
