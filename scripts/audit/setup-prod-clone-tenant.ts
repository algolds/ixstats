#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const testRunId = process.env.TEST_RUN_ID || `${Date.now()}`;
  const tenantPrefix = process.env.TEST_TENANT_PREFIX || "__e2e__";

  console.log(`Setting up prod-clone sandbox tenant: prefix=${tenantPrefix}, run=${testRunId}`);

  // Optionally seed a dedicated e2e user role if missing
  try {
    const role = await prisma.role.upsert({
      where: { name: "e2e" },
      update: {},
      create: { name: "e2e", level: 90 },
    });
    console.log(`Ensured role exists: ${role.name}`);
  } catch (err) {
    console.warn("Role setup warning:", (err as Error).message);
  }

  // No-op: actual data creation is per-test; keep this script idempotent
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
