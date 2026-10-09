import type { PrismaClient } from "@prisma/client";
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";

export type SeedDb = Pick<PrismaClient, "forumCategory">;

/** Give a realm its three forum categories. Idempotent through the (scope, realmId, key) unique index. */
export async function seedRealmCategories(db: SeedDb, realmId: string): Promise<{ created: number }> {
  const { count } = await db.forumCategory.createMany({
    data: REALM_CATEGORIES.map((c) => ({
      scope: "realm",
      realmId,
      key: c.key,
      name: c.name,
      description: c.description,
      order: c.order,
      visibility: "public",
      postRole: "any",
      icAllowed: c.icAllowed,
    })),
    skipDuplicates: true,
  });
  return { created: count };
}
