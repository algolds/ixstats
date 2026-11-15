export interface PartyElectionResultRow {
  partyId: string;
  partyName: string;
  color: string;
  votePercentage: number;
  seatsWon: number;
}

/**
 * Collapse candidate-level `ElectionResult` rows into one row per party, ordered by seats won
 * then vote share. Legacy elections that registered multiple candidates under one party recorded
 * each candidate's own `votePercentage` while writing the party's total `seatsWon` onto each row.
 */
export function collapseResultsByParty(
  rows: readonly PartyElectionResultRow[]
): PartyElectionResultRow[] {
  const byParty = new Map<string, PartyElectionResultRow>();
  for (const row of rows) {
    const existing = byParty.get(row.partyId);
    if (!existing) {
      byParty.set(row.partyId, { ...row });
      continue;
    }
    existing.votePercentage = Math.min(
      100,
      Math.round((existing.votePercentage + row.votePercentage) * 100) / 100
    );
    existing.seatsWon = Math.max(existing.seatsWon, row.seatsWon);
  }
  return [...byParty.values()].sort(
    (a, b) => b.seatsWon - a.seatsWon || b.votePercentage - a.votePercentage
  );
}
