import { db } from "~/server/db";
import { CountryEventSpine } from "./country-event-spine";
import { NationalIssuesEngine } from "./national-issues-engine";

export interface PolicyMaintenanceResult {
  countriesProcessed: number;
  policiesProcessed: number;
  totalCostDebited: number;
}

export async function runPolicyMaintenanceDebits(): Promise<PolicyMaintenanceResult> {
  const result: PolicyMaintenanceResult = {
    countriesProcessed: 0,
    policiesProcessed: 0,
    totalCostDebited: 0,
  };

  try {
    // Find all active policies
    const activePolicies = await db.policy.findMany({
      where: { status: "active" },
      select: {
        id: true,
        countryId: true,
        name: true,
        maintenanceCost: true,
        riskRating: true,
        category: true,
        policyType: true,
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

        // Check risk rolls for active volatile/high-risk policies
        for (const policy of countryPolicies) {
          if (policy.riskRating === "volatile" || policy.riskRating === "high-risk") {
            const threshold = policy.riskRating === "high-risk" ? 0.15 : 0.08;
            if (Math.random() < threshold) {
              const templates = await db.nationalIssueTemplate.findMany({
                where: {
                  isActive: true,
                  domain: { in: [policy.category, policy.policyType] },
                },
                select: { id: true },
              });

              if (templates.length > 0) {
                const chosenTemplate = templates[Math.floor(Math.random() * templates.length)]!;
                await NationalIssuesEngine.forceGenerate(chosenTemplate.id, countryId, db as any);
                console.log(
                  `[PolicyRiskRoll] Triggered issue template ${chosenTemplate.id} for country ${countryId} from policy "${policy.name}"`
                );
              }
            }
          }
        }

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
