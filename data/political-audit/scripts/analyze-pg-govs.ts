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
  const countries = await prisma.country.findMany({
    select: {
      name: true,
      governmentType: true,
      governmentStructure: {
        select: {
          governmentName: true,
          governmentType: true,
          headOfState: true,
          headOfGovernment: true,
          branches: { select: { name: true, branchType: true } }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  console.log(`Found ${countries.length} countries in PostgreSQL.`);
  const typeCounts: Record<string, number> = {};
  for (const c of countries) {
    const t = c.governmentType || "Unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  console.log("\n=== GOVERNMENT TYPES IN POSTGRESQL ===");
  console.table(typeCounts);

  console.log("\n=== NOTABLE COUNTRY GOVERNMENTS ===");
  for (const c of countries) {
    if (["Urcea", "Caphiria", "Cartadania", "Yonderre", "Burgundie", "Kiravia", "Faneria", "Daxia", "Pelaxia", "Thervala", "Castadilla", "Nasastan", "Fiannria", "Carna", "Arcerion"].includes(c.name)) {
      console.log(`- ${c.name.padEnd(15)}: ${c.governmentType} | Struct: ${c.governmentStructure?.governmentName} (${c.governmentStructure?.governmentType})`);
      if (c.governmentStructure?.branches && c.governmentStructure.branches.length > 0) {
        console.log(`    Branches: ${c.governmentStructure.branches.map(b => `${b.name} (${b.branchType})`).join(", ")}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
