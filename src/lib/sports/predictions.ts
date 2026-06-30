import type { PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import { exchangeService } from "../exchange-service";

export type PredictionOutcome = "home" | "away" | "draw";

export function outcomeFromScores(homeScore: number, awayScore: number): PredictionOutcome {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export interface PoolEntry {
  id: string;
  outcome: PredictionOutcome | string;
  stake: number;
}
export interface Settlement {
  id: string;
  status: "won" | "lost" | "void";
  payout: number;
}

/**
 * Pure parimutuel settlement. Winners split the whole pool pro-rata; if nobody
 * picked the actual outcome, everyone is refunded (void).
 */
export function computeParimutuel(entries: PoolEntry[], outcome: PredictionOutcome): Settlement[] {
  const totalPool = entries.reduce((s, e) => s + e.stake, 0);
  const winningPool = entries.filter((e) => e.outcome === outcome).reduce((s, e) => s + e.stake, 0);

  return entries.map((e) => {
    if (winningPool === 0) return { id: e.id, status: "void", payout: e.stake };
    if (e.outcome === outcome) {
      return { id: e.id, status: "won", payout: (e.stake * totalPool) / winningPool };
    }
    return { id: e.id, status: "lost", payout: 0 };
  });
}

/**
 * Settle all open predictions for a resolved match as a parimutuel pool: winners
 * split the entire stake pool pro-rata to their stake. If nobody picked the actual
 * outcome, every stake is refunded (void).
 *
 * Idempotent — only touches predictions still in "open", so re-running (both sim
 * paths, retries) can never double-pay. Best-effort; never throws into the sim.
 *
 * ponytail: no house rake — simplest fair pool. Add a rake here if a sink is needed.
 */
export async function resolveMatchPredictions(
  prisma: PrismaClient,
  matchId: string,
  outcome: PredictionOutcome
): Promise<void> {
  try {
    const open = await prisma.sportPrediction.findMany({ where: { matchId, status: "open" } });
    if (open.length === 0) return;

    const now = IxTime.getCurrentIxTime();
    const settlements = computeParimutuel(open, outcome);
    const userById = new Map(open.map((p) => [p.id, p.userId]));

    for (const s of settlements) {
      if (s.payout > 0) {
        const earnResult = await exchangeService.earn(
          userById.get(s.id)!,
          s.payout,
          "PREDICTION_PAYOUT",
          `PREDICTION_${s.status === "void" ? "REFUND" : "WIN"}:${s.id}`,
          prisma
        );
        if (!earnResult.success) {
          throw new Error(
            earnResult.message ??
              `Failed to credit prediction payout for user ${userById.get(s.id)!}`
          );
        }
      }
      await prisma.sportPrediction.update({
        where: { id: s.id },
        data: { status: s.status, payout: s.payout, resolvedIxTime: now },
      });
    }
  } catch (err) {
    console.error("[resolveMatchPredictions] failed:", err);
  }
}
