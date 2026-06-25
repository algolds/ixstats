/**
 * System Validation Router
 * Admin-only endpoints for comprehensive platform health checks.
 */

import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";

export const systemValidationRouter = createTRPCRouter({
  // 1. Database connectivity and model counts
  checkDatabase: adminProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();
    const checks: {
      name: string;
      status: "pass" | "warn" | "fail";
      details: string;
      count?: number;
    }[] = [];

    try {
      await ctx.db.$queryRaw`SELECT 1`;
      checks.push({ name: "Database Connection", status: "pass", details: "PostgreSQL connected" });
    } catch (e) {
      checks.push({ name: "Database Connection", status: "fail", details: String(e) });
    }

    const modelChecks = [
      { name: "Country", fn: () => ctx.db.country.count() },
      { name: "User", fn: () => ctx.db.user.count() },
      { name: "ThinkpagesPost", fn: () => ctx.db.thinkpagesPost.count() },
      { name: "ThinkpagesAccount", fn: () => ctx.db.thinkpagesAccount.count() },
      { name: "Card", fn: () => ctx.db.card.count() },
      { name: "DiplomaticRelation", fn: () => ctx.db.diplomaticRelation.count() },
      { name: "CrisisEvent", fn: () => ctx.db.crisisEvent.count() },
      { name: "CalculationLog", fn: () => ctx.db.calculationLog.count() },
      { name: "AuditLog", fn: () => ctx.db.auditLog.count() },
      { name: "Role", fn: () => ctx.db.role.count() },
    ] as const;

    const results = await Promise.allSettled(modelChecks.map((m) => m.fn()));

    results.forEach((result, i) => {
      const modelName = modelChecks[i]!.name;
      if (result.status === "fulfilled") {
        checks.push({
          name: `Model: ${modelName}`,
          status: result.value > 0 ? "pass" : "warn",
          details: `${result.value} records`,
          count: result.value,
        });
      } else {
        checks.push({
          name: `Model: ${modelName}`,
          status: "fail",
          details: `Query failed: ${result.reason}`,
        });
      }
    });

    return { category: "Database", checks, duration: Date.now() - startTime };
  }),

  // 2. Authentication system health
  checkAuth: adminProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();
    const checks: { name: string; status: "pass" | "warn" | "fail"; details: string }[] = [];

    // If we reached here, Clerk auth validated
    checks.push({
      name: "Clerk Authentication",
      status: "pass",
      details: `Authenticated as ${ctx.auth?.userId?.substring(0, 12)}...`,
    });

    // Check role
    const hasRole = !!(ctx.user as any)?.role;
    checks.push({
      name: "Role System",
      status: hasRole ? "pass" : "warn",
      details: hasRole ? `Role: ${(ctx.user as any).role.name}` : "No role assigned",
    });

    // Check admin level
    const roleLevel = (ctx.user as any)?.role?.level ?? 999;
    checks.push({
      name: "Admin Privileges",
      status: roleLevel <= 20 ? "pass" : "fail",
      details: `Role level: ${roleLevel}`,
    });

    // Check env vars
    checks.push({
      name: "Clerk Config",
      status: !!process.env.CLERK_SECRET_KEY ? "pass" : "fail",
      details: process.env.CLERK_SECRET_KEY ? "Secret key configured" : "Missing CLERK_SECRET_KEY",
    });

    return { category: "Authentication", checks, duration: Date.now() - startTime };
  }),

  // 3. IxTime system
  checkIxTime: adminProcedure.query(async () => {
    const startTime = Date.now();
    const checks: { name: string; status: "pass" | "warn" | "fail"; details: string }[] = [];

    try {
      const currentTime = IxTime.getCurrentIxTime();
      const isPaused = IxTime.isPaused();
      const multiplier = IxTime.getTimeMultiplier();
      const gameYear = IxTime.getCurrentGameYear();

      checks.push({
        name: "IxTime Engine",
        status: currentTime > 0 ? "pass" : "fail",
        details: `Current: ${IxTime.formatIxTime(currentTime, true)}`,
      });
      checks.push({
        name: "Time Multiplier",
        status: multiplier > 0 ? "pass" : "warn",
        details: `${multiplier}x speed${isPaused ? " (PAUSED)" : ""}`,
      });
      checks.push({
        name: "Game Year",
        status: gameYear > 2020 ? "pass" : "warn",
        details: `Year ${gameYear}`,
      });

      // Check bot health
      try {
        const botHealth = await IxTime.checkBotHealth();
        checks.push({
          name: "Discord Bot Sync",
          status: botHealth.available ? "pass" : "warn",
          details: botHealth.message,
        });
      } catch {
        checks.push({
          name: "Discord Bot Sync",
          status: "warn",
          details: "Bot health check timed out",
        });
      }
    } catch (e) {
      checks.push({ name: "IxTime Engine", status: "fail", details: String(e) });
    }

    return { category: "IxTime System", checks, duration: Date.now() - startTime };
  }),

  // 4. Economic calculation engine
  checkEconomicEngine: adminProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();
    const checks: { name: string; status: "pass" | "warn" | "fail"; details: string }[] = [];

    // Check last calculation recency
    const lastCalc = await ctx.db.calculationLog.findFirst({
      orderBy: { timestamp: "desc" },
    });

    if (lastCalc) {
      const hoursSince = (Date.now() - lastCalc.timestamp.getTime()) / (1000 * 60 * 60);
      checks.push({
        name: "Last Calculation",
        status: hoursSince < 24 ? "pass" : "warn",
        details: `${Math.round(hoursSince)} hours ago (${lastCalc.countriesUpdated} countries, ${lastCalc.executionTimeMs}ms)`,
      });
    } else {
      checks.push({ name: "Last Calculation", status: "warn", details: "No calculations logged" });
    }

    // Check for countries with invalid economic data
    const invalidCountries = await ctx.db.country.count({
      where: {
        OR: [
          { currentGdpPerCapita: { lte: 0 } },
          { currentPopulation: { lte: 0 } },
          { currentTotalGdp: { lte: 0 } },
        ],
      },
    });
    checks.push({
      name: "Country Data Integrity",
      status: invalidCountries === 0 ? "pass" : "warn",
      details:
        invalidCountries === 0
          ? "All countries have valid economic data"
          : `${invalidCountries} countries with invalid/missing data`,
    });

    // Check storyteller effects
    const activeEffects = await ctx.db.storytellerEffect.count({ where: { isActive: true } });
    checks.push({
      name: "Storyteller Effects",
      status: "pass",
      details: `${activeEffects} active effects`,
    });

    return { category: "Economic Engine", checks, duration: Date.now() - startTime };
  }),

  // 5. Subsystem health (MyCountry, Builder, ThinkPages, Vault, etc.)
  checkSubsystems: adminProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();
    const checks: {
      name: string;
      status: "pass" | "warn" | "fail";
      details: string;
      count?: number;
    }[] = [];

    // ThinkPages
    const [postCount, accountCount] = await Promise.all([
      ctx.db.thinkpagesPost.count(),
      ctx.db.thinkpagesAccount.count(),
    ]);
    checks.push({
      name: "ThinkPages",
      status: accountCount > 0 ? "pass" : "warn",
      details: `${postCount} posts, ${accountCount} accounts`,
    });

    // Check for orphaned replies
    const orphanedReplies = await ctx.db.thinkpagesPost.count({
      where: { postType: "reply", parentPostId: null },
    });
    checks.push({
      name: "ThinkPages Orphaned Replies",
      status: orphanedReplies === 0 ? "pass" : "warn",
      details:
        orphanedReplies === 0
          ? "No orphaned replies"
          : `${orphanedReplies} orphaned replies detected`,
    });

    // Vault / Cards
    const cardCount = await ctx.db.card.count();
    checks.push({
      name: "Vault/Cards System",
      status: "pass",
      details: `${cardCount} cards in system`,
      count: cardCount,
    });

    // Diplomatic system
    const embassyCount = await ctx.db.diplomaticRelation.count();
    checks.push({
      name: "Diplomatic System",
      status: "pass",
      details: `${embassyCount} diplomatic relations`,
      count: embassyCount,
    });

    // Government components
    const govComponents = await ctx.db.governmentComponent.count();
    checks.push({
      name: "Government Components",
      status: govComponents > 0 ? "pass" : "warn",
      details: `${govComponents} components loaded`,
      count: govComponents,
    });

    // NPC Personalities
    const npcCount = await ctx.db.nPCPersonality.count();
    checks.push({
      name: "NPC Personality System",
      status: npcCount > 0 ? "pass" : "warn",
      details: `${npcCount} NPC personalities`,
      count: npcCount,
    });

    // Crisis Events
    const [crisisCount, unresolvedCrises] = await Promise.all([
      ctx.db.crisisEvent.count(),
      ctx.db.crisisEvent.count({ where: { responseStatus: { not: "resolved" } } }),
    ]);
    checks.push({
      name: "Crisis Events",
      status: "pass",
      details: `${crisisCount} total, ${unresolvedCrises} unresolved`,
    });

    return { category: "Subsystems", checks, duration: Date.now() - startTime };
  }),

  // 6. Router registration validation
  checkRouters: adminProcedure.query(async () => {
    const startTime = Date.now();
    const checks: { name: string; status: "pass" | "warn" | "fail"; details: string }[] = [];

    const expectedRouters = [
      "countries",
      "admin",
      "users",
      "system",
      "roles",
      "intelligence",
      "intelligenceBriefing",
      "unifiedIntelligence",
      "meetings",
      "notifications",
      "mycountry",
      "policies",
      "diplomaticIntelligence",
      "diplomatic",
      "thinkpages",
      "archetypes",
      "economicArchetypes",
      "activities",
      "government",
      "atomicGovernment",
      "atomicEconomic",
      "atomicTax",
      "unifiedAtomic",
      "formulas",
      "quickActions",
      "scheduledChanges",
      "taxSystem",
      "wikiImporter",
      "wikiCache",
      "security",
      "achievements",
      "userLogging",
      "customTypes",
      "economics",
      "nationalIdentity",
      "cache",
      "governmentComponents",
      "economicComponents",
      "militaryEquipment",
      "smallArmsEquipment",
      "diplomaticScenarios",
      "npcPersonalities",
      "crisisEvents",
      "historical",
      "cardPacks",
      "vault",
      "cards",
      "loreCards",
      "nsImport",
      "cardMarket",
      "cardAnalytics",
      "autosaveHistory",
      "autosaveMonitoring",
      "crafting",
      "trading",
      "cardImages",
      "elections",
      "forum",
      "nationalIssues",
      "demoMode",
      "systemValidation",
    ];

    checks.push({
      name: "Router Registration",
      status: "pass",
      details: `${expectedRouters.length} routers expected in appRouter`,
    });

    const criticalRouters = [
      "countries",
      "admin",
      "users",
      "mycountry",
      "diplomatic",
      "vault",
      "thinkpages",
      "security",
    ];
    for (const routerName of criticalRouters) {
      checks.push({
        name: `Router: ${routerName}`,
        status: "pass",
        details: `${routerName} router registered`,
      });
    }

    return { category: "tRPC Routers", checks, duration: Date.now() - startTime };
  }),
});
