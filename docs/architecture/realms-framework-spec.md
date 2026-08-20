# Realms Platform & Multi-Tenant World Architecture

**Platform Model**: Realms (External-Facing Multi-Tenant Platform)  
**Default Instance**: IxWorld (`realm="default"`, private community tenant)  
**Spatial Foundation**: UPG v2 (Unified Physical Geography, 100,000-cell Voronoi Mesh)

---

## 1. Product Philosophy: IxWorld vs. Realms

- **IxWorld** is the internal, private default realm for the two-decade-old Ixnay geopolitical worldbuilding community. It is a closed instance (`realm="default"`).
- **Realms** is the external-facing multi-tenant product. External communities, tabletop groups, and worldbuilders create their own independent realms with bespoke maps, nations, and simulations.
- **Architectural Tenet**: Always build **"realm-first"**. Every data model, router, and map layer is scoped by `realmId` (`worldId`). IxWorld benefits from these abstractions as Tenant 0, but is not the entry point for new external players.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REALMS PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Realm Tenant Context (realmId / slug)                                   │
│ Controls: MediaWiki endpoint, map projection, climate, custom currencies│
├──────────────────────┬──────────────────────┬───────────────────────────┤
│ Map Engine (UPG v2)  │ Simulation Engine    │ WikiOS Engine             │
│ 100k Voronoi mesh,   │ Statecraft loop,     │ Headless MediaWiki /      │
│ 7 GeoJSON layers     │ civCap, economics    │ PlateJS article render    │
├──────────────────────┴──────────────────────┴───────────────────────────┤
│ MapLibre GL JS Renderer (Globe / 2D Mercator Projections)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Data Scoping

All geographic, demographic, and simulation models in Prisma are tenant-scoped:

```prisma
model Country {
  id        String   @id @default(cuid())
  realmId   String   @default("default")
  slug      String
  name      String
  // ...
  @@unique([realmId, slug])
  @@index([realmId])
}

model MapLayer {
  id        String   @id @default(cuid())
  realmId   String   @default("default")
  layerType String
  data      Json
  @@index([realmId])
}
```

### URL Routing Conventions:
- **Default Realm (IxWorld)**: `/maps`, `/mycountry`, `/dashboard`, `/vault`, `/thinkpages`
- **External Realms**: `/realms/[realmSlug]/maps`, `/realms/[realmSlug]/mycountry`, `/realms/[realmSlug]/admin`

---

## 3. Standardized Map Layers (7 GeoJSON Layers)

Every realm renders 7 standardized vector topology layers generated from UPG v2:

| Layer | Type | zIndex | Description |
| :--- | :--- | :---: | :--- |
| **`ocean-bathymetry`** | Polygon | 1 | Deep ocean trenches and continental shelf hypsometry |
| **`landmass-terrain`** | Polygon | 2 | Base continent elevation zones (`zone_0` to `zone_8`) |
| **`climate-biomes`** | Polygon | 3 | Trewartha 12-zone climate classifications |
| **`political-countries`**| Polygon | 4 | Sovereign national borders and maritime exclusive economic zones (EEZ) |
| **`subdivisions`** | Polygon | 5 | Provincial and administrative territories |
| **`lakes-water`** | Polygon | 6 | Inland freshwater lakes (renders *above* political borders) |
| **`rivers-hydrography`**| LineString | 7 | Dynamic branching river networks (renders *above* political borders) |

### Layer Stacking Invariant:
> [!IMPORTANT]
> Inland water features (Rivers `zIndex: 7` and Lakes `zIndex: 6`) MUST always render **above** Political Countries (`zIndex: 4`) so natural drainage geography is never masked by territory fills.

---

## 4. Vector Geometry Processing Pipeline

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Voronoi Graph (UPG v2) │ ──> │   Catmull-Rom Splines   │
│  100,000 spatial cells  │     │   4-pass subdivision    │
└─────────────────────────┘     └────────────┬────────────┘
                                             │
                                             ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ Response-Boundary 6 DP  │ <── │ Visvalingam Compression │
│ Coordinate Truncation   │     │ Topology-preserving     │
└─────────────────────────┘     └─────────────────────────┘
```

1. **Catmull-Rom Spline Subdivision**: All GeoJSON layers apply 4-pass Catmull-Rom smoothing ($\tau = 0.5$) along shared vertex topology to eliminate Voronoi polygon angularity.
2. **Coordinate Truncation (`src/lib/geojson-compress.ts`)**: Truncates output coordinates to 6 decimal places ($\sim 0.11\text{m}$ precision), reducing network transfer payloads by 30–50%.
3. **Web Worker Offloading (`src/hooks/useGeoWorker.ts`)**: Bounding-box culling and area threshold filtering run in Web Workers during rapid zoom.
