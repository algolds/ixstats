import type { PrismaClient } from "@prisma/client";
import { db } from "~/server/db";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { NationalIssuesEngine } from "~/lib/national-issues/engine";
import { getNationalIssuesConfig } from "~/lib/national-issues/config";
import { INTENT_CATEGORY_TO_TEMPLATE, spawnResistanceForIntent } from "~/lib/intent/resistance";
import type { Category } from "~/lib/intent/assemble";
import { debitCountryMaintenance, expireLapsedPolicies } from "./lifecycle";
import { findAllById } from "~/lib/system/find-all-by-id";

interface PolicyMaintenanceResult {
  countriesProcessed: number;
  policiesProcessed: number;
  totalCostDebited: number;
  policiesExpired: number;
  volatileSpawns: SpawnVolatileIssuesResult;
}

interface SpawnVolatileIssuesResult {
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
const POLICY_CATEGORY_TO_TEMPLATE: Record<string, string[]> = {
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
async function spawnVolatileIssues(): Promise<SpawnVolatileIssuesResult> {
  const result: SpawnVolatileIssuesResult = {
    policiesRolled: 0,
    policyIssuesSpawned: 0,
    intentsRolled: 0,
    intentIssuesSpawned: 0,
  };

  try {
    // 1. Policy risk rolls
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

    // 2. Intent risk rolls (probability mode only)
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

/**
 * The `policy-maintenance` job (every 6 h): expire lapsed policies, roll volatile risks, then
 * debit each country's active policies — at most once per policy per budget year (PL-8, see
 * ./lifecycle), so reruns within a year debit nothing.
 */
export async function runPolicyMaintenanceDebits(
  database: PrismaClient = db
): Promise<PolicyMaintenanceResult> {
  const result: PolicyMaintenanceResult = {
    countriesProcessed: 0,
    policiesProcessed: 0,
    totalCostDebited: 0,
    policiesExpired: 0,
    volatileSpawns: {
      policiesRolled: 0,
      policyIssuesSpawned: 0,
      intentsRolled: 0,
      intentIssuesSpawned: 0,
    },
  };

  try {
    // Lapsed policies stop first, so they are neither rolled nor debited.
    result.policiesExpired = await expireLapsedPolicies(database);

    // Risk rolls for volatile policies + intents (policy maintenance is run
    // alongside; both are part of the same 6-hourly maintenance pass).
    result.volatileSpawns = await spawnVolatileIssues();

    const activePolicies = await findAllById((page) =>
      database.policy.findMany({
        where: { status: "active" },
        select: { id: true, countryId: true, name: true, maintenanceCost: true },
        ...page,
      })
    );

    const policiesByCountry = new Map<string, typeof activePolicies>();
    for (const p of activePolicies) {
      const list = policiesByCountry.get(p.countryId) ?? [];
      list.push(p);
      policiesByCountry.set(p.countryId, list);
    }

    const budgetYear = currentBudgetYear();
    for (const [countryId, countryPolicies] of policiesByCountry) {
      try {
        result.countriesProcessed++;
        const structure = await database.governmentStructure.findUnique({
          where: { countryId },
          select: { totalBudget: true },
        });
        // No budget to debit from yet: nothing to do (and nothing recorded) until there is.
        if (structure?.totalBudget == null) continue;

        const debit = await debitCountryMaintenance(
          database,
          countryId,
          countryPolicies,
          budgetYear
        );
        result.policiesProcessed += debit.policiesDebited;
        result.totalCostDebited += debit.totalDebited;
      } catch (err: any) {
        console.error(`[PolicyMaintenanceCron] Failed for country ${countryId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[PolicyMaintenanceCron] Global execution failed:", err.message);
  }

  return result;
}
