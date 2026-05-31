import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.vaultStoreItem.findMany();
  console.log("Vault Store Items:", JSON.stringify(items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
