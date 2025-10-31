Based on my analysis of the PRD, the contractor's GitHub repo, and your current IxMaps system, here's my comprehensive assessment:
📊 Gap Analysis
What the PRD Envisioned:

Native integration into IxStats (Next.js 15 + tRPC + Prisma)
Dynamic, player-editable borders with real-time economic synchronization
Administrative tools for country creation/modification
Database-driven with PostgreSQL + PostGIS + Prisma ORM
Real-time WebSocket updates for border changes
Economic-geographic fusion (GDP impacts from territorial changes, trade routes, etc.)
Full CRUD operations on geographic data through tRPC API

What the Contractor Delivered:

A preprocessing workflow (Inkscape → GeoJSON → PMTiles)
A static visualization tool (MapLibre-based React app)
Pre-generated PMTiles for efficient tile serving
No backend, no database, no dynamic editing
This is a viewer, not an interactive system

Critical Misalignment:
The contractor built a "convert-once-and-serve" solution when you needed a "live editing platform" with database persistence. They solved the georeferencing problem beautifully but completely missed the dynamic, multi-user, economically-integrated requirements.

🎯 The Real Problems
1. Workflow Complexity (Your Main Concern)
Your current pain:
Illustrator/Inkscape → Convert to Absolute → Transform → Curves to Lines 
→ GeoJSON → QGIS → Fine-tuning → Export → Tiles
Why this is problematic:

QGIS is a bottleneck - it's desktop software, single-user, and creates a deployment gap
No version control - changes in Inkscape don't automatically propagate
Manual sync nightmare - every map edit requires full pipeline re-run
Can't scale to player editing - players can't run this workflow

2. The PMTiles Trap
PMTiles are fantastic for static map serving but terrible for dynamic editing:

Pre-baked tiles = can't modify individual borders on the fly
Regeneration required for every change
Not suitable for player-editable borders
Breaks the PRD's core requirement of real-time border management

3. Self-Hosting + PostGIS
You correctly identified PostGIS as necessary, but the contractor's solution doesn't use it at all. This is a major gap.

✅ What to Keep from the Contractor's Work

The GeoJSON Conversion Scripts - These are gold. They solve the SVG → GeoJSON problem.
The Coordinate System - The georeferencing approach is solid
PMTiles for Base Layers - Keep this for static layers (coastlines, terrain) that don't change


🔧 Recommended Path Forward
Phase 1: Hybrid Architecture (Weeks 1-4)
typescript┌─────────────────────────────────────────────────────┐
│                  IxStats Platform                   │
│  ┌──────────────────────────────────────────────┐   │
│  │         Next.js 15 + tRPC + Prisma           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────┐          ┌───────────────────┐   │
│  │   PostGIS    │◄────────►│  Dynamic Borders  │   │
│  │   Database   │          │   (GeoJSON in DB) │   │
│  └──────────────┘          └───────────────────┘   │
│         ▲                           │               │
│         │                           ▼               │
│  ┌──────────────┐          ┌───────────────────┐   │
│  │  PMTiles     │          │   MapLibre GL JS  │   │
│  │ (Base Layers)│─────────►│   Frontend Map    │   │
│  └──────────────┘          └───────────────────┘   │
└─────────────────────────────────────────────────────┘
Key Components:

PostgreSQL + PostGIS Extension
liter
sql   CREATE EXTENSION postgis;
   
   -- Store dynamic borders in DB, not tiles
   ALTER TABLE countries ADD COLUMN 
     geometry geometry(MultiPolygon, 4326);
   
   -- Spatial indexes for performance
   CREATE INDEX idx_countries_geom 
     ON countries USING GIST(geometry);

Two-Layer Rendering Strategy

Static Layers (PMTiles): Terrain, water bodies, grid lines
Dynamic Layers (DB → GeoJSON API): Country borders, territories, labels


tRPC Router for Geographic Operations

typescript   export const geoRouter = createTRPCRouter({
     // Get country borders (from PostGIS)
     getCountryBorders: publicProcedure
       .input(z.object({ countryId: z.string().optional() }))
       .query(async ({ ctx, input }) => {
         const countries = await ctx.db.country.findMany({
           where: input.countryId ? { id: input.countryId } : {},
           select: {
             id: true,
             name: true,
             // PostGIS ST_AsGeoJSON
             geometry: true 
           }
         });
         return countries.map(c => ({
           ...c,
           geometry: JSON.parse(c.geometry) // GeoJSON Feature
         }));
       }),
   
     // Update borders (player-editable)
     updateBorder: protectedProcedure
       .input(z.object({
         countryId: z.string(),
         geometry: z.object({
           type: z.literal('MultiPolygon'),
           coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()]))))
         }),
       }))
       .mutation(async ({ ctx, input }) => {
         // Validate ownership
         // Validate no overlaps with ST_Intersects
         // Calculate economic impact
         // Update in transaction
         // Broadcast WebSocket event
       }),
   });
Phase 2: Kill the QGIS Dependency (Weeks 2-3)
Replace QGIS with web-based editing:
typescript// Use MapLibre Draw plugin for in-browser editing
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {
    polygon: true,
    trash: true
  },
  styles: [/* Custom IxStats glass physics styling */]
});

map.addControl(draw);

// On feature creation/update
map.on('draw.create', async (e) => {
  const feature = e.features[0];
  
  // Validate and save to PostGIS via tRPC
  await trpc.geo.updateBorder.mutate({
    countryId: selectedCountry.id,
    geometry: feature.geometry
  });
});
Advantages:

✅ No desktop software required
✅ Players can edit in-browser
✅ Admins can edit in-browser
✅ Changes instantly saved to PostGIS
✅ Real-time validation against other borders

Phase 3: Economic Integration (Weeks 4-8)
This is where the PRD's vision comes alive:
typescript// When borders change, trigger economic recalculation
export async function onBorderUpdate(
  countryId: string,
  oldGeometry: MultiPolygon,
  newGeometry: MultiPolygon
) {
  // Calculate area change using PostGIS
  const areaChange = await db.$queryRaw`
    SELECT 
      ST_Area(${newGeometry}::geography) - 
      ST_Area(${oldGeometry}::geography) as delta_km2
  `;
  
  // Update economic model
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: { economicProfile: true }
  });
  
  // Recalculate GDP per capita based on territorial change
  const newGdpPerCapita = calculateGdpImpact(
    country.economicProfile,
    areaChange.delta_km2
  );
  
  // Save and broadcast
  await db.economicProfile.update({
    where: { countryId },
    data: { gdpPerCapita: newGdpPerCapita }
  });
  
  // WebSocket broadcast
  io.to(`country:${countryId}`).emit('economic-update', {
    gdpPerCapita: newGdpPerCapita,
    trigger: 'border-change'
  });
}

🏗️ Concrete Implementation Steps
Step 1: Set Up PostGIS (This Week)
bash# On your Vultr VPS
sudo apt install postgresql-14 postgresql-14-postgis-3

# Enable PostGIS
sudo -u postgres psql -d ixstats
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;

# Test
SELECT PostGIS_Version();
Step 2: Migrate Existing Map Data (Week 2)
Use the contractor's conversion scripts to do a one-time import:
bash# Convert your Inkscape SVGs to GeoJSON (contractor's script)
cd algolds-ixmaps/scripting
python svg_to_geojson.py ../your-map.svg

# Import to PostGIS
ogr2ogr -f "PostgreSQL" \
  PG:"dbname=ixstats user=postgres" \
  countries.geojson \
  -nln countries \
  -append
Step 3: Extend Prisma Schema (Week 2)
prismamodel Country {
  // ... existing 137 fields ...
  
  // NEW: Geographic fields
  geometry  Json?  // GeoJSON MultiPolygon
  centroid  Json?  // GeoJSON Point [lng, lat]
  
  // Raw PostGIS columns (not managed by Prisma directly)
  // Access via raw queries: db.$queryRaw
  // geom_postgis Unsupported("geometry(MultiPolygon, 4326)")?
  
  territories  Territory[]
  borderHistory BorderHistory[]
}

model Territory {
  id          String  @id @default(cuid())
  countryId   String
  name        String
  geometry    Json    // GeoJSON Polygon
  isMainland  Boolean @default(false)
  population  BigInt?
  
  country     Country @relation(fields: [countryId], references: [id])
  
  @@map("territories")
}

model BorderHistory {
  id          String   @id @default(cuid())
  countryId   String
  geometry    Json     // Historical boundary
  changedBy   String   // User ID
  changedAt   DateTime @default(now())
  reason      String?
  
  country     Country @relation(fields: [countryId], references: [id])
  
  @@map("border_history")
}
Step 4: Build the Map Component (Week 3-4)
typescript// app/src/components/Map/IxMapsGL.tsx
'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { trpc } from '@/utils/trpc';

export default function IxMapsGL() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  
  const { data: countries } = trpc.geo.getCountryBorders.useQuery();
  
  useEffect(() => {
    if (!mapContainer.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          // Static base layer (PMTiles from contractor)
          'base-map': {
            type: 'vector',
            url: 'pmtiles:///ixmaps-base.pmtiles'
          },
          
          // Dynamic country borders (from PostGIS via API)
          'countries': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: countries || []
            }
          }
        },
        layers: [
          // Base layers...
          
          // Country borders (editable)
          {
            id: 'country-borders',
            type: 'fill',
            source: 'countries',
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#a78bfa', // Selected (glass physics purple)
                'transparent'
              ],
              'fill-opacity': 0.3
            }
          },
          {
            id: 'country-outlines',
            type: 'line',
            source: 'countries',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': 0.8
            }
          }
        ]
      },
      center: [0, 0],
      zoom: 2
    });
    
    return () => map.current?.remove();
  }, [countries]);
  
  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-xl border border-white/10 backdrop-blur-xl"
    />
  );
}

💡 Why This Approach Solves Your Problems
ProblemSolutionQGIS bottleneck✅ Web-based editing with MapLibre DrawManual pipeline✅ Direct DB updates, no regeneration neededCan't scale to players✅ Browser-based editing for everyoneNo PostGIS integration✅ Native PostGIS with spatial functionsStatic tiles limitation✅ Hybrid: Static base + dynamic bordersEconomic integration✅ tRPC mutations trigger economic recalcSelf-hosting complexity✅ Single VPS with PostgreSQL + PostGIS

🚨 Critical Decisions Needed
1. What to do with contractor's work?
Recommendation: Keep the conversion scripts and base PMTiles, discard the React app.
2. One-time vs. continuous georeferencing?
Recommendation: Do one-time conversion of your current SVG maps to PostGIS, then all future edits happen in-database. No more Inkscape → GeoJSON pipeline.
3. Who can edit what?
typescript// Proposed permission model
enum GeoPermission {
  VIEW = 'view',              // Everyone
  EDIT_OWN = 'edit_own',      // Country owners
  ADMIN_EDIT = 'admin_edit',  // World admins
  CREATE_COUNTRY = 'create',  // Only superadmins
}

📋 Next Steps (Priority Order)

✅ Set up PostGIS on Vultr VPS (1 day)
✅ Run one-time import of current maps using contractor's scripts (2 days)
✅ Extend Prisma schema with geographic models (1 day)
✅ Build basic tRPC geo router (3 days)
✅ Create MapLibre GL JS component in IxStats (3 days)
✅ Add MapLibre Draw for editing (2 days)
✅ Implement border validation (ST_Intersects, overlap detection) (3 days)
✅ Connect to economic system (trigger GDP recalc on border changes) (5 days)

Total: ~3 weeks to MVP, then iterate on admin tools, permissions, and economic integration.

🎯 Bottom Line
The contractor built you a preprocessing workflow and static viewer. You need a live, database-driven editing platform.
The good news: Their georeferencing work isn't wasted - use it for the one-time conversion, then move to PostGIS + web editing. This eliminates QGIS entirely and aligns with the PRD's vision of dynamic, player-editable borders with economic integration.




Based on my analysis of the PRD, the contractor's GitHub repo, and your current IxMaps system, here's my comprehensive assessment:
📊 Gap Analysis
What the PRD Envisioned:

Native integration into IxStats (Next.js 15 + tRPC + Prisma)
Dynamic, player-editable borders with real-time economic synchronization
Administrative tools for country creation/modification
Database-driven with PostgreSQL + PostGIS + Prisma ORM
Real-time WebSocket updates for border changes
Economic-geographic fusion (GDP impacts from territorial changes, trade routes, etc.)
Full CRUD operations on geographic data through tRPC API

What the Contractor Delivered:

A preprocessing workflow (Inkscape → GeoJSON → PMTiles)
A static visualization tool (MapLibre-based React app)
Pre-generated PMTiles for efficient tile serving
No backend, no database, no dynamic editing
This is a viewer, not an interactive system

Critical Misalignment:
The contractor built a "convert-once-and-serve" solution when you needed a "live editing platform" with database persistence. They solved the georeferencing problem beautifully but completely missed the dynamic, multi-user, economically-integrated requirements.

🎯 The Real Problems
1. Workflow Complexity (Your Main Concern)
Your current pain:
Illustrator/Inkscape → Convert to Absolute → Transform → Curves to Lines 
→ GeoJSON → QGIS → Fine-tuning → Export → Tiles
Why this is problematic:

QGIS is a bottleneck - it's desktop software, single-user, and creates a deployment gap
No version control - changes in Inkscape don't automatically propagate
Manual sync nightmare - every map edit requires full pipeline re-run
Can't scale to player editing - players can't run this workflow

2. The PMTiles Trap
PMTiles are fantastic for static map serving but terrible for dynamic editing:

Pre-baked tiles = can't modify individual borders on the fly
Regeneration required for every change
Not suitable for player-editable borders
Breaks the PRD's core requirement of real-time border management

3. Self-Hosting + PostGIS
You correctly identified PostGIS as necessary, but the contractor's solution doesn't use it at all. This is a major gap.

✅ What to Keep from the Contractor's Work

The GeoJSON Conversion Scripts - These are gold. They solve the SVG → GeoJSON problem.
The Coordinate System - The georeferencing approach is solid
PMTiles for Base Layers - Keep this for static layers (coastlines, terrain) that don't change


🔧 Recommended Path Forward
Phase 1: Hybrid Architecture (Weeks 1-4)
typescript┌─────────────────────────────────────────────────────┐
│                  IxStats Platform                   │
│  ┌──────────────────────────────────────────────┐   │
│  │         Next.js 15 + tRPC + Prisma           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────┐          ┌───────────────────┐   │
│  │   PostGIS    │◄────────►│  Dynamic Borders  │   │
│  │   Database   │          │   (GeoJSON in DB) │   │
│  └──────────────┘          └───────────────────┘   │
│         ▲                           │               │
│         │                           ▼               │
│  ┌──────────────┐          ┌───────────────────┐   │
│  │  PMTiles     │          │   MapLibre GL JS  │   │
│  │ (Base Layers)│─────────►│   Frontend Map    │   │
│  └──────────────┘          └───────────────────┘   │
└─────────────────────────────────────────────────────┘
Key Components:

PostgreSQL + PostGIS Extension

sql   CREATE EXTENSION postgis;
   
   -- Store dynamic borders in DB, not tiles
   ALTER TABLE countries ADD COLUMN 
     geometry geometry(MultiPolygon, 4326);
   
   -- Spatial indexes for performance
   CREATE INDEX idx_countries_geom 
     ON countries USING GIST(geometry);

Two-Layer Rendering Strategy

Static Layers (PMTiles): Terrain, water bodies, grid lines
Dynamic Layers (DB → GeoJSON API): Country borders, territories, labels


tRPC Router for Geographic Operations

typescript   export const geoRouter = createTRPCRouter({
     // Get country borders (from PostGIS)
     getCountryBorders: publicProcedure
       .input(z.object({ countryId: z.string().optional() }))
       .query(async ({ ctx, input }) => {
         const countries = await ctx.db.country.findMany({
           where: input.countryId ? { id: input.countryId } : {},
           select: {
             id: true,
             name: true,
             // PostGIS ST_AsGeoJSON
             geometry: true 
           }
         });
         return countries.map(c => ({
           ...c,
           geometry: JSON.parse(c.geometry) // GeoJSON Feature
         }));
       }),
   
     // Update borders (player-editable)
     updateBorder: protectedProcedure
       .input(z.object({
         countryId: z.string(),
         geometry: z.object({
           type: z.literal('MultiPolygon'),
           coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()]))))
         }),
       }))
       .mutation(async ({ ctx, input }) => {
         // Validate ownership
         // Validate no overlaps with ST_Intersects
         // Calculate economic impact
         // Update in transaction
         // Broadcast WebSocket event
       }),
   });
Phase 2: Kill the QGIS Dependency (Weeks 2-3)
Replace QGIS with web-based editing:
typescript// Use MapLibre Draw plugin for in-browser editing
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {
    polygon: true,
    trash: true
  },
  styles: [/* Custom IxStats glass physics styling */]
});

map.addControl(draw);

// On feature creation/update
map.on('draw.create', async (e) => {
  const feature = e.features[0];
  
  // Validate and save to PostGIS via tRPC
  await trpc.geo.updateBorder.mutate({
    countryId: selectedCountry.id,
    geometry: feature.geometry
  });
});
Advantages:

✅ No desktop software required
✅ Players can edit in-browser
✅ Admins can edit in-browser
✅ Changes instantly saved to PostGIS
✅ Real-time validation against other borders

Phase 3: Economic Integration (Weeks 4-8)
This is where the PRD's vision comes alive:
typescript// When borders change, trigger economic recalculation
export async function onBorderUpdate(
  countryId: string,
  oldGeometry: MultiPolygon,
  newGeometry: MultiPolygon
) {
  // Calculate area change using PostGIS
  const areaChange = await db.$queryRaw`
    SELECT 
      ST_Area(${newGeometry}::geography) - 
      ST_Area(${oldGeometry}::geography) as delta_km2
  `;
  
  // Update economic model
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: { economicProfile: true }
  });
  
  // Recalculate GDP per capita based on territorial change
  const newGdpPerCapita = calculateGdpImpact(
    country.economicProfile,
    areaChange.delta_km2
  );
  
  // Save and broadcast
  await db.economicProfile.update({
    where: { countryId },
    data: { gdpPerCapita: newGdpPerCapita }
  });
  
  // WebSocket broadcast
  io.to(`country:${countryId}`).emit('economic-update', {
    gdpPerCapita: newGdpPerCapita,
    trigger: 'border-change'
  });
}

🏗️ Concrete Implementation Steps
Step 1: Set Up PostGIS (This Week)
bash# On your Vultr VPS
sudo apt install postgresql-14 postgresql-14-postgis-3

# Enable PostGIS
sudo -u postgres psql -d ixstats
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;

# Test
SELECT PostGIS_Version();
Step 2: Migrate Existing Map Data (Week 2)
Use the contractor's conversion scripts to do a one-time import:
bash# Convert your Inkscape SVGs to GeoJSON (contractor's script)
cd algolds-ixmaps/scripting
python svg_to_geojson.py ../your-map.svg

# Import to PostGIS
ogr2ogr -f "PostgreSQL" \
  PG:"dbname=ixstats user=postgres" \
  countries.geojson \
  -nln countries \
  -append
Step 3: Extend Prisma Schema (Week 2)
prismamodel Country {
  // ... existing 137 fields ...
  
  // NEW: Geographic fields
  geometry  Json?  // GeoJSON MultiPolygon
  centroid  Json?  // GeoJSON Point [lng, lat]
  
  // Raw PostGIS columns (not managed by Prisma directly)
  // Access via raw queries: db.$queryRaw
  // geom_postgis Unsupported("geometry(MultiPolygon, 4326)")?
  
  territories  Territory[]
  borderHistory BorderHistory[]
}

model Territory {
  id          String  @id @default(cuid())
  countryId   String
  name        String
  geometry    Json    // GeoJSON Polygon
  isMainland  Boolean @default(false)
  population  BigInt?
  
  country     Country @relation(fields: [countryId], references: [id])
  
  @@map("territories")
}

model BorderHistory {
  id          String   @id @default(cuid())
  countryId   String
  geometry    Json     // Historical boundary
  changedBy   String   // User ID
  changedAt   DateTime @default(now())
  reason      String?
  
  country     Country @relation(fields: [countryId], references: [id])
  
  @@map("border_history")
}
Step 4: Build the Map Component (Week 3-4)
typescript// app/src/components/Map/IxMapsGL.tsx
'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { trpc } from '@/utils/trpc';

export default function IxMapsGL() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  
  const { data: countries } = trpc.geo.getCountryBorders.useQuery();
  
  useEffect(() => {
    if (!mapContainer.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          // Static base layer (PMTiles from contractor)
          'base-map': {
            type: 'vector',
            url: 'pmtiles:///ixmaps-base.pmtiles'
          },
          
          // Dynamic country borders (from PostGIS via API)
          'countries': {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: countries || []
            }
          }
        },
        layers: [
          // Base layers...
          
          // Country borders (editable)
          {
            id: 'country-borders',
            type: 'fill',
            source: 'countries',
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#a78bfa', // Selected (glass physics purple)
                'transparent'
              ],
              'fill-opacity': 0.3
            }
          },
          {
            id: 'country-outlines',
            type: 'line',
            source: 'countries',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2,
              'line-opacity': 0.8
            }
          }
        ]
      },
      center: [0, 0],
      zoom: 2
    });
    
    return () => map.current?.remove();
  }, [countries]);
  
  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-xl border border-white/10 backdrop-blur-xl"
    />
  );
}

💡 Why This Approach Solves Your Problems
ProblemSolutionQGIS bottleneck✅ Web-based editing with MapLibre DrawManual pipeline✅ Direct DB updates, no regeneration neededCan't scale to players✅ Browser-based editing for everyoneNo PostGIS integration✅ Native PostGIS with spatial functionsStatic tiles limitation✅ Hybrid: Static base + dynamic bordersEconomic integration✅ tRPC mutations trigger economic recalcSelf-hosting complexity✅ Single VPS with PostgreSQL + PostGIS

🚨 Critical Decisions Needed
1. What to do with contractor's work?
Recommendation: Keep the conversion scripts and base PMTiles, discard the React app.
2. One-time vs. continuous georeferencing?
Recommendation: Do one-time conversion of your current SVG maps to PostGIS, then all future edits happen in-database. No more Inkscape → GeoJSON pipeline.
3. Who can edit what?
typescript// Proposed permission model
enum GeoPermission {
  VIEW = 'view',              // Everyone
  EDIT_OWN = 'edit_own',      // Country owners
  ADMIN_EDIT = 'admin_edit',  // World admins
  CREATE_COUNTRY = 'create',  // Only superadmins
}

📋 Next Steps (Priority Order)

✅ Set up PostGIS on Vultr VPS (1 day)
✅ Run one-time import of current maps using contractor's scripts (2 days)
✅ Extend Prisma schema with geographic models (1 day)

✅ Build basic tRPC geo router (3 days)
✅ Create MapLibre GL JS component in IxStats (3 days)
✅ Add MapLibre Draw for editing (2 days)
✅ Implement border validation (ST_Intersects, overlap detection) (3 days)
✅ Connect to economic system (trigger GDP recalc on border changes) (5 days)

Total: ~3 weeks to MVP, then iterate on admin tools, permissions, and economic integration.