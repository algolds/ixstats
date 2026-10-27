import type { PrismaClient } from "@prisma/client";

/** Flip one cosmetic in a vault's comma-separated equipped list and persist it. */
export async function toggleEquippedCosmetic(
  db: PrismaClient,
  vault: { id: string; equippedCosmetics: string | null },
  itemId: string
) {
  const equipped = vault.equippedCosmetics
    ? vault.equippedCosmetics.split(",").filter(Boolean)
    : [];

  const index = equipped.indexOf(itemId);
  const isEquipped = index === -1;
  if (isEquipped) {
    equipped.push(itemId);
  } else {
    equipped.splice(index, 1);
  }

  await db.myVault.update({
    where: { id: vault.id },
    data: { equippedCosmetics: equipped.join(",") },
  });

  return { success: true, isEquipped, equipped };
}
