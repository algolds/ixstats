import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const countries = await prisma.country.findMany({
    select: { name: true, id: true }
  });
  console.log("Countries in DB:", countries);
}
main().finally(() => prisma.$disconnect());
