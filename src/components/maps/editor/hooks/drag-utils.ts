export const HYSTERESIS_PX = 4;
export const NUDGE_SMALL = 0.001;
export const NUDGE_LARGE = 0.01;

export type DragAxis = "h" | "v" | "d";

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Checks if the screen distance between start and current points exceeds the hysteresis threshold.
 */
export function exceedsHysteresis(
  start: ScreenPoint,
  current: ScreenPoint,
  threshold: number = HYSTERESIS_PX
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return dx * dx + dy * dy >= threshold * threshold;
}

/**
 * Detects the dominant drag axis:
 * - 'h': Horizontal (predominantly along X)
 * - 'v': Vertical (predominantly along Y)
 * - 'd': Diagonal (around 45° angle)
 */
export function detectAxis(dx: number, dy: number): DragAxis {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx === 0 && absDy === 0) return "h";

  // Diagonal ratio threshold: roughly within 22.5° to 67.5° angle
  const ratio = Math.min(absDx, absDy) / Math.max(absDx, absDy);
  if (ratio > 0.414) {
    return "d";
  }

  return absDx >= absDy ? "h" : "v";
}

/**
 * Constrains coordinate movement to the locked axis relative to start coordinates.
 */
export function axisLock(
  startCoords: [number, number],
  currentCoords: [number, number],
  axis: DragAxis | null
): [number, number] {
  if (!axis) return currentCoords;

  const [startLng, startLat] = startCoords;
  const [currLng, currLat] = currentCoords;

  const dLng = currLng - startLng;
  const dLat = currLat - startLat;

  if (axis === "h") {
    return [currLng, startLat];
  }

  if (axis === "v") {
    return [startLng, currLat];
  }

  if (axis === "d") {
    // 45° diagonal projection: average absolute delta with original signs
    const signLng = dLng >= 0 ? 1 : -1;
    const signLat = dLat >= 0 ? 1 : -1;
    const avgDelta = (Math.abs(dLng) + Math.abs(dLat)) / 2;
    return [startLng + avgDelta * signLng, startLat + avgDelta * signLat];
  }

  return currentCoords;
}

/**
 * Checks if a keyboard or interaction event target is inside an editable input.
 */
export function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.getAttribute("contenteditable") === "true" ||
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}
