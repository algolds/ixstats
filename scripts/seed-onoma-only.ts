import { PrismaClient } from "@prisma/client";
import { seedOnomaPresets } from "../prisma/seeds/onoma-presets";

const db = new PrismaClient();

async function run() {
  try {
    await seedOnomaPresets(db);
    console.log("Onoma seeding finished successfully!");
  } catch (err) {
    console.error("Onoma seeding failed:", err);
  } finally {
    await db.$disconnect();
  }
}

run();
