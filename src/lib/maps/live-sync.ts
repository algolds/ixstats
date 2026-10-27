/**
 * How a map reads a live-sync event (`map_data_changed` from /api/sse/map-updates, written by
 * src/lib/maps/map-update-bus.ts): which realm it belongs to, and which of the map's queries it makes stale.
 *
 * The layers are not among them. They follow the realm's map version, so a "version" event (a realm's map version
 * moved) refetches the version and the new URLs bring the new layers; every other event refetches data the layers
 * do not carry.
 */

/** A map's queries that live sync refetches. */
export type MapSyncQuery = "version" | "markers" | "detail" | "storyPins" | "labels" | "country";

export interface MapSyncEvent {
  changeType: string;
  /** The realm the change happened in; absent: every realm. */
  realmId?: string;
}

const ALL_QUERIES: readonly MapSyncQuery[] = [
  "version",
  "markers",
  "detail",
  "storyPins",
  "labels",
  "country",
];

/**
 * What each change type makes stale. "country" is the open country's own queries (features, geometry, geo bundle),
 * which a change to any of its map data touches; they cost nothing while no country is open. A change type not
 * listed refetches everything.
 */
const QUERIES_BY_CHANGE: Record<string, readonly MapSyncQuery[]> = {
  version: ["version"],
  city: ["markers", "detail", "country"],
  "cities-distribution": ["markers", "detail", "country"],
  subdivision: ["detail", "country"],
  poi: ["markers", "country"],
  storyPin: ["storyPins", "country"],
  mapLabel: ["labels", "country"],
  peak: ["country"],
  river: ["country"],
  lake: ["country"],
  borders: ["country"],
  linkage: ["country"],
  sovereignty: ["country"],
  "rollup-mode": ["country"],
  "national-rebase": ["country"],
};

export function queriesFor(changeType: string): readonly MapSyncQuery[] {
  return QUERIES_BY_CHANGE[changeType] ?? ALL_QUERIES;
}

/** The event off the stream's JSON. A payload that cannot be read is an unknown change in every realm. */
export function parseMapSyncEvent(data: string): MapSyncEvent {
  try {
    const { changeType, realmId } = JSON.parse(data) as Partial<MapSyncEvent>;
    return {
      changeType: typeof changeType === "string" ? changeType : "unknown",
      ...(typeof realmId === "string" && { realmId }),
    };
  } catch {
    return { changeType: "unknown" };
  }
}

/** True unless the event is another realm's. Until the viewer's realm is known, nothing is another realm's. */
export function isForRealm(event: MapSyncEvent, viewerRealmId: string | undefined): boolean {
  return !event.realmId || !viewerRealmId || event.realmId === viewerRealmId;
}
