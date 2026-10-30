/** Pure ordering helpers for the account manager's drag-to-reorder list. */

/** `items` in the order of `ids`; items not in `ids` keep their relative order after it. `null` keeps `items` as is. */
export function orderByIds<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[] | null
): T[] {
  if (!ids) return [...items];
  const rank = (item: T) => {
    const at = ids.indexOf(item.id);
    return at === -1 ? ids.length : at;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/**
 * `allIds` with the ids in `visibleIds` reordered into the slots they already occupy, so reordering
 * a filtered view leaves the hidden accounts where they were.
 */
export function mergeVisibleOrder(
  allIds: readonly string[],
  visibleIds: readonly string[]
): string[] {
  const shown = new Set(visibleIds);
  const queue = [...visibleIds];
  return allIds.map((id) => (shown.has(id) ? (queue.shift() ?? id) : id));
}

/** `ids` with `id` moved `delta` places (clamped to the ends); unchanged when `id` is absent. */
export function moveId(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  const to = Math.min(ids.length - 1, Math.max(0, from + delta));
  const next = ids.filter((other) => other !== id);
  next.splice(to, 0, id);
  return next;
}
