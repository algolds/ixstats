import { db } from "~/server/db";
import { CountryEventSpine } from "./country-event-spine";
import { NationalIssuesEngine } from "./national-issues-engine";
import { getNationalIssuesConfig } from "./national-issues-config";
import { INTENT_CATEGORY_TO_TEMPLATE, spawnResistanceForIntent } from "./intent/resistance";
import type { Category } from "./intent/assemble";

export interface PolicyMaintenanceResult {
  countriesProcessed: number;
  policiesProcessed: number;
  totalCostDebited: number;
  volatileSpawns: SpawnVolatileIssuesResult;
}

export interface SpawnVolatileIssuesResult {
  policiesRolled: number;
  policyIssuesSpawned: number;
  intentsRolled: number;
  intentIssuesSpawned: number;
}

/**
 * Policy category → candidate template domain/category tokens. Policy categories
 * (fiscal/trade/defense/…) don't match template domains (economic/military/…);
 * this bridges the vocabulary (the "fixed matching" fix).
 */
export const POLICY_CATEGORY_TO_TEMPLATE: Record<string, string[]> = {
  fiscal: ["economic"],
  financial: ["economic"],
  economics: ["economic"],
  economic: ["economic"],
  trade: ["economic"],
  direct_tax: ["economic"],
  indirect_tax: ["economic"],
  non_tax: ["economic"],
  defense: ["military", "security"],
  military: ["military", "security"],
  security: ["military", "security"],
  social: ["social"],
  healthcare: ["social"],
  cultural: ["social"],
  infrastructure: ["infrastructure"],
  diplomatic: ["diplomatic"],
  diplomacy: ["diplomatic"],
  governance: ["political", "governance"],
  government: ["political", "governance"],
  political: ["political", "governance"],
  administrative: ["political", "governance"],
  environmental: ["environmental"],
};

const TEMPLATE_DOMAIN_OR_CATEGORY = new Set([
  "economic",
  "political",
  "social",
  "military",
  "diplomatic",
  "infrastructure",
  "environmental",
  "governance",
  "security",
]);

/** Resolve the template tokens for a policy (mapping wins, policyType fills gaps). */
function policyTemplateTokens(policy: { category: string; policyType: string }): string[] {
  const mapped = POLICY_CATEGORY_TO_TEMPLATE[policy.category] ?? [];
  const fromType = TEMPLATE_DOMAIN_OR_CATEGORY.has(policy.policyType) ? [policy.policyType] : [];
  return Array.from(new Set([...mapped, ...fromType]));
}

/**
 * Spawn volatile-issue risk rolls.
 *
 * 1. **Policies:** every active volatile/high-risk policy rolls its threshold
 *    (high-risk 0.15 / volatile 0.08); on success a random matching active
 *    template (via POLICY_CATEGORY_TO_TEMPLATE) is instantiated.
 * 2. **Intents:** only in `spawnMode === "probability"` — every active
 *    moderate/extreme intent rolls the same thresholds (from its riskRating);
 *    on success a resistance issue is spawned through the intent mapping.
 *    (Deterministic mode spawns at commit; "off" spawns nothing.)
 *
 * Never throws — best-effort, per-country failures are caught.
 */
export async function spawnVolatileIssues(): Promise<SpawnVolatileIssuesResult> {
  const result: SpawnVolatileIssuesResult = {
    policiesRolled: 0,
    policyIssuesSpawned: 0,
    intentsRolled: 0,
    intentIssuesSpawned: 0,
  };

  try {
    // ── 1. Policy risk rolls ──────────────────────────────────────────────
    const volatilePolicies = await db.policy.findMany({
      where: { status: "active", riskRating: { in: ["volatile", "high-risk"] } },
      select: {
        id: true,
        countryId: true,
        name: true,
        riskRating: true,
        category: true,
        policyType: true,
      },
    });

    for (const policy of volatilePolicies) {
      result.policiesRolled++;
      const threshold = policy.riskRating === "high-risk" ? 0.15 : 0.08;
      if (Math.random() >= threshold) continue;

      const tokens = policyTemplateTokens(policy);
      if (tokens.length === 0) continue;

      const templates = await db.nationalIssueTemplate.findMany({
        where: {
          isActive: true,
          OR: [{ domain: { in: tokens } }, { category: { in: tokens } as any }],
        },
        select: { id: true },
      });
      if (templates.length === 0) continue;

      const chosen = templates[Math.floor(Math.random() * templates.length)]!;
      const issueId = await NationalIssuesEngine.forceGenerate(
        chosen.id,
        policy.countryId,
        db as any
      );
      if (issueId) {
        result.policyIssuesSpawned++;
        console.log(
          `[VolatileIssues] Policy "${policy.name}" (${policy.category}) triggered template ${chosen.id} for country ${policy.countryId}`
        );
      }
    }

    // ── 2. Intent risk rolls (probability mode only) ─────────────────────
    const config = getNationalIssuesConfig();
    if (config.spawnMode === "probability") {
      const volatileIntents = await db.intent.findMany({
        where: { status: "active", tier: { in: ["moderate", "extreme"] } },
        select: {
          id: true,
          countryId: true,
          category: true,
          tier: true,
          riskRating: true,
        },
      });

      for (const intent of volatileIntents) {
        result.intentsRolled++;
        const threshold = intent.riskRating === "high-risk" ? 0.15 : 0.08;
        if (Math.random() >= threshold) continue;

        const tokens = INTENT_CATEGORY_TO_TEMPLATE[intent.category as Category];
        if (!tokens || tokens.length === 0) continue;

        const issueId = await spawnResistanceForIntent({
          db: db as any,
          countryId: intent.countryId,
          intent,
          tokens,
        });
        if (issueId) {
          result.intentIssuesSpawned++;
          console.log(
            `[VolatileIssues] Intent ${intent.id} (${intent.category}/${intent.tier}) spawned resistance issue ${issueId} for country ${intent.countryId}`
          );
        }
      }
    }
  } catch (err: any) {
    console.error("[VolatileIssues] Global execution failed:", err.message);
  }

  return result;
}

export async function runPolicyMaintenanceDebits(): Promise<PolicyMaintenanceResult> {
  const result: PolicyMaintenanceResult = {
    countriesProcessed: 0,
    policiesProcessed: 0,
    totalCostDebited: 0,
    volatileSpawns: {
      policiesRolled: 0,
      policyIssuesSpawned: 0,
      intentsRolled: 0,
      intentIssuesSpawned: 0,
    },
  };

  try {
    // Risk rolls for volatile policies + intents (policy maintenance is run
    // alongside; both are part of the same 6-hourly maintenance pass).
    result.volatileSpawns = await spawnVolatileIssues();

    // Find all active policies
    const activePolicies = await db.policy.findMany({
      where: { status: "active" },
      select: {
        id: true,
        countryId: true,
        name: true,
        maintenanceCost: true,
      },
    });

    if (activePolicies.length === 0) {
      return result;
    }

    // Group active policies by countryId
    const policiesByCountry: Record<string, typeof activePolicies> = {};
    activePolicies.forEach((p) => {
      if (!policiesByCountry[p.countryId]) {
        policiesByCountry[p.countryId] = [];
      }
      policiesByCountry[p.countryId].push(p);
    });

    const countryIds = Object.keys(policiesByCountry);

    for (const countryId of countryIds) {
      try {
        result.countriesProcessed++;
        const countryPolicies = policiesByCountry[countryId]!;

        // Get GovernmentStructure for the country
        const structure = await db.governmentStructure.findUnique({
          where: { countryId },
          select: { id: true, totalBudget: true },
        });

        if (!structure) continue;

        let totalMaintenanceCost = 0;
        const policyDetails: string[] = [];
        const consequences: Array<{
          targetModel: string;
          targetField: string;
          operation: "subtract" | "add" | "multiply" | "set";
          value: number;
          effectType?: string;
        }> = [];

        for (const policy of countryPolicies) {
          const cost = policy.maintenanceCost || 0;
          if (cost > 0) {
            totalMaintenanceCost += cost;
            policyDetails.push(`"${policy.name}" (${cost.toLocaleString()})`);

            consequences.push({
              targetModel: "GovernmentStructure",
              targetField: "totalBudget",
              operation: "subtract",
              value: cost,
              effectType: "POLICY_MAINTENANCE",
            });

            result.policiesProcessed++;
            result.totalCostDebited += cost;
          }
        }

        if (totalMaintenanceCost > 0) {
          // Record the event and apply consequences using the unified spine
          await CountryEventSpine.recordCountryEvent({
            db,
            countryId,
            sourceType: "policy",
            description: `Policy Maintenance: debited total cost of ${totalMaintenanceCost.toLocaleString()} from budget for active policies: ${policyDetails.join(", ")}`,
            consequences,
          });
        }
      } catch (err: any) {
        console.error(`[PolicyMaintenanceCron] Failed for country ${countryId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[PolicyMaintenanceCron] Global execution failed:", err.message);
  }

  return result;
}
