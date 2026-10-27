/**
 * The /maps viewer used to keep its layers in an IndexedDB database of its own (about 1.6 MB per browser). Layers now
 * come from the browser's HTTP cache, which the versioned layer URLs fill, so that database is dead weight: delete it
 * once. Safe to remove in a later release, when every browser that had one has visited.
 */

const LEGACY_DB = "ixworld-map-cache";

let requested = false;

/** Asks the browser to delete the retired layer database. Fire and forget; at most one request per page load. */
export function dropLegacyMapCache(): void {
  if (requested || typeof indexedDB === "undefined") return;
  requested = true;
  try {
    indexedDB.deleteDatabase(LEGACY_DB);
  } catch {
    // Blocked storage (private mode): there is nothing of ours to clean
  }
}
