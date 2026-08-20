// scripts/seed-labs-permission.ts
// One-off: add the `labs.access` permission to an already-initialized DB (the
// canonical initializeRoleSystem uses create-only and won't re-run). Idempotent.
// After this, grant it in the roles admin: create/edit a role to include
// "Access Labs" and assign it to the users you want.
//   bun scripts/seed-labs-permission.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const perm = await db.permission.upsert({
  where: { name: "labs.access" },
  update: { displayName: "Access Labs", category: "labs" },
  create: { name: "labs.access", displayName: "Access Labs", category: "labs", isSystem: true },
});

// Make sure the System Owner role carries it (owners get everything).
const owner = await db.role.findUnique({ where: { name: "owner" } });
if (owner) {
  await db.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: owner.id, permissionId: perm.id } },
    update: {},
    create: { roleId: owner.id, permissionId: perm.id },
  });
}

console.log(`labs.access ready (${perm.id})${owner ? " + granted to owner role" : ""}`);
await db.$disconnect();
