// API endpoint for river polygon GeoJSON
// Serves buffered polygon geometries for high-zoom river rendering

import { NextResponse } from 'next/server';
import { db } from '~/server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    // Query the materialized view for river polygons
    const rivers = await db.$queryRaw<Array<{
      ogc_fid: number;
      id: string;
      ixmap_subgroup: string | null;
      fill: string | null;
      country_id: string | null;
      geometry: any; // PostGIS geometry object
    }>>`
      SELECT
        ogc_fid,
        id,
        ixmap_subgroup,
        fill,
        country_id,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM map_layer_rivers_polygons
      ORDER BY ogc_fid
    `;

    // Convert to GeoJSON FeatureCollection
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
          country_id: river.country_id,
        },
      })),
    };

    return NextResponse.json(geojson, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching river polygons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch river polygons' },
      { status: 500 }
    );
  }
}
