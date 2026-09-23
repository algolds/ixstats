import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Export it (or load your .env) before running this script.");
}
const candidates = [databaseUrl];

async function tryConnect(url: string) {
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: ["error"],
  });
  try {
    const count = await client.country.count();
    console.log(`[SUCCESS] Connected to ${url.replace(/:[^:]*@/, ":***@")} - Country count: ${count}`);
    return client;
  } catch (err: any) {
    console.log(`[FAILED] ${url.replace(/:[^:]*@/, ":***@")} - ${err.message?.slice(0, 100)}`);
    await client.$disconnect();
    return null;
  }
}

async function main() {
  console.log("Searching for working database connection...");
  let activePrisma: PrismaClient | null = null;

  for (const url of candidates) {
    activePrisma = await tryConnect(url);
    if (activePrisma) break;
  }

  if (!activePrisma) {
    const errorMsg = "Could not connect to PostgreSQL on any candidate URL (ports 5433, 5432).";
    console.error(errorMsg);
    fs.writeFileSync("/home/jxsig/projects/ixstats/scripts/reports/db-connection-error.txt", errorMsg);
    return;
  }

  console.log("Querying countries and subdivisions...");
  const countries = await activePrisma.country.findMany({
    where: {
      OR: [
        { name: { contains: "Caphiria", mode: "insensitive" } },
        { slug: { contains: "caphiria", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
  console.log("Matched countries:", countries);

  // Get all subdivisions in the database
  const allSubdivisions = await activePrisma.subdivision.findMany({
    select: {
      id: true,
      countryId: true,
      name: true,
      type: true,
      level: true,
      capital: true,
      areaSqKm: true,
      population: true,
      climateProfile: true,
      elevationProfile: true,
      waterAccess: true,
      geometry: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${allSubdivisions.length} total subdivisions in database.`);

  // Find all subdivisions matching Caphiria or any recent subdivisions
  const caphiriaIds = new Set(countries.map((c) => c.id));
  const caphiriaSubdivisions = allSubdivisions.filter((s) =>
    caphiriaIds.has(s.countryId) || s.countryId.toLowerCase().includes("caphiria")
  );

  console.log(`Caphiria-linked subdivisions count: ${caphiriaSubdivisions.length}`);

  const report = {
    connected: true,
    matchedCountries: countries,
    caphiriaSubdivisionsCount: caphiriaSubdivisions.length,
    caphiriaSubdivisions: caphiriaSubdivisions,
    allSubdivisionsCount: allSubdivisions.length,
    allSubdivisions: allSubdivisions,
  };

  fs.writeFileSync(
    "/home/jxsig/projects/ixstats/scripts/reports/caphiria-24-regions.json",
    JSON.stringify(report, null, 2)
  );
  console.log("Successfully wrote results to scripts/reports/caphiria-24-regions.json");
  await activePrisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal in script:", e);
  fs.writeFileSync(
    "/home/jxsig/projects/ixstats/scripts/reports/db-connection-error.txt",
    e.stack || e.message
  );
});
