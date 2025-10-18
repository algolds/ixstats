#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantPrefix = process.env.TEST_TENANT_PREFIX || '__e2e__';

  console.log(`Tearing down prod-clone sandbox tenant data with prefix: ${tenantPrefix}`);

  // Best-effort cleanup by slug/name prefix where applicable
  try {
    await prisma.thinkpagesPost.deleteMany({ where: { content: { startsWith: tenantPrefix } } });
  } catch {}
  try {
    await prisma.activityFeed.deleteMany({ where: { title: { startsWith: tenantPrefix } } });
  } catch {}
  try {
    await prisma.embassy.deleteMany({ where: { name: { startsWith: tenantPrefix } } });
  } catch {}
  try {
    await prisma.country.deleteMany({ where: { slug: { startsWith: tenantPrefix } } });
  } catch {}

  console.log('Teardown complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });


