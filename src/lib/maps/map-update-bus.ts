/**
 * Map Update Event Bus
 *
 * In-memory event emitter for broadcasting map data changes within the Node.js process.
 * Used by geo router mutations to notify SSE clients of map updates.
 *
 * This enables real-time map sync without requiring a separate WebSocket server process.
 * Works within Next.js standalone deployment (no custom server needed).
 */

type MapUpdateListener = (event: MapUpdateEvent) => void;

export interface MapUpdateEvent {
  type: "map_data_changed";
  /**
   * What changed: city, subdivision, poi, storyPin, mapLabel, borders, sovereignty, linkage, bulk; "version" when a
   * realm's map version moved (src/server/shared/map-invalidation.ts announces it)
   */
  changeType: string;
  /** Optional country ID for targeted invalidation */
  countryId?: string;
  /** The realm the change happened in; viewers of other realms ignore it. Absent: every realm (or see countryId). */
  realmId?: string;
  timestamp: number;
}

class MapUpdateBus {
  private listeners: Set<MapUpdateListener> = new Set();

  subscribe(listener: MapUpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: MapUpdateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[MapUpdateBus] Listener error:", err);
      }
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

// Singleton — one bus per Node.js process
export const mapUpdateBus = new MapUpdateBus();

/**
 * Helper to broadcast a map data change from any tRPC mutation or server function. Name the realm when the writer
 * knows it; the live-sync stream otherwise takes it from `countryId` (map-event-realm.ts).
 */
export function broadcastMapUpdate(changeType: string, countryId?: string, realmId?: string): void {
  mapUpdateBus.emit({
    type: "map_data_changed",
    changeType,
    countryId,
    realmId,
    timestamp: Date.now(),
  });
}
