/**
 * Statecraft — whip count (Stage 3, S3.A). The Politics SEE step.
 *
 * Fogs a real, deterministic vote projection (`tallyVote`) by the government's standing
 * (approval). Strong standing → you see the exact floor count; middling → only a
 * direction; weak → your whips can't read the room. Never fabricates — the projection is
 * real, only its sharpness is gated. Mirrors the domestic/diplomacy never-lie fog.
 * See plans/statecraft-stage3.md.
 *
 * Pure: no DB, no React. Caller passes the tally + a 0-100 standing.
 */

import type { VoteResult } from "./legislative-vote";

export type WhipLevel = "revealed" | "questioned" | "greyed";
export type WhipVerdict =
  | "pass"
  | "fail"
  | "leaning_pass"
  | "leaning_fail"
  | "too_close"
  | "unknown";

export interface WhipReading {
  level: WhipLevel;
  verdict: WhipVerdict;
  caption: string;
  // Exact figures only when revealed (strong standing).
  yesSeats?: number;
  noSeats?: number;
  margin?: number;
}

export function fogVoteProjection(result: VoteResult, standing: number): WhipReading {
  if (standing >= 60) {
    return {
      level: "revealed",
      verdict: result.passed ? "pass" : "fail",
      caption: result.passed
        ? "Whips project the bill carries the floor."
        : "Whips project the bill fails on the floor.",
      yesSeats: result.yesSeats,
      noSeats: result.noSeats,
      margin: result.margin,
    };
  }
  if (standing >= 35) {
    const cast = result.yesSeats + result.noSeats || 1;
    const lead = Math.abs(result.margin) / cast; // 0..1
    if (lead < 0.05) {
      return { level: "questioned", verdict: "too_close", caption: "Too close to call." };
    }
    return {
      level: "questioned",
      verdict: result.passed ? "leaning_pass" : "leaning_fail",
      caption: result.passed ? "Leaning toward passage." : "Leaning toward defeat.",
    };
  }
  return {
    level: "greyed",
    verdict: "unknown",
    caption: "Your whips can't read the floor — too little standing with the parties.",
  };
}
