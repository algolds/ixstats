import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function checkGeometry() {
  const country = await db.country.findFirst({
    where: { name: 'Caphiria' },
    select: { name: true, geometry: true, areaSqMi: true, centroid: true, boundingBox: true }
  });

  if (country?.geometry) {
    const geom = country.geometry as any;
    console.log('Country:', country.name);
    console.log('Geometry type:', geom.type);
    console.log('Area (sq mi):', country.areaSqMi);
    console.log('Bounding box:', country.boundingBox);

    if (geom.type === 'Polygon' && geom.coordinates?.[0]?.[0]) {
      const firstPoint = geom.coordinates[0][0];
      const lastPoint = geom.coordinates[0][geom.coordinates[0].length - 1];
      console.log('First coordinate (lng, lat):', firstPoint);
      console.log('Last coordinate:', lastPoint);
      console.log('Total points:', geom.coordinates[0].length);
    } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]?.[0]) {
      const firstPoint = geom.coordinates[0][0][0];
      console.log('First coordinate (lng, lat):', firstPoint);
      console.log('Number of polygons:', geom.coordinates.length);
    }

    console.log('Centroid:', country.centroid);
  } else {
    console.log('No geometry found for Caphiria');
  }

  await db.$disconnect();
}

checkGeometry();
