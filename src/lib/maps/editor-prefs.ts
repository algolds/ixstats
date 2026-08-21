/**
 * editor-prefs — Simple localStorage-backed editor preference module.
 *
 * Keeps pure geometry libraries (border-editor.ts) free of localStorage.
 * Read prefs at the call site, not inside the geometry helpers.
 *
 * Keys are prefixed "ixeditor." to avoid collisions.
 */

const PREFS_KEY = "ixeditor-snap-enabled";
const TOLERANCE_KEY = "ixeditor-snap-tolerance";
const DEFAULT_ENABLED = true;
const DEFAULT_TOLERANCE = 0.015; // ~1.7 km at equator

const memoryStore: Record<string, string> = {};

// --- Snap enabled ---

export function getSnapEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw === null) return DEFAULT_ENABLED;
      return raw !== "false";
    }
    const mem = memoryStore[PREFS_KEY];
    if (mem === undefined) return DEFAULT_ENABLED;
    return mem !== "false";
  } catch {
    return DEFAULT_ENABLED;
  }
}

export function setSnapEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PREFS_KEY, String(enabled));
    }
    memoryStore[PREFS_KEY] = String(enabled);
  } catch {
    /* quota / private-browsing — silently ignore */
  }
}

// --- Snap tolerance (degrees) ---

export function getSnapTolerance(): number {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(TOLERANCE_KEY);
      if (raw === null) return DEFAULT_TOLERANCE;
      const n = parseFloat(raw);
      if (isNaN(n) || n <= 0) return DEFAULT_TOLERANCE;
      return n;
    }
    const mem = memoryStore[TOLERANCE_KEY];
    if (mem === undefined) return DEFAULT_TOLERANCE;
    const n = parseFloat(mem);
    if (isNaN(n) || n <= 0) return DEFAULT_TOLERANCE;
    return n;
  } catch {
    return DEFAULT_TOLERANCE;
  }
}

export function setSnapTolerance(tolerance: number): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TOLERANCE_KEY, String(tolerance));
    }
    memoryStore[TOLERANCE_KEY] = String(tolerance);
  } catch {
    /* quota / private-browsing — silently ignore */
  }
}
