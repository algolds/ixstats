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
 * Coercive tools (sanction, embargo, blockade) hit the target hardest and cost the initiator
 * less, both scaled by relative economic size (`coerciveImpact`).
 *
 * Pure: no DB, no React. Caller passes the two countries' stats.
 */
import { clamp } from "~/lib/utils";

type FPActionType = "embargo" | "sanction" | "free_trade" | "military_alliance" | "blockade";
type FPSeverity = "light" | "moderate" | "severe";

export interface FPParty {
  gdpPerCapita: number;
  population: number;
}

interface FPImpact {
  initiatorGdpImpact: number; // fractional GDP level delta, e.g. -0.01 = -1%
  targetGdpImpact: number;
  relationshipDelta: number; // integer points
  category: "trade" | "military";
}

/**
 * Coercive tools: the target's GDP level hit for equal economies at moderate severity. The
 * initiator pays `COERCION_COST_SHARE` of that (its lost trade). Blockades also cost a naval
 * operation, so they are dearest.
 */
const COERCIVE_TARGET_HIT = { sanction: 0.01, embargo: 0.015, blockade: 0.025 } as const;
const COERCION_COST_SHARE = 0.25;

/**
 * How hard the target is hit and what the initiator pays, scaled by relative economic size.
 * Leverage is sqrt(initiator GDP / target GDP), clamped to 0.5-2: a larger initiator hits harder
 * and pays relatively less; a smaller one hits softer and pays more. The initiator's cost is
 * `COERCION_COST_SHARE / leverage²` of the target's hit, at most equal to it, so the target always
 * takes the main hit (equal economies: target -1%, initiator -0.25% for a moderate sanction).
 */
function coerciveImpact(
  hit: number,
  gdp1: number,
  gdp2: number,
  severityMultiplier: number
): { initiator: number; target: number } {
  const leverage = clamp(Math.sqrt(gdp1 / gdp2), 0.5, 2);
  const target = hit * severityMultiplier * leverage;
  return { target: -target, initiator: -(target * COERCION_COST_SHARE) / leverage ** 2 };
}

export function computeForeignPolicyImpact(args: {
  initiator: FPParty;
  target: FPParty;
  actionType: FPActionType;
  severity?: FPSeverity;
}): FPImpact {
  const { initiator, target, actionType } = args;
  const severity = args.severity ?? "moderate";

  const gdp1 = (initiator.gdpPerCapita || 10000) * (initiator.population || 1_000_000);
  const gdp2 = (target.gdpPerCapita || 10000) * (target.population || 1_000_000);

  const severityMultiplier = severity === "light" ? 0.5 : severity === "severe" ? 1.5 : 1.0;

  // Relative development: >1 means the target is richer per capita than the initiator.
  const devRatio = (target.gdpPerCapita || 10000) / (initiator.gdpPerCapita || 10000);
  // Trade with a richer partner is more lucrative for you; clamp so extremes stay sane.
  const initiatorGain = clamp(Math.sqrt(devRatio), 0.5, 2.0);
  const targetGain = clamp(Math.sqrt(1 / devRatio), 0.5, 2.0);
  // Imbalance (0 = equal partners, grows with the gap) — boosts cooperative relations.
  const imbalance = clamp(Math.abs(Math.log(devRatio)), 0, 1.5);

  switch (actionType) {
    case "embargo":
    case "sanction":
    case "blockade": {
      const { initiator: initiatorGdpImpact, target: targetGdpImpact } = coerciveImpact(
        COERCIVE_TARGET_HIT[actionType],
        gdp1,
        gdp2,
        severityMultiplier
      );
      const relation = { sanction: -20, embargo: -25, blockade: -35 }[actionType];
      return {
        initiatorGdpImpact,
        targetGdpImpact,
        relationshipDelta: Math.round(relation * severityMultiplier),
        category: actionType === "blockade" ? "military" : "trade",
      };
    }
    case "free_trade":
      // Asymmetric by relative development (Keaor): richer partner → more GDP for you;
      // bigger imbalance → bigger relations boost (the poorer side gains more, warming ties).
      return {
        initiatorGdpImpact: 0.003 * severityMultiplier * initiatorGain,
        targetGdpImpact: 0.003 * severityMultiplier * targetGain,
        relationshipDelta: Math.round(15 * severityMultiplier * (1 + imbalance)),
        category: "trade",
      };
    case "military_alliance":
      return {
        initiatorGdpImpact: 0.001,
        targetGdpImpact: 0.001,
        relationshipDelta: Math.round(20 * (1 + imbalance * 0.5)),
        category: "military",
      };
  }
}
