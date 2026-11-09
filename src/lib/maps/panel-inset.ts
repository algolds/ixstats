/**
 * Pixels of the map's right side under a panel floating over it: from md up the panel overlaps
 * the map; when stacked (phones), the rects do not overlap and the inset is 0.
 */
export function coveredRight(
  map: DOMRectReadOnly | null,
  panel: DOMRectReadOnly | null
): number {
  if (!map || !panel) return 0;
  const overlaps =
    panel.top < map.bottom &&
    panel.bottom > map.top &&
    panel.left < map.right &&
    panel.right > map.left;
  return overlaps ? Math.round(map.right - panel.left) : 0;
}
