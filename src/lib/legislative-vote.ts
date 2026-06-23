/**
 * Legislative vote engine — pure, deterministic.
 *
 * A bill carries an ideological target on the standard left↔right axis. Each party
 * votes its ideology: aligned parties back it, distant parties oppose, the middle
 * abstains. Seats weight the tally. No randomness so the result is reproducible and
 * the breakdown is explainable in-world ("the Conservatives killed it on the floor").
 *
 * ponytail: parties vote pure ideology — no whips, coalitions, or party discipline.
 * Add a cohesion/whip factor here if votes ever need to feel negotiated.
 */

export const IDEOLOGY_AXIS = {
  far_left: -3,
  left: -2,
  center_left: -1,
  center: 0,
  center_right: 1,
  right: 2,
  far_right: 3,
} as const;

export type Ideology = keyof typeof IDEOLOGY_AXIS;

export interface VotingBloc {
  partyId: string;
  partyName: string;
  ideology: Ideology;
  seats: number;
}

export type Vote = "yes" | "no" | "abstain";

export interface PartyVote extends VotingBloc {
  vote: Vote;
  /** ideological distance from the bill, 0 (perfect) … 6 (opposite) */
  distance: number;
}

export interface VoteResult {
  passed: boolean;
  yesSeats: number;
  noSeats: number;
  abstainSeats: number;
  totalSeats: number;
  /** yesSeats − noSeats; positive means the bill carried */
  margin: number;
  breakdown: PartyVote[];
}

/** A party within 1 step backs the bill, exactly 2 steps away abstains, ≥3 opposes. */
function decide(distance: number): Vote {
  if (distance <= 1) return "yes";
  if (distance === 2) return "abstain";
  return "no";
}

/**
 * Tally a floor vote. `billTarget` is the bill's position on IDEOLOGY_AXIS (-3…3).
 * A bill passes on a simple majority of votes cast (yes > no); abstentions don't count.
 */
export function tallyVote(billTarget: number, blocs: VotingBloc[]): VoteResult {
  const breakdown: PartyVote[] = blocs.map((b) => {
    const distance = Math.abs(billTarget - IDEOLOGY_AXIS[b.ideology]);
    return { ...b, distance, vote: decide(distance) };
  });

  let yesSeats = 0;
  let noSeats = 0;
  let abstainSeats = 0;
  for (const pv of breakdown) {
    if (pv.vote === "yes") yesSeats += pv.seats;
    else if (pv.vote === "no") noSeats += pv.seats;
    else abstainSeats += pv.seats;
  }

  return {
    passed: yesSeats > noSeats,
    yesSeats,
    noSeats,
    abstainSeats,
    totalSeats: yesSeats + noSeats + abstainSeats,
    margin: yesSeats - noSeats,
    breakdown,
  };
}
