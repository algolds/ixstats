/** FNV-1a: a cheap, well-spread 32-bit hash for a seeded shuffle. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A realm's nations as the Nations tab lists them: the viewer's own first, then the rest in a shuffle that
 * `seed` (one per visit) holds steady while the viewer filters and scrolls.
 */
export function orderNations<T extends { id: string; mine: boolean }>(
  nations: readonly T[],
  seed: number
): T[] {
  const rank = (id: string) => hash(`${seed}:${id}`);
  return [...nations].sort((a, b) => Number(b.mine) - Number(a.mine) || rank(a.id) - rank(b.id));
}
