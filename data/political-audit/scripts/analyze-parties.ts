import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const parties = await prisma.politicalParty.findMany({
    include: {
      country: { select: { name: true } },
    },
    orderBy: { country: { name: "asc" } }
  });

  console.log(`Found ${parties.length} parties in PoliticalParty table:`);
  for (const p of parties) {
    console.log(`- [${p.country.name}] ${p.name} (${p.shortName || ""}) | Ideology: ${p.ideology} | Platform: ${p.platform || "N/A"} | BaseSupport: ${p.baseSupport}%`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
