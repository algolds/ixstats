# Plan 049: Route Network View — React Flow hub-and-spoke graph

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 2a15532d..HEAD -- src/components/maps/editor/MapEditorOverlay.tsx src/server/api/routers/transport/routeQueries.ts src/server/api/routers/transport/hubs.ts src/components/maps/overlays/TransportOverlay.tsx`
> If any in-scope/referenced file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M–L
- **Risk**: LOW (additive — new component + lib + one mount line)
- **Depends on**: none required. Reads best after **046** (so edge colors include
  the new route types), but works regardless.
- **Category**: direction (feature)
- **Planned at**: commit `2a15532d`, 2026-06-16

## Why this matters

Today routes are only viewable *on the map* as lines. The product vision wants an
"airline route map" style **network view** — hubs as nodes, routes as edges,
showing the shape of a nation's transport network at a glance (hub-and-spoke,
corridors, isolated links). React Flow (`@xyflow/react`) is **already installed and
used** elsewhere in the app (`src/app/admin/_components/CountryInspector.tsx`,
`src/app/admin/sports-labs/SportsLabsPanel.tsx`), so this needs **no new
dependency**. The data already exists: `api.transport.getCountryHubs` (hub points)
and `api.transport.getCountryRoutes` (routes as GeoJSON). This plan adds a pure
graph-builder, a self-contained React Flow view, and a launch button in the editor.

## Current state

**Data available (no changes needed to these):**

- `api.transport.getCountryHubs` (`src/server/api/routers/transport/hubs.ts` ~line 160)
  — input `{ countryId }`, returns `TransportHub[]` (Prisma rows) including
  `{ id, name, hubType, coordinates (Json [lng,lat]), throughput, connections, city }`.
- `api.transport.getCountryRoutes` (`src/server/api/routers/transport/routeQueries.ts` ~line 159)
  — input `{ countryId, routeType? }`, returns a GeoJSON `FeatureCollection` whose
  features look like:
  ```ts
  {
    type: "Feature",
    geometry: <GeoJSON LineString>,           // .coordinates: [lng,lat][]
    properties: { id, name, routeType, status, lengthKm, terrainDifficulty, isInternational, ... }
  }
  ```

**Route colors** are exported for reuse: `ROUTE_COLORS` from
`src/components/maps/overlays/TransportOverlay.tsx` (`export const ROUTE_COLORS:
Record<string,string>`). Use it to color edges by `routeType`.

**React Flow usage pattern to mirror** (`CountryInspector.tsx`):
```tsx
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
// ...
<ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.15 }} nodesDraggable>
  <Background color="#444" gap={16} size={1} />
  <Controls />
</ReactFlow>
```
No `ReactFlowProvider` wrapper is needed for a single self-contained instance (the
hooks `useNodesState`/`useEdgesState` work without it, as in `CountryInspector`).

**Mount context:** `src/components/maps/editor/MapEditorOverlay.tsx` has `countryId`
as a prop and renders the `TransportOverlay` at ~line 730 inside the map's relative
container. That block is the mount point for the launch button.

**A `Dialog` UI primitive exists:** `~/components/ui/dialog` (used widely). Use it
for the full-screen overlay. Confirm its exports with
`grep -n "export" src/components/ui/dialog.tsx` before using (expect
`Dialog, DialogContent, DialogTrigger, DialogTitle`, etc.).

### Conventions to follow

- Pure graph-building logic → `src/lib/route-network-graph.ts`, unit-tested with
  Jest (matches the repo's "pure logic in lib, fully testable" convention).
- The view component is `"use client"`.
- Use default React Flow nodes (no custom `nodeTypes`) for v1 — pass `data.label`.

## Commands you will need

| Purpose            | Command                                                          | Expected on success |
|--------------------|------------------------------------------------------------------|---------------------|
| Typecheck lib      | `bun run typecheck:file src/lib/route-network-graph.ts`          | exit 0              |
| Typecheck view     | `bun run typecheck:file src/components/maps/RouteNetworkView.tsx`| exit 0              |
| Unit test          | `bun run test -- src/lib/route-network-graph.test.ts`           | all pass            |
| Lint               | `bun run lint`                                                   | exit 0 (pre-existing warnings OK) |

Do NOT run `tsc --noEmit`, `bun run typecheck:full`, or `bun run check`.

## Scope

**In scope:**
- `src/lib/route-network-graph.ts` (create — pure graph builder)
- `src/lib/route-network-graph.test.ts` (create)
- `src/components/maps/RouteNetworkView.tsx` (create — React Flow view + launch button)
- `src/components/maps/editor/MapEditorOverlay.tsx` (add one mount line)

**Out of scope (do NOT touch):**
- The transport routers / Prisma model — read-only consumption of existing queries.
- The map rendering / `TransportOverlay` (other than importing `ROUTE_COLORS`).
- Any layout-engine dependency (dagre/elk/graphology) — nodes are positioned
  geographically (see Step 1); do not add a layout library.

## Git workflow

- Branch: `advisor/049-route-network-view` off `v2`. Conventional commit, e.g.
  `feat(maps): React Flow route network view`.
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Pure graph builder

Create `src/lib/route-network-graph.ts`. Nodes are hubs positioned by projecting
their `[lng,lat]` into a fixed canvas (geographically faithful — airline-map
style, no layout engine). Edges connect each route's endpoints to their nearest
hubs (a simple degree-distance heuristic).

```ts
import { ROUTE_COLORS } from "~/components/maps/overlays/TransportOverlay";

export interface NetworkHub {
  id: string;
  name: string;
  hubType?: string | null;
  coordinates: [number, number] | number[] | null; // [lng, lat]
  throughput?: number | null;
}

export interface NetworkRouteFeature {
  geometry?: { coordinates?: number[][] } | null;
  properties?: { id?: string; name?: string | null; routeType?: string } | null;
}

export interface RFNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
}
export interface RFEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: { stroke: string };
}

const CANVAS_W = 800;
const CANVAS_H = 600;
const PAD = 40;
// ponytail: nearest-hub match threshold in degrees (~150km); good enough for v1.
const MATCH_DEG = 1.5;

function isLngLat(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number";
}

/** Build React Flow nodes (hubs) + edges (routes) from transport data. */
export function buildRouteNetworkGraph(
  routes: NetworkRouteFeature[],
  hubs: NetworkHub[]
): { nodes: RFNode[]; edges: RFEdge[] } {
  const placed = hubs.filter((h) => isLngLat(h.coordinates));
  if (placed.length === 0) return { nodes: [], edges: [] };

  // Bounding box of hub coordinates → linear projection into the canvas (Y flipped).
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const h of placed) {
    const [lng, lat] = h.coordinates as [number, number];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const spanLng = Math.max(1e-6, maxLng - minLng);
  const spanLat = Math.max(1e-6, maxLat - minLat);
  const project = (lng: number, lat: number) => ({
    x: PAD + ((lng - minLng) / spanLng) * (CANVAS_W - 2 * PAD),
    y: PAD + ((maxLat - lat) / spanLat) * (CANVAS_H - 2 * PAD),
  });

  const nodes: RFNode[] = placed.map((h) => {
    const [lng, lat] = h.coordinates as [number, number];
    return { id: h.id, position: project(lng, lat), data: { label: h.name } };
  });

  const nearestHubId = (pt: [number, number]): string | null => {
    let best: string | null = null;
    let bestD = MATCH_DEG * MATCH_DEG;
    for (const h of placed) {
      const [lng, lat] = h.coordinates as [number, number];
      const d = (lng - pt[0]) ** 2 + (lat - pt[1]) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = h.id;
      }
    }
    return best;
  };

  const edges: RFEdge[] = [];
  const seen = new Set<string>();
  for (const r of routes) {
    const coords = r.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (!isLngLat(first) || !isLngLat(last)) continue;
    const src = nearestHubId(first);
    const tgt = nearestHubId(last);
    if (!src || !tgt || src === tgt) continue;
    const key = `${src}->${tgt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = r.properties?.routeType ?? "";
    edges.push({
      id: r.properties?.id ?? key,
      source: src,
      target: tgt,
      label: r.properties?.name ?? undefined,
      style: { stroke: ROUTE_COLORS[type] ?? "#888888" },
    });
  }

  return { nodes, edges };
}
```

**Verify**: `bun run typecheck:file src/lib/route-network-graph.ts` → exit 0.

### Step 2: Unit test the builder

Create `src/lib/route-network-graph.test.ts`:

```ts
import { buildRouteNetworkGraph } from "./route-network-graph";

const hubA = { id: "a", name: "Alpha", coordinates: [0, 0] as [number, number] };
const hubB = { id: "b", name: "Beta", coordinates: [2, 2] as [number, number] };

describe("buildRouteNetworkGraph", () => {
  it("makes a node per placed hub", () => {
    const { nodes } = buildRouteNetworkGraph([], [hubA, hubB]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("connects a route's endpoints to nearest hubs", () => {
    const route = {
      geometry: { coordinates: [[0, 0], [2, 2]] },
      properties: { id: "r1", routeType: "rail" },
    };
    const { edges } = buildRouteNetworkGraph([route], [hubA, hubB]);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.source).toBe("a");
    expect(edges[0]!.target).toBe("b");
  });

  it("skips a route with no hub near an endpoint", () => {
    const route = {
      geometry: { coordinates: [[0, 0], [50, 50]] }, // far from any hub
      properties: { id: "r2", routeType: "rail" },
    };
    const { edges } = buildRouteNetworkGraph([route], [hubA, hubB]);
    expect(edges).toHaveLength(0);
  });

  it("returns empty graph when no hubs have coordinates", () => {
    expect(buildRouteNetworkGraph([], [])).toEqual({ nodes: [], edges: [] });
  });
});
```

**Verify**: `bun run test -- src/lib/route-network-graph.test.ts` → all 4 pass.

### Step 3: The React Flow view + launch button

Create `src/components/maps/RouteNetworkView.tsx`. It exports a self-contained
`RouteNetworkButton` (a Button that opens a `Dialog` containing the graph) so the
mount is a single line. Confirm the `Dialog` exports first
(`grep -n "export" src/components/ui/dialog.tsx`) and adjust import names if they
differ from those used below.

```tsx
"use client";

import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Share2 } from "lucide-react";
import { api } from "~/trpc/react";
import { buildRouteNetworkGraph } from "~/lib/route-network-graph";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "~/components/ui/dialog";

function RouteNetworkView({ countryId }: { countryId: string }) {
  const { data: routeData } = api.transport.getCountryRoutes.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: hubs } = api.transport.getCountryHubs.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildRouteNetworkGraph(
      (routeData?.features as any[]) ?? [],
      (hubs as any[]) ?? []
    );
    setNodes(n);
    setEdges(e);
  }, [routeData, hubs, setNodes, setEdges]);

  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm">
        No transport hubs to graph yet. Add hubs and routes in the editor.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable
    >
      <Background color="#444" gap={16} size={1} />
      <Controls />
    </ReactFlow>
  );
}

export function RouteNetworkButton({ countryId }: { countryId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="absolute top-3 right-3 z-20 gap-1.5"
          title="Route network view"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Network</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[80vh] max-w-5xl p-0">
        <DialogTitle className="sr-only">Route Network</DialogTitle>
        <div className="h-full w-full">
          <RouteNetworkView countryId={countryId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Verify**: `bun run typecheck:file src/components/maps/RouteNetworkView.tsx` → exit 0.

### Step 4: Mount the launch button in the editor

In `src/components/maps/editor/MapEditorOverlay.tsx`:
1. Import it: `import { RouteNetworkButton } from "~/components/maps/RouteNetworkView";`
2. Right next to the existing `TransportOverlay` mount block (~line 730, inside the
   same relative map container), add:
   ```tsx
   {countryId && <RouteNetworkButton countryId={countryId} />}
   ```
   (`countryId` is a prop of `MapEditorOverlay`; the button positions itself
   absolutely in the top-right of the map area.)

**Verify**:
- `grep -c "RouteNetworkButton" src/components/maps/editor/MapEditorOverlay.tsx` → `2`
- `bun run lint` → exit 0 (no new errors).

## Test plan

- New `src/lib/route-network-graph.test.ts` (Step 2): node-per-hub, endpoint→nearest-
  hub edge, skip-when-no-nearby-hub, empty-when-no-hubs.
- Verification: `bun run test -- src/lib/route-network-graph.test.ts` → 4 pass.
- Manual (non-blocking, if a dev server is available): open the editor for a country
  that has hubs + routes, click the "Network" button, confirm hubs appear as nodes
  positioned roughly by geography and routes appear as colored edges; dragging a
  node works; a country with no hubs shows the empty-state message.

## Done criteria

- [ ] `bun run typecheck:file src/lib/route-network-graph.ts` exits 0
- [ ] `bun run typecheck:file src/components/maps/RouteNetworkView.tsx` exits 0
- [ ] `bun run test -- src/lib/route-network-graph.test.ts` → 4 tests pass
- [ ] `bun run lint` exits 0 with no new errors in the in-scope files
- [ ] `grep -c "RouteNetworkButton" src/components/maps/editor/MapEditorOverlay.tsx` → `2`
- [ ] `git status --porcelain` shows only the four in-scope paths created/modified
- [ ] `plans/README.md` status row for 049 updated

## STOP conditions

Stop and report back if:

- `ROUTE_COLORS` is not exported from `TransportOverlay.tsx`, or `getCountryRoutes`/
  `getCountryHubs` no longer match the documented input/return shapes (drift).
- `~/components/ui/dialog` does not export `Dialog`/`DialogContent`/`DialogTrigger`/
  `DialogTitle` (check and report; adapt to the actual primitive).
- The React Flow version's `useNodesState`/`useEdgesState` generics differ enough
  that the view won't typecheck after a reasonable attempt (report the version and
  error).
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- The node layout is geographic (projected lng/lat). If you later want a tidy
  hub-spoke/dagre layout, that's where a layout lib *might* earn its place — but
  only then, and `graphology`/`elk` are the lighter options. Not now.
- Edges connect route endpoints to nearest hubs within `MATCH_DEG` (~150km). Routes
  whose endpoints aren't near any hub are omitted — acceptable for v1. If routes
  gain explicit hub foreign keys later, replace the nearest-hub heuristic with the
  real association.
- Mount point: the button currently lives in the editor overlay (scoped to the
  editing country). It could later move to `/mycountry` or a public `/maps` panel —
  the `RouteNetworkButton` is self-contained and only needs a `countryId`.
- Reviewer: confirm the Dialog import names match the actual `ui/dialog` exports and
  that React Flow's CSS import didn't break the build.
