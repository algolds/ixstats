/**
 * Crafting Recipes Seed Data
 * Sample recipes for card fusion and evolution
 * Phase 3: Crafting System
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Sample crafting recipes for IxCards
 */
const craftingRecipes = [
  // FUSION RECIPES
  {
    name: "Common Fusion",
    description: "Fuse two common cards to create an uncommon card",
    recipeType: "FUSION",
    resultRarity: "UNCOMMON",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "COMMON", quantity: 2 },
    ],
    ixCreditsCost: 250,
    successRate: 95,
    collectorXP: 25,
    unlockRequirement: {},
    isActive: true,
  },
  {
    name: "Uncommon Fusion",
    description: "Fuse two uncommon cards to create a rare card",
    recipeType: "FUSION",
    resultRarity: "RARE",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "UNCOMMON", quantity: 2 },
    ],
    ixCreditsCost: 500,
    successRate: 85,
    collectorXP: 50,
    unlockRequirement: { minLevel: 2 },
    isActive: true,
  },
  {
    name: "Rare Fusion",
    description: "Fuse three rare cards to create an ultra-rare card",
    recipeType: "FUSION",
    resultRarity: "ULTRA_RARE",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "RARE", quantity: 3 },
    ],
    ixCreditsCost: 1000,
    successRate: 70,
    collectorXP: 100,
    unlockRequirement: { minLevel: 5 },
    isActive: true,
  },
  {
    name: "Epic Fusion",
    description: "Fuse two ultra-rare cards and one epic card to create a legendary card",
    recipeType: "FUSION",
    resultRarity: "LEGENDARY",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "ULTRA_RARE", quantity: 2 },
      { rarity: "EPIC", quantity: 1 },
    ],
    ixCreditsCost: 5000,
    successRate: 30,
    collectorXP: 500,
    unlockRequirement: { minLevel: 10 },
    isActive: true,
  },
  {
    name: "Mythic Fusion",
    description: "The ultimate fusion - combine legendary cards to create a mythic card",
    recipeType: "FUSION",
    resultRarity: "MYTHIC",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "LEGENDARY", quantity: 3 },
    ],
    ixCreditsCost: 10000,
    successRate: 15,
    collectorXP: 1000,
    unlockRequirement: { minLevel: 20 },
    isActive: true,
  },

  // EVOLUTION RECIPES
  {
    name: "Common Evolution",
    description: "Evolve a common card to uncommon rarity",
    recipeType: "EVOLUTION",
    resultRarity: "UNCOMMON",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "COMMON", quantity: 1 },
    ],
    ixCreditsCost: 200,
    successRate: 100,
    collectorXP: 20,
    unlockRequirement: {},
    isActive: true,
  },
  {
    name: "Uncommon Evolution",
    description: "Evolve an uncommon card to rare rarity",
    recipeType: "EVOLUTION",
    resultRarity: "RARE",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "UNCOMMON", quantity: 1 },
    ],
    ixCreditsCost: 400,
    successRate: 95,
    collectorXP: 40,
    unlockRequirement: { minLevel: 2 },
    isActive: true,
  },
  {
    name: "Rare Evolution",
    description: "Evolve a rare card to ultra-rare rarity",
    recipeType: "EVOLUTION",
    resultRarity: "ULTRA_RARE",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "RARE", quantity: 1 },
    ],
    ixCreditsCost: 800,
    successRate: 85,
    collectorXP: 80,
    unlockRequirement: { minLevel: 5 },
    isActive: true,
  },
  {
    name: "Ultra-Rare Evolution",
    description: "Evolve an ultra-rare card to epic rarity",
    recipeType: "EVOLUTION",
    resultRarity: "EPIC",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "ULTRA_RARE", quantity: 1 },
    ],
    ixCreditsCost: 2000,
    successRate: 70,
    collectorXP: 200,
    unlockRequirement: { minLevel: 8 },
    isActive: true,
  },
  {
    name: "Epic Evolution",
    description: "Evolve an epic card to legendary rarity",
    recipeType: "EVOLUTION",
    resultRarity: "LEGENDARY",
    resultType: "NATION",
    materialsRequired: [
      { rarity: "EPIC", quantity: 1 },
    ],
    ixCreditsCost: 4000,
    successRate: 50,
    collectorXP: 400,
    unlockRequirement: { minLevel: 12 },
    isActive: true,
  },

  // SPECIAL RECIPES
  {
    name: "Lore Card Fusion",
    description: "Combine three nation cards with matching region to create a lore card",
    recipeType: "FUSION",
    resultRarity: "RARE",
    resultType: "LORE",
    materialsRequired: [
      { type: "NATION", rarity: "UNCOMMON", quantity: 3 },
    ],
    ixCreditsCost: 750,
    successRate: 80,
    collectorXP: 75,
    unlockRequirement: { minLevel: 6 },
    isActive: true,
  },
  {
    name: "Event Card Fusion",
    description: "Fuse cards from the same season to create a special event card",
    recipeType: "FUSION",
    resultRarity: "EPIC",
    resultType: "EVENT",
    materialsRequired: [
      { rarity: "RARE", quantity: 2 },
    ],
    ixCreditsCost: 1500,
    successRate: 60,
    collectorXP: 150,
    unlockRequirement: { minLevel: 7 },
    isActive: true,
  },
];

/**
 * Seed crafting recipes
 */
async function seedCraftingRecipes() {
  console.log("🔮 Seeding crafting recipes...");

  for (const recipe of craftingRecipes) {
    await prisma.craftingRecipe.upsert({
      where: {
        // Use unique constraint on name if available, otherwise create
        name: recipe.name,
      },
      update: recipe,
      create: recipe,
    });
  }

  console.log(`✓ Seeded ${craftingRecipes.length} crafting recipes`);
}

/**
 * Main seed function
 */
async function main() {
  try {
    await seedCraftingRecipes();
    console.log("✓ Crafting recipes seeding completed");
  } catch (error) {
    console.error("Error seeding crafting recipes:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { main as seedCraftingRecipes };
