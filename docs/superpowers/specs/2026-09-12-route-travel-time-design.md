# Route Travel Time & Speed Customization Design Spec

**Date**: 2026-09-12  
**Status**: Approved & In Progress  
**Authors**: Antigravity & User  
**Scope**: Transport Network Physics, Travel Time Engine, Map Editor UI, Prisma Schema

---

## 1. Context & Motivation

Transport routes currently calculate and display physical length in kilometers (`lengthKm`) and cost estimates. However, geographic length alone lacks human meaning: a 300 km journey across an automated high-speed rail corridor takes under an hour, whereas the same distance on a mountain road or canal takes half a day.

Introducing travel time brings living scale to IxWorld and custom Realms, directly connecting spatial map assets with national logistics and mobility simulations.

---

## 2. Architecture & Data Model

### A. Database Schema (`prisma/schema/maps.prisma`)
`TransportRoute` receives a first-class `speedKmh` column:

```prisma
model TransportRoute {
  id                String   @id @default(cuid())
  countryId         String?
  country           Country? @relation("CountryTransportRoutes", fields: [countryId], references: [id], onDelete: SetNull)
  routeType         String   // rail, highway, road, shipping_lane, air_corridor, canal
  name              String?
  geometry          Json     // GeoJSON LineString
  stops             Json?    // [{cityId, name, coordinates, order}]
  properties        Json?    // {gauge, lanes, tonnage, is_electrified}
  speedKmh          Float?   // First-class design/cruising speed in km/h
  isInternational   Boolean  @default(false)
  status            String   @default("operational")
  builtYear         Int?
  capacity          Float?   // passengers/yr or tonnes/yr
  costBillion       Float?   // construction cost estimate
  terrainDifficulty Float?   // 0-1, computed from elevation changes along route
  lengthKm          Float?   // total route length
  worldId           String   @default("default")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  ...
}
```

### B. Fallback Hierarchy
1. `route.speedKmh` (first-class column)
2. `(route.properties as any)?.speed_kmh` (legacy JSON fallback)
3. `ROUTE_CONFIGS[routeType]?.baseSpeed` (route type default)
4. `80 km/h` (absolute system default)

---

## 3. Travel Time Calculation Mechanics

### Formula
$$v_{\text{eff}} = \max\left(5, \; v_{\text{base}} \times (1 - 0.25 \times \text{terrainDifficulty})\right)$$

$$T_{\text{transit}} = \frac{\text{lengthKm}}{v_{\text{eff}}} \times 60 \text{ minutes} + \text{dwellMinutes}$$

### Dwell Time Rules:
- **Rail / HSR**: $+5\text{ mins}$ per intermediate stop (city).
- **Commuter Rail / Tram**: $+2\text{ mins}$ per stop.
- **Air Corridor**: $+45\text{ mins}$ airport ground handling/clearance.
- **Maritime / Ferry**: $+30\text{ mins}$ harbor approach and docking.
- **Road / Motorway**: $+0\text{ mins}$ (free-flow).
- **Power Grid / Fiber**: Instantaneous light speed (`"< 1ms"`).
- **Pipeline**: Fluid transit velocity ($10\text{--}15\text{ km/h}$).

---

## 4. UI / UX Design

### A. Route Inspector (`FeatureInspector.tsx`)
- Speed input with quick preset buttons tailored to `routeType`.
- Live calculation card:
  - Formatted travel duration (`font-mono tabular-nums`).
  - Effective speed badge reflecting terrain penalties and dwell additions.

### B. Map Viewer (`RouteInfoPanel.tsx`)
- Displays `Est. Travel Time` with clock icon.
- Owner can edit speed directly.

### C. Live Waypoint Drawing HUD (`TransportPropertyForm.tsx`)
- Real-time updates as nodes are added: `4 Nodes • 280 km • ~2h 20m @ 120 km/h`.

---

## 5. Phase 2 Preview: MyCountry Integration
- National Transit Accessibility Index in Geography domain.
- Infrastructure maintenance degradation multipliers.
- Executive Statecraft directives modifying operational network speeds.
