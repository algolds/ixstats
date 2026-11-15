import { seedOnomaPresets } from "../prisma/seeds/onoma-presets";
import { createPrismaClient } from "~/server/prisma-client";

const db = createPrismaClient();

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
