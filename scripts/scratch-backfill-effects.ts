import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const itemEffects = {
  cosmetic_gold_glow: {
    customizations: {
      avatarGlow: {
        enabled: true,
        color: "rgba(245,158,11,0.65)",
        intensity: "15px",
      },
    },
  },
  cosmetic_neon_frame: {
    customizations: {
      neonFrame: {
        enabled: true,
        color: "#22d3ee",
        style: "pulse",
      },
    },
  },
  cosmetic_chat_badge: {
    customizations: {
      chatBadge: {
        enabled: true,
        icon: "Crown",
        color: "#f59e0b",
      },
    },
  },
  upgrade_lore_token: {
    perks: {
      loreTokens: 1,
    },
  },
  upgrade_card_capacity: {
    perks: {
      cardCapacity: 50,
    },
  },
  upgrade_yield_boost: {
    perks: {
      yieldBoost: 0.05,
    },
  },
};

async function main() {
  console.log("Starting store items effects backfill...");

  for (const [id, effects] of Object.entries(itemEffects)) {
    const item = await prisma.vaultStoreItem.findUnique({ where: { id } });
    if (item) {
      await prisma.vaultStoreItem.update({
        where: { id },
        data: { effects: effects as any },
      });
      console.log(`Updated effects for store item: ${id}`);
    } else {
      console.log(`Store item not found, skipping: ${id}`);
    }
  }

  console.log("Store items backfill completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
