/**
 * DemoSeedService - Creates and manages demo country data for live demos.
 *
 * Clone-first strategy: copies real data from a source country, falling
 * back to synthetic seeders only when the source has no records for a subsystem.
 */

import { type PrismaClient } from "@prisma/client";
import { type SeedStats, emptySeedStats, computeTotal } from "./types";
import * as cloneSubs from "./clone-subsystems";
import * as fallbacks from "./seed-fallbacks";
import { populateCountryFields } from "./seed-fallbacks";

type Prisma = PrismaClient;

export class DemoSeedService {
  /**
   * Clone a source country into a demo version.
   * Copies Country + GovernmentStructure + InternalStabilityMetrics.
   */
  static async createDemoCountry(prisma: Prisma, sourceCountryId: string): Promise<string> {
    // Check for existing demo country
    const existing = await prisma.country.findFirst({ where: { isDemo: true } });
    if (existing) {
      throw new Error(
        `Demo country already exists: ${existing.name} (${existing.id}). Destroy it first.`
      );
    }

    const source = await prisma.country.findUnique({
      where: { id: sourceCountryId },
      include: {
        governmentStructure: true,
        stabilityMetrics: true,
      },
    });
    if (!source) throw new Error(`Source country ${sourceCountryId} not found`);

    // Clone country (strip id, relations, timestamps)
    const {
      id: _id,
      name,
      slug,
      createdAt: _ca,
      updatedAt: _ua,
      governmentStructure: _gov,
      stabilityMetrics: _stab,
      ...countryFields
    } = source;
    const demoCountry = await prisma.country.create({
      data: {
        ...countryFields,
        name: `${name} (Demo)`,
        slug: slug ? `${slug}-demo` : null,
        isDemo: true,
        geom_postgis: undefined,
      } as any,
    });

    // Clone political MapLayers to preserve borders
    const sourceMapLayers = await prisma.mapLayer.findMany({
      where: {
        countryId: sourceCountryId,
        layerType: "political",
        isActive: true,
      },
    });
    for (const layer of sourceMapLayers) {
      const { id: _lId, createdAt: _lCa, updatedAt: _lUa, ...layerFields } = layer as any;
      delete layerFields.geom_postgis;
      await prisma.mapLayer.create({
        data: {
          ...layerFields,
          countryId: demoCountry.id,
        } as any,
      });
    }

    // Sync cached country geometries from MapLayer
    const { syncCountryGeometryFromMapLayer } = await import("~/lib/country-geo");
    await syncCountryGeometryFromMapLayer(prisma, demoCountry.id);

    // Clone GovernmentStructure (or create synthetic fallback)
    if (source.governmentStructure) {
      const {
        id: _gId,
        countryId: _cId,
        createdAt: _gCa,
        updatedAt: _gUa,
        ...govFields
      } = source.governmentStructure;
      await prisma.governmentStructure.create({
        data: { ...govFields, countryId: demoCountry.id },
      });
    } else {
      await prisma.governmentStructure.create({
        data: {
          countryId: demoCountry.id,
          governmentName: "National Government",
          governmentType: "Federal Republic",
          headOfState: "President",
          headOfGovernment: "Prime Minister",
          legislatureName: "National Assembly",
          executiveName: "Executive Council",
          judicialName: "Supreme Court",
          totalBudget: 360000000000,
          politicalStability: 0.68,
          democracyIndex: 65,
          governmentEffectiveness: 62,
          ruleOfLaw: 58,
          corruptionIndex: 40,
        },
      });
    }

    // Clone InternalStabilityMetrics (or create synthetic fallback)
    if (source.stabilityMetrics) {
      const {
        id: _sId,
        countryId: _sCId,
        createdAt: _sCa,
        updatedAt: _sUa,
        ...stabilityFields
      } = source.stabilityMetrics;
      await prisma.internalStabilityMetrics.create({
        data: { ...stabilityFields, countryId: demoCountry.id },
      });
    } else {
      await fallbacks.seedInternalStabilityMetrics(prisma, demoCountry.id);
    }

    return demoCountry.id;
  }

  /**
   * Seed all subsystems using clone-first, seed-fallback strategy.
   */
  static async seedAllSubsystems(
    prisma: Prisma,
    demoCountryId: string,
    userId: string,
    sourceCountryId: string
  ): Promise<SeedStats> {
    // Look up the country name for template substitution
    const demoCountry = await prisma.country.findUnique({
      where: { id: demoCountryId },
      select: { name: true },
    });
    // Strip " (Demo)" suffix so seeders use the clean country name
    const countryName = (demoCountry?.name ?? "Demo Nation").replace(/ \(Demo\)$/, "");

    const stats = emptySeedStats();

    // Phase 1: Economics (1:1 flat models)
    stats.economics = await cloneSubs.cloneEconomics(
      prisma,
      sourceCountryId,
      demoCountryId,
      countryName
    );

    // Phase 2: Government tree
    stats.government = await cloneSubs.cloneGovernmentTree(prisma, sourceCountryId, demoCountryId);

    // Phase 3: Components
    stats.government += await cloneSubs.cloneComponents(prisma, sourceCountryId, demoCountryId);

    // Phase 4: Tax tree
    stats.tax = await cloneSubs.cloneTaxTree(prisma, sourceCountryId, demoCountryId);

    // Phase 5: Security
    stats.security = await cloneSubs.cloneSecurity(prisma, sourceCountryId, demoCountryId);

    // Phase 6: Geography
    stats.geography = await cloneSubs.cloneGeography(prisma, sourceCountryId, demoCountryId);

    // Phase 7: Meetings
    stats.meetings = await cloneSubs.cloneOrSeedMeetings(
      prisma,
      sourceCountryId,
      demoCountryId,
      userId
    );

    // Phase 8: Policies
    stats.policies = await cloneSubs.cloneOrSeedPolicies(
      prisma,
      sourceCountryId,
      demoCountryId,
      userId
    );

    // Phase 9: Elections
    stats.elections = await cloneSubs.cloneOrSeedElections(prisma, sourceCountryId, demoCountryId);

    // Phase 10: Military
    stats.defense = await cloneSubs.cloneOrSeedDefense(prisma, sourceCountryId, demoCountryId);

    // Phase 11: Intelligence
    stats.intelligence = await cloneSubs.cloneOrSeedIntelligence(
      prisma,
      sourceCountryId,
      demoCountryId
    );

    // Phase 12: National Issues
    stats.nationalIssues = await cloneSubs.cloneOrSeedNationalIssues(
      prisma,
      sourceCountryId,
      demoCountryId,
      countryName
    );

    // Phase 13: Diplomacy
    stats.diplomacy = await cloneSubs.cloneOrSeedDiplomacy(
      prisma,
      sourceCountryId,
      demoCountryId,
      countryName
    );

    // Phase 14: Social
    stats.social = await cloneSubs.cloneOrSeedSocial(
      prisma,
      sourceCountryId,
      demoCountryId,
      userId,
      countryName
    );

    // Phase 15: History
    stats.history = await cloneSubs.cloneHistory(prisma, sourceCountryId, demoCountryId);

    // Phase 16: Crisis Events (seed only)
    stats.crisisEvents = await cloneSubs.seedCrisisEvents(prisma, countryName);

    // Phase 17: Activity Feed
    stats.activityFeed = await cloneSubs.cloneOrSeedActivityFeed(
      prisma,
      sourceCountryId,
      demoCountryId,
      userId
    );

    // Phase 18: Achievements
    stats.achievements = await fallbacks.seedAchievements(prisma, userId);

    // Phase 19: NPC Personality (ensure assigned — may already exist from Phase 1)
    const existingNpc = await prisma.nPCPersonalityAssignment
      .findUnique({
        where: { countryId: demoCountryId },
      })
      .catch(() => null);
    if (!existingNpc) {
      stats.npcPersonality = await fallbacks.seedNPCPersonality(prisma, demoCountryId);
    }

    // Final pass: fill any NULL fields on the Country record itself.
    // The UI reads GDP, labor, fiscal, demographics data directly from Country fields.
    await populateCountryFields(prisma, demoCountryId);

    stats.total = computeTotal(stats);
    return stats;
  }

  /**
   * Get record counts for each subsystem.
   */
  static async getSeedStats(prisma: Prisma, demoCountryId: string): Promise<SeedStats> {
    // Look up government structure ID for department counting
    const govStructure = await prisma.governmentStructure.findFirst({
      where: { countryId: demoCountryId },
      select: { id: true },
    });

    // Look up demo user for achievement counting
    const demoUser = await prisma.user
      .findFirst({
        where: { countryId: demoCountryId },
        select: { clerkUserId: true },
      })
      .catch(() => null);

    const [
      meetings,
      policies,
      parties,
      embassies,
      briefings,
      branches,
      issues,
      social,
      demographics,
      taxSystem,
      territories,
      borderSecurity,
      historicalData,
      govDepartments,
      govComponents,
      econComponents,
      taxComponents,
      securityThreats,
      vitalityHistory,
      activityFeedCount,
      achievementCount,
      npcCount,
    ] = await Promise.all([
      prisma.cabinetMeeting.count({ where: { countryId: demoCountryId } }),
      prisma.policy.count({ where: { countryId: demoCountryId } }),
      prisma.politicalParty.count({ where: { countryId: demoCountryId } }),
      prisma.embassy.count({
        where: { OR: [{ hostCountryId: demoCountryId }, { guestCountryId: demoCountryId }] },
      }),
      prisma.intelligenceBriefing.count({ where: { countryId: demoCountryId } }),
      prisma.militaryBranch.count({ where: { countryId: demoCountryId } }),
      prisma.nationalIssue.count({ where: { countryId: demoCountryId } }),
      prisma.thinkpagesAccount.count({ where: { countryId: demoCountryId } }),
      prisma.demographics.count({ where: { countryId: demoCountryId } }),
      prisma.taxSystem.count({ where: { countryId: demoCountryId } }),
      prisma.territory.count({ where: { countryId: demoCountryId } }),
      prisma.borderSecurity.count({ where: { countryId: demoCountryId } }),
      prisma.historicalDataPoint.count({ where: { countryId: demoCountryId } }),
      govStructure
        ? prisma.governmentDepartment.count({ where: { governmentStructureId: govStructure.id } })
        : Promise.resolve(0),
      prisma.governmentComponent.count({ where: { countryId: demoCountryId } }),
      prisma.economicComponent.count({ where: { countryId: demoCountryId } }),
      prisma.taxComponent.count({ where: { countryId: demoCountryId } }),
      prisma.securityThreat.count({ where: { countryId: demoCountryId } }),
      prisma.vitalityHistory.count({ where: { countryId: demoCountryId } }),
      prisma.activityFeed.count({ where: { countryId: demoCountryId } }),
      demoUser?.clerkUserId
        ? prisma.userAchievement.count({ where: { userId: demoUser.clerkUserId } })
        : Promise.resolve(0),
      prisma.nPCPersonalityAssignment.count({ where: { countryId: demoCountryId } }),
    ]);

    const stats: SeedStats = {
      meetings,
      policies,
      elections: parties,
      diplomacy: embassies,
      intelligence: briefings,
      defense: branches,
      nationalIssues: issues,
      crisisEvents: 0,
      social,
      economics: demographics + (taxSystem > 0 ? 0 : 0) + 1, // approx — 1:1 models
      government: govDepartments + govComponents + econComponents + taxComponents,
      tax: taxSystem,
      geography: territories,
      security: borderSecurity + securityThreats,
      history: historicalData + vitalityHistory,
      activityFeed: activityFeedCount,
      achievements: achievementCount,
      npcPersonality: npcCount,
      total: 0,
    };
    stats.total = computeTotal(stats);
    return stats;
  }

  /**
   * Wipe all demo data for a country (explicit deletes for non-cascade models).
   */
  static async cleanupDemoData(prisma: Prisma, demoCountryId: string) {
    // Models WITHOUT cascade FK to Country - need explicit cleanup
    await prisma.cabinetMeeting.deleteMany({ where: { countryId: demoCountryId } });
    await prisma.policy.deleteMany({ where: { countryId: demoCountryId } });
    await prisma.intelligenceBriefing.deleteMany({ where: { countryId: demoCountryId } });
    await prisma.diplomaticRelation.deleteMany({
      where: { OR: [{ country1: demoCountryId }, { country2: demoCountryId }] },
    });

    // Intelligence models without cascade FK
    await prisma.intelligenceAlert.deleteMany({ where: { countryId: demoCountryId } });
    await prisma.intelligenceAlertThreshold.deleteMany({ where: { countryId: demoCountryId } });

    // Diplomacy extras: alliances (found via member), foreign policy, cultural exchanges, bilateral trade
    const demoMembers = await prisma.allianceMember.findMany({
      where: { countryId: demoCountryId },
      select: { allianceId: true },
    });
    if (demoMembers.length > 0) {
      const allianceIds = demoMembers.map((m) => m.allianceId);
      // Delete all members + alliance itself (cascade handles actions/votes/documents)
      await prisma.allianceMember.deleteMany({ where: { allianceId: { in: allianceIds } } });
      await prisma.alliance.deleteMany({ where: { id: { in: allianceIds } } });
    }
    await prisma.foreignPolicyAction.deleteMany({
      where: { OR: [{ initiatorId: demoCountryId }, { targetId: demoCountryId }] },
    });
    await prisma.culturalExchange.deleteMany({ where: { hostCountryId: demoCountryId } });
    await prisma.bilateralTrade.deleteMany({
      where: { OR: [{ country1Id: demoCountryId }, { country2Id: demoCountryId }] },
    });

    // Secure diplomatic channels — two-step: find IDs then delete
    const diplomaticConvs = await (prisma as any).thinkshareConversation.findMany({
      where: { conversationType: "diplomatic" },
      include: { participants: { where: { userId: demoCountryId } } },
    });
    const diplomaticConvIds = (diplomaticConvs as any[])
      .filter((c: any) => c.participants.length > 0)
      .map((c: any) => c.id as string);
    if (diplomaticConvIds.length > 0) {
      await (prisma as any).thinkshareConversation.deleteMany({
        where: { id: { in: diplomaticConvIds } },
      });
    }
    // ConversationParticipant + ThinkshareMessage cascade via onDelete: Cascade

    // Activity Feed (no cascade FK)
    await prisma.activityFeed.deleteMany({ where: { countryId: demoCountryId } });

    // User Achievements (keyed on userId, not countryId)
    const demoUser = await prisma.user
      .findFirst({
        where: { countryId: demoCountryId },
        select: { clerkUserId: true },
      })
      .catch(() => null);
    if (demoUser?.clerkUserId) {
      await prisma.userAchievement.deleteMany({ where: { userId: demoUser.clerkUserId } });
    }

    // History models without explicit FK relations
    await prisma.vitalityHistory.deleteMany({ where: { countryId: demoCountryId } });
    await (prisma as any).componentEffectivenessHistory?.deleteMany?.({
      where: { countryId: demoCountryId },
    });

    // Models WITH cascade FK are auto-deleted when Country is deleted:
    // GovernmentStructure, InternalStabilityMetrics, PoliticalParty, Legislature,
    // Election, Embassy, MilitaryBranch (→ MilitaryUnit), MilitaryOperation,
    // NationalIssue, ThinkpagesAccount, TaxSystem, BorderSecurity, SecurityThreat,
    // GovernmentComponent, EconomicComponent, TaxComponent, CrossBuilderSynergy,
    // Territory, Subdivision, City, PointOfInterest, Demographics, EconomicProfile,
    // LaborMarket, FiscalSystem, IncomeDistribution, GovernmentBudget, etc.
  }

  /**
   * Completely destroy demo country and all related data.
   */
  static async destroyDemoCountry(prisma: Prisma, demoCountryId: string) {
    await this.cleanupDemoData(prisma, demoCountryId);
    await prisma.country.delete({ where: { id: demoCountryId } });
  }
}
