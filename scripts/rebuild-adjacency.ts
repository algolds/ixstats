// One-off script to rebuild the province adjacency graph via the geoEditor tRPC router.
//
// Usage (production):
//   DATABASE_URL="postgresql://..." bun scripts/rebuild-adjacency.ts
//
// Optional:
//   WORLD_ID=default bun scripts/rebuild-adjacency.ts

import { createCallerFactory } from "../src/server/api/trpc";
import { geoEditorRouter } from "../src/server/api/routers/geo/editor";
import { db } from "../src/server/db";

async function main() {
  const worldId = process.env.WORLD_ID || "default";

  console.log(`[rebuild-adjacency] Looking up an admin user...`);
  const adminUser = await db.user.findFirst({
    where: {
      OR: [
        { role: { name: { in: ["owner", "admin", "staff"] } } },
        { role: { level: { lte: 20 } } },
      ],
    },
    include: {
      country: true,
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!adminUser) {
    throw new Error(
      "No admin user found in the database. Assign an owner/admin/staff role first."
    );
  }

  console.log(
    `[rebuild-adjacency] Using admin user ${adminUser.clerkUserId} (role: ${adminUser.role?.name})`
  );

  const createCaller = createCallerFactory(geoEditorRouter);
  const caller = createCaller({
    db,
    auth: { userId: adminUser.clerkUserId },
    user: adminUser as any,
    headers: new Headers(),
    rateLimitIdentifier: "script-rebuild-adjacency",
  } as any);

  console.log(`[rebuild-adjacency] Calling geoEditor.rebuildAdjacency({ worldId: "${worldId}" })...`);
  const result = await caller.rebuildAdjacency({ worldId });
  console.log("[rebuild-adjacency] Done:", result);
}

main()
  .catch((err) => {
    console.error("[rebuild-adjacency] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
