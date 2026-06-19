import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Running Border Diagnostics for Caphiria ===");

  const country = await prisma.country.findFirst({
    where: {
      OR: [{ id: "cmgn9d82v00484kyx3mjv9b8q" }, { name: "Caphiria" }, { slug: "caphiria" }],
    },
  });

  if (!country) {
    console.error("Country 'Caphiria' not found in database.");
    return;
  }

  console.log(`Country found: id=${country.id}, name=${country.name}, slug=${country.slug}`);

  // Fetch political map layer for this country
  const mapLayer = await prisma.mapLayer.findFirst({
    where: {
      layerType: "political",
      countryId: country.id,
      isActive: true,
    },
  });

  if (!mapLayer) {
    console.log("No active political MapLayer found for this country.");
  } else {
    console.log(
      `MapLayer found: id=${mapLayer.id}, featureId=${mapLayer.featureId}, displayName=${mapLayer.displayName}, sourceUploadId=${mapLayer.sourceUploadId}, isActive=${mapLayer.isActive}`
    );
    const geomStr = JSON.stringify(mapLayer.geometry);
    console.log(`Geometry size: ${geomStr.length} characters`);
    if (geomStr.length > 500) {
      console.log(
        `Geometry preview: ${geomStr.substring(0, 250)}... [TRUNCATED] ...${geomStr.substring(geomStr.length - 250)}`
      );
    } else {
      console.log(`Geometry: ${geomStr}`);
    }
  }

  // Fetch subdivisions
  const subdivisions = await prisma.subdivision.findMany({
    where: { countryId: country.id },
  });

  console.log(`\nSubdivisions count: ${subdivisions.length}`);
  for (const sub of subdivisions) {
    const geomStr = JSON.stringify(sub.geometry);
    console.log(
      `- Sub: id=${sub.id}, name=${sub.name}, type=${sub.type}, status=${sub.status}, geometry size=${geomStr.length} characters`
    );
  }

  // Fetch pending or recent edit requests
  const editRequests = await prisma.mapEditRequest.findMany({
    where: { countryId: country.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`\nRecent MapEditRequests (last 10): ${editRequests.length}`);
  for (const req of editRequests) {
    console.log(
      `- Request: id=${req.id}, editType=${req.editType}, editSubtype=${req.editSubtype}, status=${req.status}, createdAt=${req.createdAt}`
    );
  }

  // Fetch editor sessions
  if (mapLayer) {
    const sessions = await prisma.mapEditorSession.findMany({
      where: { featureId: mapLayer.featureId },
    });
    console.log(`\nActive MapEditorSessions: ${sessions.length}`);
    for (const sess of sessions) {
      console.log(
        `- Session: id=${sess.id}, userId=${sess.userId}, isDraft=${sess.isDraft}, expiresAt=${sess.expiresAt}`
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
