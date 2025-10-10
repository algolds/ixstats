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
  priority: 'low' | 'medium' | 'high' | 'critical';
}) {
  const threat = await db.securityThreat.findUnique({
    where: { id: params.threatId },
  });

  if (!threat) {
    throw new Error("Threat not found");
  }

  // Determine category based on threat type
  const categoryMap: Record<string, string> = {
    terrorism: 'SECURITY_THREAT',
    insurgency: 'MILITARY_INTELLIGENCE',
    cyber_attack: 'CYBER_THREAT',
    espionage: 'COUNTERINTELLIGENCE',
    military_conflict: 'MILITARY_INTELLIGENCE',
    organized_crime: 'LAW_ENFORCEMENT',
    wmd_proliferation: 'STRATEGIC_WARNING',
  };

  const category = categoryMap[threat.threatType] || 'SECURITY_THREAT';

  // Create intelligence item
  return db.intelligenceItem.create({
    data: {
      title: params.title,
      content: `${params.content}\n\n--- Metadata ---\n${JSON.stringify({
        threatId: threat.id,
        threatType: threat.threatType,
        severity: threat.severity,
        actorName: threat.actorName,
      }, null, 2)}`,
      category: category as any,
      priority: params.priority as any,
      source: 'DEFENSE_INTELLIGENCE',
      region: threat.actorLocation || 'UNKNOWN',
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
  // Get or create DefenseBudget record
  const defenseBudget = await db.defenseBudget.upsert({
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
      perCapita: 0,  // Will be calculated
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

    await db.defenseBudget.update({
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
  const [
    branches,
    threats,
    securityAssessment,
    stabilityMetrics,
    defenseBudget,
  ] = await Promise.all([
    db.militaryBranch.findMany({ where: { countryId } }),
    db.securityThreat.findMany({
      where: { countryId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.securityAssessment.findUnique({ where: { countryId } }),
    db.internalStabilityMetrics.findUnique({ where: { countryId } }),
    db.defenseBudget.findUnique({ where: { countryId } }),
  ]);

  // Calculate aggregate metrics
  const totalPersonnel = branches.reduce(
    (sum, b) => sum + b.activeDuty + b.reserves,
    0
  );
  const avgReadiness = branches.length > 0
    ? branches.reduce((sum, b) => sum + b.readinessLevel, 0) / branches.length
    : 0;
  const criticalThreats = threats.filter(
    (t) => t.severity === 'critical' || t.severity === 'existential'
  ).length;

  return {
    branches: {
      count: branches.length,
      totalPersonnel,
      avgReadiness: Math.round(avgReadiness),
      totalBudget: branches.reduce((sum, b) => sum + b.annualBudget, 0),
    },
    threats: {
      total: threats.length,
      critical: criticalThreats,
      byType: threats.reduce((acc, t) => {
        acc[t.threatType] = (acc[t.threatType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
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
  const event = await db.crisisEvent.findUnique({
    where: { id: params.eventId },
  });

  if (!event) {
    throw new Error("Crisis event not found");
  }

  return db.intelligenceItem.create({
    data: {
      title: `Internal Stability Alert: ${event.type}`,
      content: `${event.description || 'No description provided.'}\n\n--- Metadata ---\n${JSON.stringify({
        eventId: event.id,
        eventType: event.type,
        severity: event.severity,
        impactScore: event.economicImpact || 0,
      }, null, 2)}`,
      category: 'DOMESTIC_INTELLIGENCE' as any,
      priority: event.severity,
      source: 'INTERNAL_SECURITY',
      region: 'DOMESTIC',
      affectedCountries: params.countryId,
      timestamp: event.timestamp,
      isActive: true, // Assuming active if being processed
    },
  });
}

/**
 * Get Defense status for MyCountry overview
 */
export async function getDefenseOverviewMetrics(countryId: string) {
  const [securityAssessment, branches, activeThreats, stabilityMetrics] =
    await Promise.all([
      db.securityAssessment.findUnique({ where: { countryId } }),
      db.militaryBranch.count({ where: { countryId } }),
      db.securityThreat.count({
        where: {
          countryId,
          isActive: true,
        },
      }),
      db.internalStabilityMetrics.findUnique({ where: { countryId } }),
    ]);

  return {
    securityLevel: securityAssessment?.securityLevel || 'moderate',
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
  changeType: 'created' | 'readiness_change' | 'budget_change' | 'deployment';
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

  const priorityMap: Record<typeof params.changeType, 'low' | 'medium' | 'high' | 'critical'> = {
    created: 'high',
    readiness_change: 'medium',
    budget_change: 'low',
    deployment: 'high',
  };

  return db.intelligenceItem.create({
    data: {
      title: titleMap[params.changeType],
      content: `${params.details}\n\n--- Metadata ---\n${JSON.stringify({
        branchId: branch.id,
        branchType: branch.branchType,
        branchName: branch.name,
        changeType: params.changeType,
      }, null, 2)}`,
      category: 'MILITARY_INTELLIGENCE' as any,
      priority: priorityMap[params.changeType] as any,
      source: 'DEFENSE_MINISTRY',
      region: 'DOMESTIC',
      affectedCountries: branch.countryId,
      timestamp: new Date(),
      isActive: true,
    },
  });
}
