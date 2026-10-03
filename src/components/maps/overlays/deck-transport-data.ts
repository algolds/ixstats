import type { TransportSegmentInput } from "~/lib/maps/transport-vehicle-sim";
import { getRouteFamily } from "~/lib/economy/transport-costs";
import { distanceKm } from "~/lib/maps/geo-math";

export interface TransportNodeInput {
  id: string;
  name?: string | null;
  nodeType?: string;
  coordinates: [number, number];
  elevation?: number | null;
  capacity?: number | null;
  connectedCount?: number;
}

export interface FlightArcData {
  id: string;
  source: [number, number];
  target: [number, number];
  height: number;
  segmentId: string;
}

export interface HubPillarData {
  id: string;
  name: string;
  lng: number;
  lat: number;
  elevation: number;
  nodeType: string;
  isIntermodal?: boolean;
}

/** One flight arc per air corridor, rising in proportion to its length (capped at 120 km). */
export function buildFlightArcs(segments: TransportSegmentInput[]): FlightArcData[] {
  const arcs: FlightArcData[] = [];
  for (const seg of segments) {
    if (seg.routeType !== "air_corridor") continue;
    const coords = seg.geometry?.coordinates;
    const source = coords?.[0];
    const target = coords?.[coords.length - 1];
    if (!coords || coords.length < 2 || !source || !target) continue;

    arcs.push({
      id: `arc-${seg.id}`,
      source,
      target,
      height: Math.min(distanceKm(source, target) * 120, 120000),
      segmentId: seg.id,
    });
  }
  return arcs;
}

const MODAL_FAMILIES = new Set(["rail", "road", "maritime", "air"]);
/** A node is within this many degrees of a segment end when that segment terminates there. */
const NODE_SNAP_DEG = 0.02;

/** Nodes where segments of more than one modal family (rail/road/maritime/air) terminate. */
function findIntermodalNodeIds(nodes: TransportNodeInput[], segments: TransportSegmentInput[]) {
  const familiesByNode = new Map<string, Set<string>>();
  for (const seg of segments) {
    const coords = seg.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const ends = [coords[0]!, coords[coords.length - 1]!];
    const family = getRouteFamily(seg.routeType);
    if (!MODAL_FAMILIES.has(family)) continue;

    for (const n of nodes) {
      const [lng, lat] = n.coordinates;
      if (ends.some((p) => Math.hypot(lng - p[0], lat - p[1]) < NODE_SNAP_DEG)) {
        const families = familiesByNode.get(n.id) ?? new Set<string>();
        families.add(family);
        familiesByNode.set(n.id, families);
      }
    }
  }
  return new Set([...familiesByNode].filter(([, f]) => f.size > 1).map(([id]) => id));
}

/** Hub pillars from transport nodes (intermodal ones taller), else from air-corridor endpoints. */
export function buildHubPillars(
  nodes: TransportNodeInput[],
  segments: TransportSegmentInput[],
  flightArcs: FlightArcData[]
): HubPillarData[] {
  if (nodes.length > 0) {
    const intermodalIds = segments.length > 0 ? findIntermodalNodeIds(nodes, segments) : new Set();
    return nodes.map((n) => {
      const isIntermodal = intermodalIds.has(n.id);
      const baseElevation = n.capacity ?? (n.connectedCount ?? 3) * 1500;
      return {
        id: `hub-${n.id}`,
        name: n.name ?? (isIntermodal ? "Intermodal Freight Terminal" : "Transport Hub"),
        lng: n.coordinates[0],
        lat: n.coordinates[1],
        elevation: isIntermodal ? baseElevation * 1.4 : baseElevation,
        nodeType: n.nodeType ?? "junction",
        isIntermodal,
      };
    });
  }

  const airportCoords = new Map<string, [number, number]>();
  for (const { source, target } of flightArcs) {
    for (const p of [source, target]) airportCoords.set(`${p[0].toFixed(3)},${p[1].toFixed(3)}`, p);
  }
  return [...airportCoords.values()].map(([lng, lat], i) => ({
    id: `derived-hub-${i}`,
    name: "Terminal Hub",
    lng,
    lat,
    elevation: 8000,
    nodeType: "airport",
  }));
}
