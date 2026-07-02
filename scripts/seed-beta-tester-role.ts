// scripts/seed-beta-tester-role.ts
// One-off: create a "beta_tester" role carrying the `labs.access` permission on
// an already-initialized DB (initializeRoleSystem is create-only, won't re-run).
// Idempotent. After this, assign the role to users in the admin User Management page.
//   bun scripts/seed-beta-tester-role.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const perm = await db.permission.upsert({
  where: { name: "labs.access" },
  update: { displayName: "Access Labs", category: "labs" },
  create: { name: "labs.access", displayName: "Access Labs", category: "labs", isSystem: true },
});

const role = await db.role.upsert({
  where: { name: "beta_tester" },
  update: { displayName: "Beta Tester", description: "Early access to Labs features" },
  // level 90: above USER (100), below MODERATOR (30) — gating is permission-based, not level.
  create: {
    name: "beta_tester",
    displayName: "Beta Tester",
    description: "Early access to Labs features",
    level: 90,
    isSystem: true,
  },
});

await db.rolePermission.upsert({
  where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
  update: {},
  create: { roleId: role.id, permissionId: perm.id },
});

console.log(`beta_tester role ready (${role.id}) with labs.access`);
await db.$disconnect();
