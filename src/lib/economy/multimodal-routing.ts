/**
 * multimodal-routing.ts — Multi-modal transit and logistics pathfinding engine.
 *
 * Calculates optimal cross-modal freight and passenger routes connecting
 * maritime shipping lanes, freight rail lines, arterial highways, and air corridors
 * with automated transfer penalties, transshipment dwell times, and intermodal hub detection.
 */

import {
  calculateIntermodalTransfer,
  getRouteFamily,
  type ModalFamily,
  type IntermodalTransferResult,
} from "./transport-costs";

export interface MultiModalNode {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  hubType?: "port" | "station" | "airport" | "junction" | "interchange";
}

export interface MultiModalSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  routeType: string;
  distanceKm: number;
  terrainDifficulty?: number;
  speedKmh?: number;
  coordinates?: [number, number][];
}

export interface MultiModalRouteRequest {
  originNodeId: string;
  destinationNodeId: string;
  cargoWeightTons?: number;
  allowedModes?: string[];
  prioritize?: "cost" | "time" | "balanced";
}

export interface MultiModalRouteStep {
  segmentId: string;
  fromNodeId: string;
  toNodeId: string;
  routeType: string;
  modalFamily: ModalFamily;
  distanceKm: number;
  costBillion: number;
  transitTimeHours: number;
}

export interface MultiModalTransferStep {
  atNodeId: string;
  hubType: "port" | "station" | "airport" | "junction" | "interchange";
  fromType: string;
  toType: string;
  fromFamily: ModalFamily;
  toFamily: ModalFamily;
  transferCostBillion: number;
  transferDelayHours: number;
  description: string;
}

export interface MultiModalPathResult {
  found: boolean;
  totalDistanceKm: number;
  totalCostBillion: number;
  totalTransitTimeHours: number;
  pathNodeIds: string[];
  steps: MultiModalRouteStep[];
  transfers: MultiModalTransferStep[];
}

export interface IntermodalHubSummary {
  nodeId: string;
  lat: number;
  lng: number;
  name?: string;
  hubType: "port" | "station" | "airport" | "junction" | "interchange";
  connectedFamilies: ModalFamily[];
  connectedRouteTypes: string[];
  isIntermodal: boolean;
}

/** Standard commercial operating speeds in km/h by sub-type */
const DEFAULT_SPEED_KMH: Record<string, number> = {
  high_speed_rail: 280,
  commuter_rail: 90,
  rail: 80,
  freight_rail: 65,
  motorway: 110,
  highway: 90,
  trunk: 70,
  road: 60,
  secondary: 45,
  shipping_lane: 35,
  canal: 20,
  ferry: 25,
  air_corridor: 800,
  pipeline: 15,
  power_grid: 300_000,
  fiber: 300_000,
  military_supply: 50,
  military_naval: 30,
};

/** Operational transport cost per ton-kilometer (USD) */
const OPERATIONAL_COST_PER_TON_KM: Record<ModalFamily, number> = {
  maritime: 0.005, // deepwater container shipping is cheapest
  rail: 0.025, // bulk rail transport
  road: 0.09, // trucking
  air: 0.5, // high-value expedited cargo
  utility: 0.01,
  military: 0.08,
};

/**
 * Calculates operational freight transit cost in billions USD.
 */
function calculateTransitCostBillion(
  family: ModalFamily,
  distanceKm: number,
  cargoWeightTons: number
): number {
  const ratePerTonKm = OPERATIONAL_COST_PER_TON_KM[family] ?? 0.05;
  const rawCostUsd = distanceKm * cargoWeightTons * ratePerTonKm;
  // Convert USD to Billions USD, rounded to 5 decimal places
  return Math.round((rawCostUsd / 1_000_000_000) * 100000) / 100000;
}

/**
 * Priority queue item for Dijkstra / A* state.
 * State is (nodeId, incomingRouteType).
 */
interface PathState {
  nodeId: string;
  incomingRouteType: string | null;
  accumCostBillion: number;
  accumTimeHours: number;
  accumDistanceKm: number;
  weight: number;
  prev: PathState | null;
  stepTaken: MultiModalRouteStep | null;
  transferTaken: MultiModalTransferStep | null;
}

/**
 * Finds the optimal multi-modal path between two nodes in a transport network.
 * Accurately penalizes cross-modal transfers (dwell time, transshipment fees)
 * and selects optimal combinations (e.g. rail trunk + maritime leg + truck last mile).
 */
export function findMultiModalPath(
  nodes: MultiModalNode[],
  segments: MultiModalSegment[],
  request: MultiModalRouteRequest
): MultiModalPathResult {
  const {
    originNodeId,
    destinationNodeId,
    cargoWeightTons = 10_000,
    allowedModes,
    prioritize = "balanced",
  } = request;

  const nodeMap = new Map<string, MultiModalNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  if (!nodeMap.has(originNodeId) || !nodeMap.has(destinationNodeId)) {
    return {
      found: false,
      totalDistanceKm: 0,
      totalCostBillion: 0,
      totalTransitTimeHours: 0,
      pathNodeIds: [],
      steps: [],
      transfers: [],
    };
  }

  // Build adjacency graph (bidirectional segments)
  const adjacency = new Map<string, MultiModalSegment[]>();
  for (const seg of segments) {
    if (allowedModes && !allowedModes.includes(seg.routeType)) {
      continue;
    }
    const fromList = adjacency.get(seg.fromNodeId) ?? [];
    fromList.push(seg);
    adjacency.set(seg.fromNodeId, fromList);

    const toList = adjacency.get(seg.toNodeId) ?? [];
    toList.push({
      ...seg,
      fromNodeId: seg.toNodeId,
      toNodeId: seg.fromNodeId,
    });
    adjacency.set(seg.toNodeId, toList);
  }

  // Dijkstra / A* with state: (nodeId, incomingRouteType)
  const stateKey = (nodeId: string, rType: string | null) => `${nodeId}|${rType ?? "ROOT"}`;
  const bestScores = new Map<string, number>();

  // Simple min-heap / sorted array for priority queue
  const queue: PathState[] = [
    {
      nodeId: originNodeId,
      incomingRouteType: null,
      accumCostBillion: 0,
      accumTimeHours: 0,
      accumDistanceKm: 0,
      weight: 0,
      prev: null,
      stepTaken: null,
      transferTaken: null,
    },
  ];

  function calculatePriorityWeight(costBillion: number, timeHours: number): number {
    if (prioritize === "cost") return costBillion * 1000;
    if (prioritize === "time") return timeHours;
    // Balanced: 1 billion USD cost ~= 500 hours transit delay
    return costBillion * 1000 + timeHours * 2.0;
  }

  let finalState: PathState | null = null;

  while (queue.length > 0) {
    // Pop minimum weight state
    queue.sort((a, b) => a.weight - b.weight);
    const current = queue.shift()!;

    if (current.nodeId === destinationNodeId) {
      finalState = current;
      break;
    }

    const currentKey = stateKey(current.nodeId, current.incomingRouteType);
    const existingBest = bestScores.get(currentKey);
    if (existingBest !== undefined && existingBest < current.weight) {
      continue;
    }

    const outgoingSegments = adjacency.get(current.nodeId) ?? [];
    for (const seg of outgoingSegments) {
      let transferPenaltyCost = 0;
      let transferDelay = 0;
      let transferStep: MultiModalTransferStep | null = null;

      // Modal transfer check
      if (current.incomingRouteType && current.incomingRouteType !== seg.routeType) {
        const transfer: IntermodalTransferResult = calculateIntermodalTransfer({
          fromType: current.incomingRouteType,
          toType: seg.routeType,
          volumeTons: cargoWeightTons,
        });

        if (!transfer.isCompatible) {
          continue; // Incompatible physical transition (e.g. pipeline to rail)
        }

        transferPenaltyCost = transfer.transferCostBillion;
        transferDelay = transfer.transferDelayHours;
        transferStep = {
          atNodeId: current.nodeId,
          hubType: transfer.hubTypeRequired,
          fromType: current.incomingRouteType,
          toType: seg.routeType,
          fromFamily: getRouteFamily(current.incomingRouteType),
          toFamily: getRouteFamily(seg.routeType),
          transferCostBillion: transfer.transferCostBillion,
          transferDelayHours: transfer.transferDelayHours,
          description: transfer.description,
        };
      }

      const modalFamily = getRouteFamily(seg.routeType);
      const segSpeed = seg.speedKmh ?? DEFAULT_SPEED_KMH[seg.routeType] ?? 60;
      const transitTime = seg.distanceKm / Math.max(1, segSpeed);
      const transitCost = calculateTransitCostBillion(modalFamily, seg.distanceKm, cargoWeightTons);

      const nextCost =
        Math.round((current.accumCostBillion + transitCost + transferPenaltyCost) * 100000) / 100000;
      const nextTime =
        Math.round((current.accumTimeHours + transitTime + transferDelay) * 100) / 100;
      const nextDist = Math.round((current.accumDistanceKm + seg.distanceKm) * 100) / 100;
      const nextWeight = calculatePriorityWeight(nextCost, nextTime);

      const nextKey = stateKey(seg.toNodeId, seg.routeType);
      const recordedScore = bestScores.get(nextKey);

      if (recordedScore === undefined || nextWeight < recordedScore) {
        bestScores.set(nextKey, nextWeight);
        const routeStep: MultiModalRouteStep = {
          segmentId: seg.id,
          fromNodeId: current.nodeId,
          toNodeId: seg.toNodeId,
          routeType: seg.routeType,
          modalFamily,
          distanceKm: seg.distanceKm,
          costBillion: transitCost,
          transitTimeHours: Math.round(transitTime * 100) / 100,
        };

        queue.push({
          nodeId: seg.toNodeId,
          incomingRouteType: seg.routeType,
          accumCostBillion: nextCost,
          accumTimeHours: nextTime,
          accumDistanceKm: nextDist,
          weight: nextWeight,
          prev: current,
          stepTaken: routeStep,
          transferTaken: transferStep,
        });
      }
    }
  }

  if (!finalState) {
    return {
      found: false,
      totalDistanceKm: 0,
      totalCostBillion: 0,
      totalTransitTimeHours: 0,
      pathNodeIds: [],
      steps: [],
      transfers: [],
    };
  }

  // Reconstruct path
  const steps: MultiModalRouteStep[] = [];
  const transfers: MultiModalTransferStep[] = [];
  const pathNodeIds: string[] = [];

  let curr: PathState | null = finalState;
  while (curr) {
    pathNodeIds.unshift(curr.nodeId);
    if (curr.stepTaken) {
      steps.unshift(curr.stepTaken);
    }
    if (curr.transferTaken) {
      transfers.unshift(curr.transferTaken);
    }
    curr = curr.prev;
  }

  return {
    found: true,
    totalDistanceKm: finalState.accumDistanceKm,
    totalCostBillion: Math.round(finalState.accumCostBillion * 1000) / 1000,
    totalTransitTimeHours: Math.round(finalState.accumTimeHours * 10) / 10,
    pathNodeIds,
    steps,
    transfers,
  };
}

/**
 * Inspects all nodes and connected segments in the network to identify
 * multi-modal freight junctions and intermodal transport terminals.
 */
export function detectIntermodalHubs(
  nodes: MultiModalNode[],
  segments: MultiModalSegment[]
): IntermodalHubSummary[] {
  const nodeConnections = new Map<string, Set<string>>();

  for (const seg of segments) {
    const fromSet = nodeConnections.get(seg.fromNodeId) ?? new Set<string>();
    fromSet.add(seg.routeType);
    nodeConnections.set(seg.fromNodeId, fromSet);

    const toSet = nodeConnections.get(seg.toNodeId) ?? new Set<string>();
    toSet.add(seg.routeType);
    nodeConnections.set(seg.toNodeId, toSet);
  }

  const hubs: IntermodalHubSummary[] = [];

  for (const node of nodes) {
    const routeTypes = Array.from(nodeConnections.get(node.id) ?? []);
    const familiesSet = new Set<ModalFamily>();

    for (const r of routeTypes) {
      familiesSet.add(getRouteFamily(r));
    }

    const families = Array.from(familiesSet);
    const isIntermodal = families.length > 1;

    let inferredHubType: "port" | "station" | "airport" | "junction" | "interchange" =
      node.hubType ?? "junction";

    if (!node.hubType) {
      if (families.includes("maritime")) inferredHubType = "port";
      else if (families.includes("air")) inferredHubType = "airport";
      else if (families.includes("rail")) inferredHubType = "station";
      else if (routeTypes.some((r) => ["motorway", "highway"].includes(r))) {
        inferredHubType = "interchange";
      }
    }

    hubs.push({
      nodeId: node.id,
      lat: node.lat,
      lng: node.lng,
      name: node.name,
      hubType: inferredHubType,
      connectedFamilies: families,
      connectedRouteTypes: routeTypes,
      isIntermodal,
    });
  }

  return hubs;
}
