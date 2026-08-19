/**
 * Statecraft — foreign-policy effect computation (Stage 2, S2.A).
 *
 * One pure function for a foreign-policy action's economic + relational impact, used by
 * BOTH the preview query and the propose mutation (was duplicated in foreignPolicy.ts).
 *
 * The interconnect insight (Keaor): effects scale by the *target's relative stats*, not
 * flat constants. Free trade with a richer partner gives you more GDP; with a poorer one
 * it gives you less GDP but a bigger relations boost — the imbalance benefits the poorer
 * side more, which improves the relationship. See plans/statecraft-stage2.md.
 *
 * Pure: no DB, no React. Caller passes the two countries' stats + bilateral trade.
 */

export type FPActionType = "embargo" | "sanction" | "free_trade" | "military_alliance" | "blockade";
export type FPSeverity = "light" | "moderate" | "severe";

export interface FPParty {
  gdpPerCapita: number;
  population: number;
}

export interface FPImpact {
  initiatorGdpImpact: number; // fractional GDP delta, e.g. 0.003 = +0.3%
  targetGdpImpact: number;
  relationshipDelta: number; // integer points
  category: "trade" | "military";
  initiatorTradeExposure: number; // tradeVol / initiatorGdp
  targetTradeExposure: number;
}

import { clamp } from "~/lib/utils";

export function computeForeignPolicyImpact(args: {
  initiator: FPParty;
  target: FPParty;
  actionType: FPActionType;
  severity?: FPSeverity;
  tradeVolume?: number;
}): FPImpact {
  const { initiator, target, actionType } = args;
  const severity = args.severity ?? "moderate";

  const gdp1 = (initiator.gdpPerCapita || 10000) * (initiator.population || 1_000_000);
  const gdp2 = (target.gdpPerCapita || 10000) * (target.population || 1_000_000);

  const tradeVol = args.tradeVolume ?? Math.sqrt(gdp1 * gdp2) * 0.0005;
  const tradeShare1 = gdp1 > 0 ? tradeVol / gdp1 : 0.01;
  const tradeShare2 = gdp2 > 0 ? tradeVol / gdp2 : 0.01;

  const severityMultiplier = severity === "light" ? 0.5 : severity === "severe" ? 1.5 : 1.0;

  // Relative development: >1 means the target is richer per capita than the initiator.
  const devRatio = (target.gdpPerCapita || 10000) / (initiator.gdpPerCapita || 10000);
  // Trade with a richer partner is more lucrative for you; clamp so extremes stay sane.
  const initiatorGain = clamp(Math.sqrt(devRatio), 0.5, 2.0);
  const targetGain = clamp(Math.sqrt(1 / devRatio), 0.5, 2.0);
  // Imbalance (0 = equal partners, grows with the gap) — boosts cooperative relations.
  const imbalance = clamp(Math.abs(Math.log(devRatio)), 0, 1.5);

  let initiatorGdpImpact = 0;
  let targetGdpImpact = 0;
  let relationshipDelta = 0;
  let category: "trade" | "military" = "trade";

  switch (actionType) {
    case "embargo":
      initiatorGdpImpact = -(tradeShare1 * 0.015 * severityMultiplier);
      targetGdpImpact = -(tradeShare2 * 0.02 * severityMultiplier);
      relationshipDelta = Math.round(-25 * severityMultiplier);
      break;
    case "sanction":
      initiatorGdpImpact = -0.005 * severityMultiplier;
      targetGdpImpact = -(tradeShare2 * 0.015 * severityMultiplier);
      relationshipDelta = Math.round(-20 * severityMultiplier);
      break;
    case "free_trade":
      // Asymmetric by relative development (Keaor): richer partner → more GDP for you;
      // bigger imbalance → bigger relations boost (the poorer side gains more, warming ties).
      initiatorGdpImpact = 0.003 * severityMultiplier * initiatorGain;
      targetGdpImpact = 0.003 * severityMultiplier * targetGain;
      relationshipDelta = Math.round(15 * severityMultiplier * (1 + imbalance));
      break;
    case "military_alliance":
      initiatorGdpImpact = 0.001;
      targetGdpImpact = 0.001;
      relationshipDelta = Math.round(20 * (1 + imbalance * 0.5));
      category = "military";
      break;
    case "blockade":
      // NOTE: military/geo scaling (projection vs navy + coastline) is a deferred ticket;
      // for now scale the target hit by their trade exposure like the other coercive tools.
      initiatorGdpImpact = -0.008 * severityMultiplier;
      targetGdpImpact = -(tradeShare2 * 0.03 * severityMultiplier);
      relationshipDelta = Math.round(-35 * severityMultiplier);
      category = "military";
      break;
  }

  return {
    initiatorGdpImpact,
    targetGdpImpact,
    relationshipDelta,
    category,
    initiatorTradeExposure: tradeShare1,
    targetTradeExposure: tradeShare2,
  };
}
