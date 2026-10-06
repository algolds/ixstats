import { PrismaClient } from "@prisma/client";

import { env } from "~/env";
// Direct leaf imports avoid loading the system barrel during database initialization
import { queryMonitor } from "~/lib/system/query-monitor";
import { isDevMode } from "~/lib/system/dev-memory-config";
import { prismaErrorToAppError } from "~/lib/prisma-error";

// Check if we're in read-only mode (development with production data)
const isReadOnlyMode = process.env.DATABASE_READONLY === "true";

/** Production times each operation and records the slow ones (see queryMonitor). */
const trackSlowQueries = !isDevMode;

/** Models that stay writable in read-only mode (vault, demo seeding, sync caches, gameplay). */
const WRITABLE_MODELS_IN_READONLY = new Set(
  [
    // Vault / card system
    `Card CardOwnership CardPack CardPackOpening UserPack MyVault VaultTransaction
    NSVerification CardTrade CardTradeOffer TradeOffer CardAuction CardBid CardCollection
    CardCollectionItem CraftingRecipe VaultStoreItem VaultStorePriceHistory CardWatchlist
    CardTransferEvent`,
    // NS sync management
    `SyncLog SyncCheckpoint`,
    // Country stats & economic calculations
    `Country EconomicProfile LaborMarket FiscalSystem IncomeDistribution GovernmentBudget
    Demographics HistoricalDataPoint CalculationLog NationalIdentity AuditLog
    StorytellerEffect User CountryFollow EconomicModel SectoralOutput PolicyEffect`,
    // Demo mode - all models written by DemoSeedService (clone-first system)
    `SystemConfig GovernmentStructure InternalStabilityMetrics CabinetMeeting MeetingAgendaItem
    MeetingAttendance MeetingDecision MeetingActionItem Policy PolicyEffectLog PoliticalParty
    Legislature Election ElectionCandidate ElectionResult LegislativeSeat DiplomaticRelation
    Embassy EmbassyMission IntelligenceBriefing IntelligenceRecommendation IntelligenceAlert
    MilitaryBranch MilitaryUnit MilitaryOperation MilitaryAsset MilitaryConflict Deployment
    NationalIssue NationalIssueConsequence CrisisEvent ThinkpagesAccount ThinkpagesPost
    MediaAttachment`,
    // New models cloned by demo-seed system
    `DefenseBudget SecurityAssessment AtomicEffectiveness GovernmentDepartment
    GovernmentOfficial BudgetAllocation SubBudgetCategory RevenueSource GovernmentComponent
    ComponentSynergy EconomicComponent TaxComponent CrossBuilderSynergy TaxSystem TaxCategory
    TaxBracket TaxExemption TaxDeduction TaxPolicy BorderSecurity NeighborThreatAssessment
    SecurityThreat ThreatIncident SecurityEvent Territory Subdivision City PointOfInterest
    VitalityHistory ComponentEffectivenessHistory NPCPersonalityAssignment CardBackgroundImage
    IntelligenceAlertThreshold`,
    // Diplomacy (all writable models for gameplay + demo seed)
    `DiplomaticEvent DiplomaticAction DiplomaticOption DiplomaticOptionUsage
    DiplomaticRelationshipHistory DiplomaticScenario DiplomaticChannel
    DiplomaticChannelParticipant DiplomaticMessage Alliance AllianceMember AllianceAction
    AllianceVote AllianceDocument ForeignPolicyAction BilateralTrade CulturalExchange
    CulturalExchangeParticipant CulturalArtifact CulturalScenario CulturalExchangeOutcome
    CulturalExchangeVote EmbassyUpgrade EmbassyRequirement`,
    // ThinkShare diplomatic channels & DMs (seeded by demo seed system)
    `ThinkshareConversation ConversationParticipant ThinkshareMessage`,
    // ThinkTank groups (seeded by demo seed system)
    `ThinktankGroup ThinktankMember ThinktankMessage ThinktankInvite CollaborativeDoc`,
    // Sovereignty / dependency relationships (admin map management)
    `CountrySovereignty`,
    // SVG upload pipeline (admin map management)
    `SvgUpload MapLayer MapEditRequest`,
    // Border editor, world templates, procedural generation
    `MapEditorSession WorldTemplate ProceduralWorld MapStyleOverride`,
    // Transport infrastructure (generated routes, hubs)
    `TransportRoute TransportHub`,
    // Story pins & custom map labels
    `StoryPin MapLabel`,
    // Geo analytics profiles & resources
    `CountryGeoProfile GeographicResource`,
    // Activity feed & achievements (seeded/cleaned by demo seed system)
    `ActivityFeed UserAchievement Achievement`,
    // Wiki cache (written by WikiCacheService for 3-layer caching)
    `WikiCache ExternalApiCache`,
    // WikiOS Core Entities (Articles, Revisions, Categories, DAG Graph)
    `WikiArticle WikiRevision WikiCategory WikiCategoryMember WikiAsset WikiLink WikiLog
    WikiWatchlist`,
    // WikiOS bot-API logins: a read-only dev server still accepts them (bot password last-use stamp, API sessions)
    `WikiBotPassword WikiApiSession`,
    // WikiOS Stash — save-for-later with annotations
    `Stash StashItem StashAnnotation`,
    // WikiOS Template Registry
    `WikiTemplate`,
    // Lorewards — synced from Discord bot + cross-validation
    `LorewardEntry LorewardUserStats LorewardCrossValidation WikiArticleAward`,
    // Blurbs — Topic Tuesday prompts & user responses
    `BlurbPrompt BlurbResponse`,
    // Polls system
    `Poll PollOption PollVote`,
    // Sports / MyLeague / MyClub — full league simulation lifecycle
    `SportLeague SportTeam SportPlayer SportCoach SportSeason SportMatch SportMatchStat
    SportStanding SportBracket SportRace SportDraftPick SportRookieClass SportTeamSeason
    SportSeasonRecord`,
    // Vexel Heraldry System
    `HeraldryAchievement HeraldryCharge HeraldryRevision`,
  ]
    .join(" ")
    .split(/\s+/)
);

const BLOCKED_WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Creates a Prisma client with optional read-only protection and query monitoring.
 * In read-only mode, all write operations (create, update, delete, upsert)
 * are blocked at the application level to protect production data.
 *
 * Memory optimization: In development, we reduce logging verbosity to save memory.
 */
const createPrismaClient = () => {
  // Warnings and errors only. Per-query events are not emitted in any environment;
  // slow queries are timed in the extension at the bottom of this file instead.
  const baseClient = new PrismaClient({
    log: isDevMode
      ? [{ level: "error", emit: "stdout" }]
      : [
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
        ],
  });

  // Log memory config on startup in development
  if (isDevMode) {
    console.log("[DATABASE] Development mode - reduced logging for memory optimization");
  }

  // If not in read-only mode, return the base client
  if (!isReadOnlyMode) {
    return baseClient;
  }

  console.log(
    "\x1b[33m[DATABASE] Read-only mode enabled - write operations blocked (vault tables exempted)\x1b[0m"
  );

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!BLOCKED_WRITE_OPERATIONS.has(operation) || WRITABLE_MODELS_IN_READONLY.has(model)) {
            return query(args);
          }
          throw new Error(
            `[READ-ONLY MODE] Write blocked for model "${model}" (${operation}). Add it to WRITABLE_MODELS_IN_READONLY in src/server/db.ts if needed.`
          );
        },
      },
    },
  });
};

/** Rows an unbounded findMany returns before the guard below truncates it. */
export const UNBOUNDED_FIND_MANY_CAP = 1000;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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
          async findMany({ model, args, query }) {
            if (args.take || args.cursor) return query(args);
            args.take = UNBOUNDED_FIND_MANY_CAP;
            const rows = await query(args);
            // A capped read that comes back full has probably dropped rows silently
            // (cron jobs walking every country, for example): say so.
            if (Array.isArray(rows) && rows.length >= UNBOUNDED_FIND_MANY_CAP) {
              console.warn(
                `[DATABASE] ${model}.findMany hit the ${UNBOUNDED_FIND_MANY_CAP}-row cap; ` +
                  "page with take/cursor or set take explicitly"
              );
            }
            return rows;
          },
        },
      },
    })
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const startedAt = trackSlowQueries ? performance.now() : 0;
            let success = true;
            try {
              return await query(args);
            } catch (error) {
              success = false;
              prismaErrorToAppError(error);
            } finally {
              if (trackSlowQueries) {
                const duration = performance.now() - startedAt;
                // Only slow operations are recorded; the monitor logs them once.
                if (duration > queryMonitor.slowThresholdMs) {
                  queryMonitor.recordQuery({
                    queryKey: `${model ?? "raw"}.${operation}`,
                    duration: Math.round(duration),
                    success,
                    timestamp: Date.now(),
                  });
                }
              }
            }
          },
        },
      },
    })) as unknown as PrismaClient;

export { db as prisma };

// Export read-only mode flag for use in other parts of the application
export const isDatabaseReadOnly = isReadOnlyMode;

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db as unknown as PrismaClient;
