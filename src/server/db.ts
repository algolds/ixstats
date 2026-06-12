import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { env } from "~/env";
// Import from standalone query-monitor to avoid circular dependency with database-optimizations
import { queryMonitor } from "~/lib/query-monitor";
import { isDevMode } from "~/lib/dev-memory-config";
import { prismaErrorToAppError } from "~/lib/prisma-error";

// Check if we're in read-only mode (development with production data)
const isReadOnlyMode = process.env.DATABASE_READONLY === "true";

// Slow query threshold in milliseconds (higher in dev to reduce log noise and memory)
const SLOW_QUERY_THRESHOLD_MS = isDevMode ? 500 : 100;

/**
 * Creates a Prisma client with optional read-only protection and query monitoring.
 * In read-only mode, all write operations (create, update, delete, upsert)
 * are blocked at the application level to protect production data.
 *
 * Memory optimization: In development, we reduce logging verbosity to save memory.
 */
const createPrismaClient = () => {
  // Configure logging based on environment
  // In development: minimal logging to reduce memory usage
  // In production: log queries as events for duration tracking
  const baseClient = new PrismaClient({
    log: isDevMode
      ? [
          // Development: errors only to reduce memory from query logging
          { level: "error", emit: "stdout" },
        ]
      : [
          // Production: full query logging for performance analysis
          { level: "query", emit: "event" },
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
        ],
  });

  // Only set up query monitoring in production (saves memory in dev)
  if (!isDevMode) {
    baseClient.$on("query", (e) => {
      // Record query metrics for performance analysis
      queryMonitor.recordQuery({
        queryKey: e.query.substring(0, 100),
        duration: e.duration,
        success: true,
        timestamp: Date.now(),
      });

      // Log slow queries (>100ms) in production
      if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(
          `[SLOW_QUERY] ${e.duration}ms | ${e.query.substring(0, 200)}${e.query.length > 200 ? "..." : ""}`
        );
      }
    });
  }

  // Log memory config on startup in development
  if (isDevMode) {
    console.log("[DATABASE] Development mode - reduced logging for memory optimization");
  }

  // If not in read-only mode, return the base client
  if (!isReadOnlyMode) {
    return baseClient;
  }

  // Models that are writable even in read-only mode
  const WRITABLE_MODELS_IN_READONLY = new Set([
    // Vault / card system
    "Card",
    "CardOwnership",
    "CardPack",
    "CardPackOpening",
    "UserPack",
    "MyVault",
    "VaultTransaction",
    "NSVerification",
    "CardTrade",
    "CardTradeOffer",
    "CardAuction",
    "CardBid",
    "CardCollection",
    "CardCollectionItem",
    "CraftingRecipe",
    "VaultStoreItem",
    "VaultStorePriceHistory",
    "CardWatchlist",
    "CardTransferEvent",
    // NS sync management
    "SyncLog",
    "SyncCheckpoint",
    // Country stats & economic calculations
    "Country",
    "EconomicProfile",
    "LaborMarket",
    "FiscalSystem",
    "IncomeDistribution",
    "GovernmentBudget",
    "Demographics",
    "HistoricalDataPoint",
    "CalculationLog",
    "NationalIdentity",
    "AuditLog",
    "StorytellerEffect",
    "User",
    "CountryFollow",
    "EconomicModel",
    "SectoralOutput",
    "PolicyEffect",
    // Demo mode - all models written by DemoSeedService (clone-first system)
    "SystemConfig",
    "GovernmentStructure",
    "InternalStabilityMetrics",
    "CabinetMeeting",
    "MeetingAgendaItem",
    "MeetingAttendance",
    "MeetingDecision",
    "MeetingActionItem",
    "Policy",
    "PolicyEffectLog",
    "PoliticalParty",
    "Legislature",
    "Election",
    "ElectionCandidate",
    "ElectionResult",
    "LegislativeSeat",
    "DiplomaticRelation",
    "Embassy",
    "EmbassyMission",
    "IntelligenceBriefing",
    "IntelligenceRecommendation",
    "IntelligenceAlert",
    "MilitaryBranch",
    "MilitaryUnit",
    "MilitaryOperation",
    "MilitaryAsset",
    "MilitaryConflict",
    "Deployment",
    "NationalIssue",
    "NationalIssueConsequence",
    "CrisisEvent",
    "ThinkpagesAccount",
    "ThinkpagesPost",
    "MediaAttachment",
    // New models cloned by demo-seed system
    "DefenseBudget",
    "SecurityAssessment",
    "AtomicEffectiveness",
    "GovernmentDepartment",
    "GovernmentOfficial",
    "BudgetAllocation",
    "SubBudgetCategory",
    "RevenueSource",
    "GovernmentComponent",
    "ComponentSynergy",
    "EconomicComponent",
    "TaxComponent",
    "CrossBuilderSynergy",
    "TaxSystem",
    "TaxCategory",
    "TaxBracket",
    "TaxExemption",
    "TaxDeduction",
    "TaxPolicy",
    "BorderSecurity",
    "NeighborThreatAssessment",
    "SecurityThreat",
    "ThreatIncident",
    "SecurityEvent",
    "Territory",
    "Subdivision",
    "City",
    "PointOfInterest",
    "VitalityHistory",
    "ComponentEffectivenessHistory",
    "NPCPersonalityAssignment",
    "CardBackgroundImage",
    "IntelligenceAlertThreshold",
    // Diplomacy (all writable models for gameplay + demo seed)
    "DiplomaticEvent",
    "DiplomaticAction",
    "DiplomaticOption",
    "DiplomaticOptionUsage",
    "DiplomaticRelationshipHistory",
    "DiplomaticScenario",
    "DiplomaticChannel",
    "DiplomaticChannelParticipant",
    "DiplomaticMessage",
    "Alliance",
    "AllianceMember",
    "AllianceAction",
    "AllianceVote",
    "AllianceDocument",
    "ForeignPolicyAction",
    "BilateralTrade",
    "CulturalExchange",
    "CulturalExchangeParticipant",
    "CulturalArtifact",
    "CulturalScenario",
    "CulturalExchangeOutcome",
    "CulturalExchangeVote",
    "EmbassyUpgrade",
    "EmbassyRequirement",
    // ThinkShare diplomatic channels & DMs (seeded by demo seed system)
    "ThinkshareConversation",
    "ConversationParticipant",
    "ThinkshareMessage",
    // ThinkTank groups (seeded by demo seed system)
    "ThinktankGroup",
    "ThinktankMember",
    "ThinktankMessage",
    "ThinktankInvite",
    "CollaborativeDoc",
    // Sovereignty / dependency relationships (admin map management)
    "CountrySovereignty",
    // SVG upload pipeline (admin map management)
    "SvgUpload",
    "MapLayer",
    "MapEditRequest",
    // Border editor, world templates, procedural generation
    "MapEditorSession",
    "WorldTemplate",
    "ProceduralWorld",
    // Transport infrastructure (generated routes, hubs)
    "TransportRoute",
    "TransportHub",
    // Story pins & custom map labels
    "StoryPin",
    "MapLabel",
    // Geo analytics profiles & resources
    "CountryGeoProfile",
    "GeographicResource",
    // Activity feed & achievements (seeded/cleaned by demo seed system)
    "ActivityFeed",
    "UserAchievement",
    "Achievement",
    // Wiki cache (written by WikiCacheService for 3-layer caching)
    "WikiCache",
    "ExternalApiCache",
    // WikiOS Lore Stash — save-for-later with annotations
    "LoreStash",
    "LoreStashItem",
    "LoreStashAnnotation",
    // WikiOS Template Registry
    "WikiTemplate",
    // Lorewards — synced from Discord bot + cross-validation
    "LorewardEntry",
    "LorewardUserStats",
    "LorewardCrossValidation",
    "WikiArticleAward",
    // Blurbs — Topic Tuesday prompts & user responses
    "BlurbPrompt",
    "BlurbResponse",
    // Polls system
    "Poll",
    "PollOption",
    "PollVote",
    // Sports / MyLeague / MyClub — full league simulation lifecycle
    "SportLeague",
    "SportTeam",
    "SportPlayer",
    "SportCoach",
    "SportSeason",
    "SportMatch",
    "SportMatchStat",
    "SportStanding",
    "SportBracket",
    "SportRace",
    "SportDraftPick",
    "SportRookieClass",
    "SportTeamSeason",
    "SportSeasonRecord",
  ]);

  // In read-only mode, extend the client to block write operations
  // except for vault/card models which are allowed for dev testing
  console.log(
    "\x1b[33m[DATABASE] Read-only mode enabled - write operations blocked (vault tables exempted)\x1b[0m"
  );

  const READONLY_ERROR_PREFIX = "[READ-ONLY MODE] Write blocked for model";

  return baseClient.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (create). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async createMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (createMany). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async createManyAndReturn({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (createManyAndReturn). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async update({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (update). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async updateMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (updateMany). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async delete({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (delete). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async deleteMany({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (deleteMany). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
        async upsert({ model, args, query }) {
          if (WRITABLE_MODELS_IN_READONLY.has(model)) return query(args);
          throw new Error(
            `${READONLY_ERROR_PREFIX} "${model}" (upsert). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
      },
    },
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = (globalForPrisma.prisma ??
  createPrismaClient()
    .$extends({
      query: {
        $allModels: {
          /**
           * Safety guard: cap unbounded findMany queries to 1000 rows.
           * Prevents accidental full-table scans from OOMing the server.
           *
           * ⚠️  IMPORTANT: If your query needs more than 1000 rows,
           *    set `take` explicitly (e.g. `take: 50000`) to bypass this guard.
           *    Example: Map layer queries need all 4000+ altitude features.
           */
          async findMany({ args, query }) {
            if (!args.take && !args.cursor) {
              args.take = 1000;
            }
            return query(args);
          },
        },
      },
    })
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            try {
              return await query(args);
            } catch (error) {
              prismaErrorToAppError(error);
            }
          },
        },
      },
    })) as unknown as PrismaClient;

export { db as prisma };

// Export read-only mode flag for use in other parts of the application
export const isDatabaseReadOnly = isReadOnlyMode;

if (typeof window === "undefined" && !isReadOnlyMode) {
  // Asynchronously synchronize baseline achievements in background on server start
  import("~/lib/achievement-sync")
    .then(({ syncAchievements }) => {
      syncAchievements(db).catch((err) =>
        console.error("[DATABASE] Baseline achievements sync failed:", err)
      );
    })
    .catch((err) => console.error("[DATABASE] Failed to load achievement-sync:", err));
}

if (env.NODE_ENV !== "production") globalForPrisma.prisma = undefined;
