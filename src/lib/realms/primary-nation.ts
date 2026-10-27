/** The primary nation: the linked `User.countryId` when it is held, else the highest-GDP held nation. */
export function primaryNationOf<T extends { id: string; currentTotalGdp: number }>(
  nations: readonly T[],
  linkedCountryId: string | null
): T | null {
  const linked = nations.find((n) => n.id === linkedCountryId);
  if (linked) return linked;
  return nations.reduce<T | null>(
    (best, n) => (best && best.currentTotalGdp >= n.currentTotalGdp ? best : n),
    null
  );
}
