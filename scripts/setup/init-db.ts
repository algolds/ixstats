#!/usr/bin/env tsx

/**
 * Database initialization script for IxStats
 * Sets up the database schema and initial data
 */

import { PrismaClient } from "@prisma/client";
import { seedCardPacks } from "../../prisma/seeds/card-packs";

const db = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log("🚀 Initializing IxStats database...");

    // Check if we're in production
    if (process.env.NODE_ENV === "production") {
      console.log("⚠️  Production environment detected - skipping preview data seeding");
      console.log("✅ Database initialization complete (production mode)");
      return;
    }

    // Check if database has any data
    const countryCount = await db.country.count();
    const userCount = await db.user.count();

    if (countryCount > 0 || userCount > 0) {
      console.log(
        `📊 Database already contains data: ${countryCount} countries, ${userCount} users`
      );
      console.log("✅ Database initialization complete (data exists)");
      return;
    }

    // Seed card packs for development
    console.log("🌱 Seeding card packs for development...");
    await seedCardPacks();

    console.log("✅ Database initialization complete!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}
