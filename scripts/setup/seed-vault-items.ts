#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedVaultStoreItems() {
  console.log("💎 Seeding Vault Store Items...");
  try {
    // Clean up deprecated Golden Ticket and Imperial Gold Glow
    await prisma.vaultStoreItem.deleteMany({
      where: {
        id: {
          in: ["upgrade_myleague_golden_ticket", "cosmetic_imperial_glow"],
        },
      },
    });

    const items = [
      {
        id: "upgrade_archetype_proposal",
        name: "Archetype Proposal Token",
        description:
          "Submit a custom Archetype proposal to the platform administrators for review and addition to the global catalog.",
        price: 3500,
        quality: "EPIC",
        icon: "Ticket",
        category: "upgrades",
        isActive: true,
        badgeText: "Proposal",
        effects: null,
      },
      {
        id: "upgrade_myclub_license",
        name: "MyClub Team License Token",
        description:
          "Acquire a direct professional ownership license to claim and manage any vacant club team.",
        price: 5000,
        quality: "LEGENDARY",
        icon: "Trophy",
        category: "upgrades",
        isActive: true,
        badgeText: "MyClub",
        effects: null,
      },
      {
        id: "upgrade_myleague_franchise",
        name: "MyLeague Franchise Pass",
        description:
          "Grants official registration approval to claim and manage a team in canonical sports leagues.",
        price: 2500,
        quality: "EPIC",
        icon: "Ticket",
        category: "upgrades",
        isActive: true,
        badgeText: "MyLeague",
        effects: null,
      },
      {
        id: "upgrade_card_capacity",
        name: "Card Capacity Boost",
        description:
          "Increase your maximum vault card inventory capacity by +50 slots. Can stack up to 5 times.",
        price: 2000,
        quality: "RARE",
        icon: "PlusCircle",
        category: "upgrades",
        isActive: true,
        badgeText: "Capacity",
        effects: { perks: { cardCapacity: 50 } },
      },
      {
        id: "upgrade_card_capacity_mega",
        name: "Mega Card Capacity Boost",
        description:
          "Unlocks after purchasing 5 standard boosts. Grants a massive permanent boost of +150 vault card inventory slots.",
        price: 6000,
        quality: "LEGENDARY",
        icon: "Sparkles",
        category: "upgrades",
        isActive: true,
        badgeText: "Capacity",
        effects: { perks: { cardCapacity: 150 } },
      },
      {
        id: "cosmetic_emerald_glow",
        name: "Emerald Profile Glow",
        description: "Surround your avatar with a vibrant glowing emerald energy aura.",
        price: 4500,
        quality: "RARE",
        icon: "Sparkles",
        category: "cosmetics",
        isActive: true,
        badgeText: "Glow",
        glowColor: "#10b981",
        effects: {
          customizations: {
            avatarGlow: {
              enabled: true,
              color: "rgba(16,185,129,0.65)",
              intensity: "15px",
              style: "emerald",
            },
          },
        },
      },
      {
        id: "cosmetic_ruby_frame",
        name: "Ruby Cyber Frame",
        description: "Equip a crimson-laser pulsing neon border around your card grids.",
        price: 5500,
        quality: "EPIC",
        icon: "Shield",
        category: "cosmetics",
        isActive: true,
        badgeText: "Frame",
        glowColor: "#ef4444",
        effects: {
          customizations: {
            neonFrame: {
              enabled: true,
              color: "#ef4444",
              style: "ruby",
            },
          },
        },
      },
      {
        id: "cosmetic_diamond_badge",
        name: "Diamond Shield Badge",
        description: "Showcase a shining cyan diamond shield badge next to your user name.",
        price: 6500,
        quality: "LEGENDARY",
        icon: "Award",
        category: "cosmetics",
        isActive: true,
        badgeText: "Badge",
        glowColor: "#06b6d4",
        effects: {
          customizations: {
            chatBadge: {
              enabled: true,
              icon: "Shield",
              color: "#06b6d4",
            },
          },
        },
      },
      {
        id: "cosmetic_summer_glow",
        name: "Summer Heat Glow",
        description: "Radiate warm orange solar rays surrounding your profile and avatar.",
        price: 4200,
        quality: "RARE",
        icon: "Sun",
        category: "cosmetics",
        isActive: true,
        badgeText: "Glow",
        glowColor: "#f97316",
        effects: {
          customizations: {
            avatarGlow: {
              enabled: true,
              color: "rgba(249,115,22,0.65)",
              intensity: "15px",
              style: "summer",
            },
          },
        },
      },
      {
        id: "cosmetic_winter_frame",
        name: "Winter Frost Frame",
        description: "Chill your card borders with a frost-pulsing ice blue cybernetic frame.",
        price: 5800,
        quality: "EPIC",
        icon: "Snowflake",
        category: "cosmetics",
        isActive: true,
        badgeText: "Frame",
        glowColor: "#38bdf8",
        effects: {
          customizations: {
            neonFrame: {
              enabled: true,
              color: "#38bdf8",
              style: "winter",
            },
          },
        },
      },
      {
        id: "cosmetic_autumn_badge",
        name: "Autumn Leaves Badge",
        description: "Mark your presence with a warm amber maple leaf badge icon in user catalogs.",
        price: 4800,
        quality: "RARE",
        icon: "Leaf",
        category: "cosmetics",
        isActive: true,
        badgeText: "Badge",
        glowColor: "#d97706",
        effects: {
          customizations: {
            chatBadge: {
              enabled: true,
              icon: "Leaf",
              color: "#d97706",
            },
          },
        },
      },
      {
        id: "cosmetic_diplomatic_badge",
        name: "Diplomatic Shield Badge",
        description: "Display a formal diplomat shield emblem alongside your chat nickname.",
        price: 5000,
        quality: "EPIC",
        icon: "Heart",
        category: "cosmetics",
        isActive: true,
        badgeText: "Badge",
        glowColor: "#10b981",
        effects: {
          customizations: {
            chatBadge: {
              enabled: true,
              icon: "Heart",
              color: "#10b981",
            },
          },
        },
      },
    ];

    for (const item of items) {
      await prisma.vaultStoreItem.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description,
          price: item.price,
          quality: item.quality,
          icon: item.icon,
          category: item.category,
          isActive: item.isActive,
          badgeText: item.badgeText,
          glowColor: item.glowColor ?? null,
          effects: item.effects ?? undefined,
        },
        create: item,
      });
      console.log(`✅ Seeded Vault Store Item: ${item.name} (${item.id})`);
    }
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
