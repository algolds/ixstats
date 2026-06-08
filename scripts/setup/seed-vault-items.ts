#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedVaultStoreItems() {
  console.log("💎 Seeding Vault Store Items...");
  try {
    const item = await prisma.vaultStoreItem.upsert({
      where: { id: "upgrade_archetype_proposal" },
      update: {
        name: "Archetype Proposal Token",
        description:
          "Submit a custom Archetype proposal to the platform administrators for review and addition to the global catalog.",
        price: 3500,
        quality: "EPIC",
        icon: "Ticket",
        category: "upgrades",
        isActive: true,
      },
      create: {
        id: "upgrade_archetype_proposal",
        name: "Archetype Proposal Token",
        description:
          "Submit a custom Archetype proposal to the platform administrators for review and addition to the global catalog.",
        price: 3500,
        quality: "EPIC",
        icon: "Ticket",
        category: "upgrades",
        isActive: true,
      },
    });
    console.log(`✅ Seeded Vault Store Item: ${item.name} (${item.id})`);
  } catch (error) {
    console.error("❌ Error seeding Vault Store Items:", error);
    throw error;
  }
}

// Run directly if called
if (import.meta.url === `file://${process.argv[1]}`) {
  seedVaultStoreItems()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
