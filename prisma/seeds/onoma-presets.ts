import { PrismaClient } from "@prisma/client";
import { DEFAULT_DICTIONARIES } from "../../src/lib/onoma/data/default-dictionaries";

export async function seedOnomaPresets(db: PrismaClient) {
  console.log("🌱 Seeding Onoma default dictionaries...");

  // 1. Get or create a system user to own the default public dictionaries
  const systemClerkId = "user_system_onoma_presets";

  // Get owner role if exists
  let ownerRole = await db.role.findFirst({
    where: { name: "owner" },
  });
  if (!ownerRole) {
    ownerRole = await db.role.findFirst();
  }

  const systemUser = await db.user.upsert({
    where: { clerkUserId: systemClerkId },
    update: {},
    create: {
      clerkUserId: systemClerkId,
      roleId: ownerRole?.id || null,
      isActive: true,
    },
  });

  const categoryMap: Record<string, string> = {
    demons: "person",
    angels: "person",
    egyptdeities: "person",
    planets: "geography",
    greekcities: "city",
    states: "country",
    emperors: "person",
    norseDeities: "person",
    celticMythology: "geography",
    angloSaxonPlaces: "city",
    classicFantasyNames: "person",
    nordicIcelandicNames: "person",
    dwarfNames: "person",
    elvenNames: "person",
    halflingNames: "person",
    humanNames: "person",
    eldritchNames: "person",
    scifiPlanets: "geography",
    japaneseNames: "person",
  };

  // 2. Seed dictionaries
  let count = 0;
  for (const dict of DEFAULT_DICTIONARIES) {
    const category = categoryMap[dict.id] || "person";

    const existing = await db.nameBank.findFirst({
      where: {
        title: dict.title,
        type: "dictionary",
        isPublic: true,
      },
    });

    if (existing) {
      await db.nameBank.update({
        where: { id: existing.id },
        data: {
          category,
          values: dict.values,
        },
      });
    } else {
      await db.nameBank.create({
        data: {
          userId: systemUser.id,
          type: "dictionary",
          title: dict.title,
          values: dict.values,
          category,
          isPublic: true,
        },
      });
      count++;
    }
  }

  console.log(`   ✅ Seeded ${count} default public dictionaries!`);
}
