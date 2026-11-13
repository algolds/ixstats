/**
 * Picks `n` nations for exposure: a weighted random sample without replacement (Efraimidis–Spirakis), where a
 * nation's weight is 1 / (1 + its followers). The least-followed surface most often, yet every visit differs and
 * a popular nation can still appear.
 */
export function pickForExposure<T extends { followers: number }>(
  candidates: readonly T[],
  n: number,
  random: () => number = Math.random
): T[] {
  // The sampling key u^(1/w) with w = 1 / (1 + followers) is u^(1 + followers); the n largest keys win.
  return candidates
    .map((candidate) => ({ candidate, key: random() ** (1 + candidate.followers) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map(({ candidate }) => candidate);
}
