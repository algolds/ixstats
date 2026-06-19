import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const caphiriaLayer = await prisma.mapLayer.findFirst({
    where: { layerType: "political", featureId: "Caphiria", isActive: true }
  });

  if (!caphiriaLayer) {
    console.error("Caphiria MapLayer not found");
    return;
  }

  const subdivisions = await prisma.subdivision.findMany({
    where: { countryId: "cmgn9d82v00484kyx3mjv9b8q" }
  });

  console.log("=== Checking Containment/Intersection with PostGIS (ST_MakeValid) ===");

  for (const sub of subdivisions) {
    if (!sub.geometry || !(sub.geometry as any).coordinates || (sub.geometry as any).coordinates.length === 0) {
      console.log(`Subdivision ${sub.name} has no geometry`);
      continue;
    }

    try {
      const result = await prisma.$queryRawUnsafe<Array<{ contains: boolean; intersects: boolean; intersection_area: number }>>(
        `SELECT
           ST_Contains(
             ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
             ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
           ) as contains,
           ST_Intersects(
             ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
             ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
           ) as intersects,
           ST_Area(
             ST_Intersection(
               ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
               ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
             )
           ) as intersection_area`,
        JSON.stringify(caphiriaLayer.geometry),
        JSON.stringify(sub.geometry)
      );

      const r = result[0];
      if (r) {
        console.log(`- Sub: ${sub.name}`);
        console.log(`  Contains: ${r.contains}, Intersects: ${r.intersects}, Intersection Area: ${r.intersection_area}`);
      }
    } catch (err: any) {
      console.error(`Error checking ${sub.name}:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
