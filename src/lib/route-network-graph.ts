import { ROUTE_COLORS } from "~/components/maps/overlays/TransportOverlay";

export interface NetworkHub {
  id: string;
  name: string;
  hubType?: string | null;
  coordinates: [number, number] | number[] | null;
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
const MATCH_DEG = 1.5;

function isLngLat(c: unknown): c is [number, number] {
  return (
    Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number"
  );
}

export function buildRouteNetworkGraph(
  routes: NetworkRouteFeature[],
  hubs: NetworkHub[]
): { nodes: RFNode[]; edges: RFEdge[] } {
  const placed = hubs.filter((h) => isLngLat(h.coordinates));
  if (placed.length === 0) return { nodes: [], edges: [] };

  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
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
