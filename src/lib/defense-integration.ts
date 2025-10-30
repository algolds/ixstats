// src/lib/defense-integration.ts
// Defense System Integration Layer
// Connects Defense data with Intelligence, Budget, Government, and other systems

import { db } from "~/server/db";

/**
 * Create intelligence item from security threat
 */
export async function createIntelligenceFromThreat(params: {
  threatId: string;
  countryId: string;
  title: string;
  content: string;
  priority: "low" | "medium" | "high" | "critical";
}) {
  const threat = await db.securityThreat.findUnique({
    where: { id: params.threatId },
  });

  if (!threat) {
    throw new Error("Threat not found");
  }

  // Determine category based on threat type
  const categoryMap: Record<string, string> = {
    terrorism: "SECURITY_THREAT",
    insurgency: "MILITARY_INTELLIGENCE",
    cyber: "CYBER_THREAT",
    espionage: "COUNTERINTELLIGENCE",
    military: "MILITARY_INTELLIGENCE",
    organized_crime: "LAW_ENFORCEMENT",
    nuclear: "STRATEGIC_WARNING",
    biological: "STRATEGIC_WARNING",
  };

  const category = categoryMap[threat.threatType] || "SECURITY_THREAT";

  // Get actor information if available
  const actorName = (threat as any).actorName ?? null;
  const actorLocation = (threat as any).actorLocation ?? "UNKNOWN";

  // Create intelligence item
  return db.intelligenceItem.create({
    data: {
      title: params.title,
      content: `${params.content}\n\n--- Metadata ---\n${JSON.stringify(
        {
          threatId: threat.id,
          threatType: threat.threatType,
          severity: threat.severity,
          actorName: actorName,
        },
        null,
        2
      )}`,
      category: category as any,
      priority: params.priority as any,
      source: "DEFENSE_INTELLIGENCE",
      region: actorLocation,
      affectedCountries: params.countryId,
      timestamp: new Date(),
      isActive: true,
    },
  });
}

/**
 * Sync Defense budget with Government spending system
 */
export async function syncDefenseBudgetToGovernment(params: {
  countryId: string;
  totalBudget: number;
  personnelCosts: number;
  operationsMaintenance: number;
  procurement: number;
  rdteCosts: number;
  militaryConstruction: number;
  fiscalYear: number;
}) {
  // Get or create DefenseBudget record using generic db access
  const defenseBudget = await (db as any).defenseBudget.upsert({
    where: { countryId: params.countryId },
    create: {
      countryId: params.countryId,
      totalBudget: params.totalBudget,
      personnelCosts: params.personnelCosts,
      operationsMaintenance: params.operationsMaintenance,
      procurement: params.procurement,
      rdteCosts: params.rdteCosts,
      militaryConstruction: params.militaryConstruction,
      fiscalYear: params.fiscalYear,
      gdpPercent: 0, // Will be calculated
      perCapita: 0, // Will be calculated
    },
    update: {
      totalBudget: params.totalBudget,
      personnelCosts: params.personnelCosts,
      operationsMaintenance: params.operationsMaintenance,
      procurement: params.procurement,
      rdteCosts: params.rdteCosts,
      militaryConstruction: params.militaryConstruction,
      fiscalYear: params.fiscalYear,
    },
  });

  // Get country data to calculate percentages
  const country = await db.country.findUnique({
    where: { id: params.countryId },
  });

  if (country) {
    const gdp = country.currentTotalGdp || 0;
    const population = country.currentPopulation || 1;

    await (db as any).defenseBudget.update({
      where: { id: defenseBudget.id },
      data: {
        gdpPercent: gdp > 0 ? (params.totalBudget / gdp) * 100 : 0,
        perCapita: population > 0 ? params.totalBudget / population : 0,
      },
    });
  }

  return defenseBudget;
}

/**
 * Get Defense metrics for Intelligence system
 */
export async function getDefenseMetricsForIntelligence(countryId: string) {
  const [branches, threats, securityAssessment, stabilityMetrics, defenseBudget] =
    await Promise.all([
      db.militaryBranch.findMany({ where: { countryId } }),
      db.securityThreat.findMany({
        where: { countryId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      (db as any).securityAssessment?.findUnique({ where: { countryId } }) ?? null,
      (db as any).internalStabilityMetrics?.findUnique({ where: { countryId } }) ?? null,
      (db as any).defenseBudget?.findUnique({ where: { countryId } }) ?? null,
    ]);

  // Calculate aggregate metrics
  const totalPersonnel = branches.reduce((sum: number, b) => sum + b.activeDuty + b.reserves, 0);
  const avgReadiness =
    branches.length > 0
      ? branches.reduce((sum: number, b) => sum + b.readinessLevel, 0) / branches.length
      : 0;
  const criticalThreats = threats.filter(
    (t) => t.severity === "critical" || t.severity === "existential"
  ).length;

  return {
    branches: {
      count: branches.length,
      totalPersonnel,
      avgReadiness: Math.round(avgReadiness),
      totalBudget: branches.reduce((sum: number, b) => sum + b.annualBudget, 0),
    },
    threats: {
      total: threats.length,
      critical: criticalThreats,
      byType: threats.reduce(
        (acc: Record<string, number>, t) => {
          acc[t.threatType] = (acc[t.threatType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
    security: {
      overallScore: securityAssessment?.overallSecurityScore || 0,
      militaryStrength: securityAssessment?.militaryStrength || 0,
      internalStability: stabilityMetrics?.stabilityScore || 0,
      borderSecurity: securityAssessment?.borderSecurity || 0,
    },
    budget: {
      total: defenseBudget?.totalBudget || 0,
      gdpPercent: defenseBudget?.gdpPercent || 0,
      perCapita: defenseBudget?.perCapita || 0,
    },
  };
}

/**
 * Create stability event intelligence item
 */
export async function createIntelligenceFromStabilityEvent(params: {
  eventId: string;
  countryId: string;
}) {
  const event = await (db as any).securityEvent?.findUnique({
    where: { id: params.eventId },
  });

  if (!event) {
    throw new Error("Security event not found");
  }

  return db.intelligenceItem.create({
    data: {
      title: `Internal Stability Alert: ${event.eventType}`,
      content: `${event.description || "No description provided."}\n\n--- Metadata ---\n${JSON.stringify(
        {
          eventId: event.id,
          eventType: event.eventType,
          severity: event.severity,
          casualties: event.casualties,
          economicImpact: event.economicImpact,
        },
        null,
        2
      )}`,
      category: "DOMESTIC_INTELLIGENCE" as any,
      priority: event.severity as any,
      source: "INTERNAL_SECURITY",
      region: "DOMESTIC",
      affectedCountries: params.countryId,
      timestamp: event.startDate,
      isActive: true,
    },
  });
}

/**
 * Get Defense status for MyCountry overview
 */
export async function getDefenseOverviewMetrics(countryId: string) {
  const [securityAssessment, branches, activeThreats, stabilityMetrics] = await Promise.all([
    (db as any).securityAssessment?.findUnique({ where: { countryId } }) ?? null,
    db.militaryBranch.count({ where: { countryId } }),
    db.securityThreat.count({
      where: {
        countryId,
        isActive: true,
      },
    }),
    (db as any).internalStabilityMetrics?.findUnique({ where: { countryId } }) ?? null,
  ]);

  return {
    securityLevel: securityAssessment?.securityLevel || "moderate",
    overallScore: securityAssessment?.overallSecurityScore || 50,
    militaryStrength: securityAssessment?.militaryStrength || 0,
    stabilityScore: stabilityMetrics?.stabilityScore || 0,
    branchCount: branches,
    activeThreats,
    readinessLevel: securityAssessment?.militaryReadiness || 0,
    lastUpdated: securityAssessment?.updatedAt || new Date(),
  };
}

/**
 * Auto-generate intelligence from military branch changes
 */
export async function generateIntelligenceFromBranchUpdate(params: {
  branchId: string;
  changeType: "created" | "readiness_change" | "budget_change" | "deployment";
  details: string;
}) {
  const branch = await db.militaryBranch.findUnique({
    where: { id: params.branchId },
  });

  if (!branch) return null;

  const titleMap = {
    created: `New Military Branch Established: ${branch.name}`,
    readiness_change: `Readiness Update: ${branch.name}`,
    budget_change: `Budget Adjustment: ${branch.name}`,
    deployment: `Deployment Status Change: ${branch.name}`,
  };

  const priorityMap: Record<typeof params.changeType, "low" | "medium" | "high" | "critical"> = {
    created: "high",
    readiness_change: "medium",
    budget_change: "low",
    deployment: "high",
  };

  return db.intelligenceItem.create({
    data: {
      title: titleMap[params.changeType],
      content: `${params.details}\n\n--- Metadata ---\n${JSON.stringify(
        {
          branchId: branch.id,
          branchType: branch.branchType,
          branchName: branch.name,
          changeType: params.changeType,
        },
        null,
        2
      )}`,
      category: "MILITARY_INTELLIGENCE" as any,
      priority: priorityMap[params.changeType] as any,
      source: "DEFENSE_MINISTRY",
      region: "DOMESTIC",
      affectedCountries: branch.countryId,
      timestamp: new Date(),
      isActive: true,
    },
  });
}
