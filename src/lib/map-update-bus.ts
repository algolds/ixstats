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
  /** What changed: city, subdivision, poi, storyPin, mapLabel, sovereignty, linkage, bulk */
  changeType: string;
  /** Optional country ID for targeted invalidation */
  countryId?: string;
  timestamp: number;
}

class MapUpdateBus {
  private listeners: Set<MapUpdateListener> = new Set();

  subscribe(listener: MapUpdateListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
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
 * Helper to broadcast a map data change from any tRPC mutation or server function.
 */
export function broadcastMapUpdate(changeType: string, countryId?: string): void {
  mapUpdateBus.emit({
    type: "map_data_changed",
    changeType,
    countryId,
    timestamp: Date.now(),
  });
}
