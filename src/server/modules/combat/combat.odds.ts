/**
 * The odds screen's data (owner decision: stochastic with shown odds; intel as estimates with error bands). The
 * attacker sees its own side exactly and the enemy through its intelligence: strength, odds and band probabilities as
 * ranges, the factor breakdown, and a 1,000-run preview drawn over the estimate. True enemy values never leave here.
 */
import type { PrismaClient } from "@prisma/client";
import {
  RECON_WINDOW_DAYS,
  intelSigma,
  oddsView,
  previewCampaign,
  type CampaignPreview,
  type EngagementMode,
  type OddsView,
  type Theatre,
} from "~/lib/military/combat";
import { DAY_MS } from "~/lib/military/model";
import { buildEngagement, normaliseOrders } from "./combat.engagement";
import { intelDraw, previewSeed } from "./combat.seed";

export interface CombatOdds {
  mode: EngagementMode;
  target: { id: string; name: string };
  commitment: number;
  days: number;
  theatre: Theatre;
  odds: OddsView;
  preview: CampaignPreview;
  intel: { relationStrength: number | null; recon: boolean };
}

async function intelSources(db: PrismaClient, viewerId: string, targetId: string, clockMs: number) {
  const [relation, recon] = await Promise.all([
    db.diplomaticRelation.findFirst({
      where: {
        OR: [
          { country1: viewerId, country2: targetId },
          { country1: targetId, country2: viewerId },
        ],
      },
      select: { strength: true },
    }),
    db.militaryOperation.findFirst({
      where: {
        countryId: viewerId,
        targetCountryId: targetId,
        operationType: "reconnaissance",
        OR: [{ status: "active" }, { endIxTime: { gte: clockMs - RECON_WINDOW_DAYS * DAY_MS } }],
      },
      select: { id: true },
    }),
  ]);
  return { relationStrength: relation?.strength ?? null, recon: recon !== null };
}

/** The attacker's view of an engagement it is considering. */
export async function combatOdds(
  db: PrismaClient,
  input: { attackerId: string; defenderId: string; mode: EngagementMode; commitment?: number; days: number }
): Promise<CombatOdds> {
  const orders = normaliseOrders(input);
  const engagement = await buildEngagement(db, orders);
  const now = engagement.attacker.nowClockMs;
  const intel = await intelSources(db, input.attackerId, input.defenderId, now);
  const sigma = intelSigma({
    rdStock: engagement.attacker.state.policy.rdStock,
    gdp: engagement.attacker.econ.gdp,
    ...intel,
  });
  const u = intelDraw(input.attackerId, input.defenderId, now);
  return {
    mode: orders.mode,
    target: { id: engagement.defender.country.id, name: engagement.defender.country.name },
    commitment: orders.commitment,
    days: orders.days,
    theatre: engagement.setup.theatre,
    odds: oddsView(engagement.setup, sigma, u),
    preview: previewCampaign({
      setup: engagement.setup,
      sigma,
      u,
      seedHex: previewSeed(input.attackerId, input.defenderId, now),
    }),
    intel,
  };
}
