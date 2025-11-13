/**
 * Rivers Polygons GeoJSON API
 * 
 * Serves buffered river geometries as polygons for visualization.
 * Dynamically buffers river linestrings to create polygon representations.
 */

import { NextResponse } from 'next/server';
import { db } from '~/server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    // Fetch rivers and dynamically buffer the geometry to create polygons
    const rivers = await db.$queryRaw<Array<{
      ogc_fid: number;
      id: string;
      ixmap_subgroup: string | null;
      fill: string | null;
      geometry: any; // PostGIS geometry object
    }>>`
      SELECT
        ogc_fid,
        id,
        ixmap_subgroup,
        fill,
        ST_AsGeoJSON(
          ST_Buffer(geometry::geography, 5000)::geometry
        )::json as geometry
      FROM map_layer_rivers
      WHERE ST_GeometryType(geometry) NOT IN ('ST_Polygon', 'ST_MultiPolygon')
      ORDER BY ogc_fid
    `;

    // Transform to GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: rivers.map((river) => ({
        type: 'Feature',
        id: river.ogc_fid,
        geometry: river.geometry,
        properties: {
          id: river.id,
          ixmap_subgroup: river.ixmap_subgroup,
          fill: river.fill,
        },
      })),
    };

    return NextResponse.json(geojson, {
      headers: {
        'Content-Type': 'application/geo+json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching rivers polygons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rivers polygons' },
      { status: 500 }
    );
  }
}

