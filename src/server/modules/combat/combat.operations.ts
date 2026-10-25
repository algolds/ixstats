/**
 * Interventions on the combat model: sealed at launch (orders with the committed share of ground forces, the planned
 * days, the seed), resolved when they end against the target's real forces, with losses and economic effects.
 */
import type { MilitaryOperation, PrismaClient } from "@prisma/client";
import {
  GROUND_DOMAINS,
  interventionCommitment,
  resolveEngagement,
  type EngagementResult,
} from "~/lib/military/combat";
import { syncDefense } from "~/server/modules/defense";
import { buildEngagement, normaliseOrders, type EngagementOrders } from "./combat.engagement";
import { applyConsequences, resultData, sealOrders } from "./combat.commit";

/** Default planned days of an intervention with no duration (designer). */
export const DEFAULT_INTERVENTION_DAYS = 30;

/** The seal of an intervention at launch. */
export async function sealIntervention(
  db: PrismaClient,
  input: { operationId: string; countryId: string; targetId: string; personnel: number; days: number | null }
) {
  const snapshot = await syncDefense(db, input.countryId);
  const ground = snapshot.view.branches
    .filter((b) => GROUND_DOMAINS.includes(b.domain))
    .reduce((sum, b) => sum + b.personnel, 0);
  const orders = normaliseOrders({
    mode: "operation",
    attackerId: input.countryId,
    defenderId: input.targetId,
    commitment: interventionCommitment(input.personnel, ground),
    days: input.days ?? DEFAULT_INTERVENTION_DAYS,
  });
  return sealOrders(input.operationId, orders, snapshot.nowClockMs);
}

type SealedOperation = Pick<MilitaryOperation, "id" | "orders" | "seed">;

/** Resolve a sealed intervention on its stored seed, and apply the consequences. Null when it was never sealed. */
export async function resolveIntervention(
  db: PrismaClient,
  operation: SealedOperation
): Promise<{ result: EngagementResult; data: ReturnType<typeof resultData> } | null> {
  if (!operation.orders || !operation.seed) return null;
  const parsed: EngagementOrders = JSON.parse(operation.orders);
  const engagement = await buildEngagement(db, normaliseOrders(parsed));
  const result = resolveEngagement(engagement.setup, operation.seed);
  await applyConsequences(db, { battleKey: `operation:${operation.id}`, engagement, result });
  return { result, data: resultData(engagement, result, operation.seed) };
}
