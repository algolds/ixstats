import type { PrismaClient } from "@prisma/client";
import { exchangeService } from "~/lib/vault/exchange-service";

type PredictionOutcome = "home" | "away" | "draw";

/** Stake bounds (whole Sovereigns) for a single prediction. */
export const MIN_PREDICTION_STAKE = 1;
export const MAX_PREDICTION_STAKE = 10_000;

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
interface Settlement {
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
 * Idempotent: each prediction is claimed (moved out of "open" by a conditional
 * update) in the same transaction as its payout, and only the settlement that moved
 * it pays it; the payout also carries the prediction's idempotency key. So two
 * settlements racing (both sim paths, retries) can never double-pay. Best-effort;
 * never throws into the sim.
 *
 * ponytail: no house rake — simplest fair pool. Add a rake here if a sink is needed.
 */
export async function resolveMatchPredictions(
  prisma: PrismaClient,
  matchId: string,
  outcome: PredictionOutcome
): Promise<void> {
  if (!prisma || typeof (prisma as any).sportPrediction?.findMany !== "function") {
    return;
  }
  try {
    const open = await prisma.sportPrediction.findMany({ where: { matchId, status: "open" } });
    if (open.length === 0) return;

    const now = Date.now();
    const settlements = computeParimutuel(open, outcome);
    const userById = new Map(open.map((p) => [p.id, p.userId]));

    for (const s of settlements) {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.sportPrediction.updateMany({
          where: { id: s.id, status: "open" },
          data: { status: s.status, payout: s.payout, resolvedIxTime: now },
        });
        if (claimed.count !== 1 || s.payout <= 0) return;
        const source = `PREDICTION_${s.status === "void" ? "REFUND" : "WIN"}:${s.id}`;
        const earnResult = await exchangeService.earn(
          userById.get(s.id)!,
          s.payout,
          "PREDICTION_PAYOUT",
          source,
          tx,
          undefined,
          { idempotencyKey: source }
        );
        if (!earnResult.success) {
          throw new Error(
            earnResult.message ??
              `Failed to credit prediction payout for user ${userById.get(s.id)!}`
          );
        }
      });
    }
  } catch (err) {
    console.error("[resolveMatchPredictions] failed:", err);
  }
}
