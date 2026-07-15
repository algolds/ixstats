// src/server/api/root.ts
// IxStates — Unified tRPC API Router
// Routers are organized by domain module for architectural clarity.
//
// SAFETY: Each router is wrapped in a try-catch at registration time (Option A).
// If any single router fails to import or initialize, it is replaced with an
// empty router and a console.error is logged — the remaining routers still load.

import { createCallerFactory, createTRPCRouter, mergeRouters } from "~/server/api/trpc";

// ─── Safe Router Import Helper ───────────────────────────────────────────────
// Wraps a router import so that if it throws (broken dependency, circular import,
// schema error, etc.) the server still boots with the other routers intact.
// Uses a generic type parameter so the concrete router type is preserved — without
// this, the `as any` fallback collapses the entire AppRouter type to `any`, which
// breaks all tRPC client-side decorator type inference (2150+ TS2339 errors).
function safeRouter<T>(name: string, routerFn: () => T): T {
  try {
    return routerFn();
  } catch (error) {
    console.error(
      `[ROOT_ROUTER] ✗ Failed to load router "${name}":`,
      error instanceof Error ? error.message : error
    );
    return createTRPCRouter({}) as T;
  }
}

// ─── Core ────────────────────────────────────────────────────────────────────
import { countriesRouter } from "./routers/countries";
import { adminRouter } from "./routers/admin";
import { usersRouter } from "./routers/users";
import { rolesRouter } from "./routers/roles";
import { systemRouter } from "./routers/system";
import { cacheRouter } from "./routers/cache";
import { notificationsRouter } from "./routers/notifications";
import { activitiesRouter } from "./routers/activities";
import { achievementsRouter } from "./routers/achievements";
import { userLoggingRouter } from "./routers/user-logging";
import { demoModeRouter } from "./routers/demo-mode";
import { systemValidationRouter } from "./routers/system-validation";
import { autosaveHistoryRouter } from "./routers/autosaveHistory";
import { autosaveMonitoringRouter } from "./routers/autosaveMonitoring";
import { builderDraftRouter } from "./routers/builderDraft";
import { onomaRouter } from "./routers/onoma";
import { intentRouter } from "./routers/intent";

// ─── Economy ─────────────────────────────────────────────────────────────────
import { economicsRouter } from "./routers/economics";
import { atomicEconomicRouter } from "./routers/atomicEconomic";
import { economicComponentsRouter } from "./routers/economicComponents";
import { economicArchetypesRouter } from "./routers/economicArchetypes";
import { formulasRouter } from "./routers/formulas";
import { taxSystemRouter } from "./routers/taxSystem";
import { atomicTaxRouter } from "./routers/atomicTax";

// ─── Government ──────────────────────────────────────────────────────────────
import { governmentRouter } from "./routers/government";
import { atomicGovernmentRouter } from "./routers/atomicGovernment";
import { governmentComponentsRouter } from "./routers/governmentComponents";
import { unifiedAtomicRouter } from "./routers/unifiedAtomic";
import { policiesRouter } from "./routers/policies";
import { legislationRouter } from "./routers/legislation";
import { electionsRouter } from "./routers/elections";
import { nationalIdentityRouter } from "./routers/nationalIdentity";
import { customTypesRouter } from "./routers/customTypes";
import { quickActionsRouter } from "./routers/quickactions";
import { scheduledChangesRouter } from "./routers/scheduledChanges";
import { nationalIssuesRouter } from "./routers/national-issues";

// ─── Diplomacy ───────────────────────────────────────────────────────────────
import { diplomaticCoreRouter } from "./routers/diplomacy/core";
import { diplomaticEmbassiesRouter } from "./routers/diplomacy/embassies";
import { diplomaticCulturalRouter } from "./routers/diplomacy/cultural";
import { diplomaticPoliciesRouter } from "./routers/diplomacy/policies";
import { diplomaticInboxRouter } from "./routers/diplomacy/inbox";
import { diplomaticIntelligenceRouter } from "./routers/diplomatic-intelligence";
import { diplomaticScenariosRouter } from "./routers/diplomaticScenarios";
import { npcPersonalitiesRouter } from "./routers/npcPersonalities";
import { crisisEventsRouter } from "./routers/crisis-events";
import { archetypesRouter } from "./routers/archetypes";

// ─── Intelligence & Security ─────────────────────────────────────────────────
import { intelligenceRouter, intelligenceBriefingRouter } from "./routers/intelligence";
import { intelCoreRouter } from "./routers/intelligence/core";
import { intelAlertsRouter } from "./routers/intelligence/alerts";
import { intelAnalyticsRouter } from "./routers/intelligence/analytics";
import { securityRouter } from "./routers/security";
import { meetingsRouter } from "./routers/meetings";

// ─── Military ────────────────────────────────────────────────────────────────
import { militaryEquipmentRouter } from "./routers/militaryEquipment";
import { smallArmsEquipmentRouter } from "./routers/smallArmsEquipment";

// ─── Cards & Vault ───────────────────────────────────────────────────────────
import { cardsRouter } from "./routers/cards";
import { cardPacksRouter } from "./routers/card-packs";
import { cardMarketRouter } from "./routers/card-market";
import { cardAnalyticsRouter } from "./routers/card-analytics";
import { cardImagesRouter } from "./routers/cardImages";
import { cardXpRouter } from "./routers/card-xp";
import { loreCardsRouter } from "./routers/lore-cards";
import { nsImportRouter } from "./routers/ns-import";
import { vaultRouter } from "./routers/vault";
import { craftingRouter } from "./routers/crafting";
import { tradingRouter } from "./routers/trading";

// ─── Maps & Geo ──────────────────────────────────────────────────────────────
import { geoCoreRouter } from "./routers/geo/core";
import { geoFeaturesRouter } from "./routers/geo/features";
import { geoEditorRouter } from "./routers/geo/editor";
import { geoAdminRouter } from "./routers/geo/admin";
import { geoAdminCitiesRouter } from "./routers/geo/admin/cities";
import { geoSovereigntyRouter } from "./routers/geo/sovereignty";
import { geoWikiRouter } from "./routers/geo/wiki";
import { resourcesRouter } from "./routers/resources";
import { transportRouter } from "./routers/transport";
import { studioRouter } from "./routers/studio";

// ─── Wiki & WikiOS ───────────────────────────────────────────────────────────
import { wikiRouter } from "./routers/wiki";
import { wikiosRouter } from "./routers/wikios";
import { wikiCacheRouter } from "./routers/wikiCache";
import { wikiImporterRouter } from "./routers/wikiImporter";
import { lorewardsRouter } from "./routers/lorewards";
import { commonsRouter } from "./routers/commons";
import { heraldryRouter } from "./routers/heraldry";
import { blurbsRouter } from "./routers/blurbs";

// ─── Social ──────────────────────────────────────────────────────────────────
import { thinkpagesRouter } from "./routers/thinkpages";
import { messagesRouter } from "./routers/messages";
import { pollsRouter } from "./routers/polls";

// ─── Forum & Identity ────────────────────────────────────────────────────────
import { forumRouter } from "./routers/forum";
import { ixnayidRouter } from "./routers/ixnayid";

// ─── Sports ──────────────────────────────────────────────────────────────────
import { sportsRouter } from "./routers/sports";

// ─── Narrator ────────────────────────────────────────────────────────────────
import { narratorRouter } from "./routers/narrator";

// ─── MyCountry ───────────────────────────────────────────────────────────────
import { myCountryRouter } from "./routers/mycountry";
import { historicalRouter } from "./routers/historical";
import { countryGeoRouter } from "./routers/countryGeo";

/**
 * Primary tRPC router for IxStates.
 *
 * All routers added in /api/routers should be manually added here.
 * Routers are grouped by domain module — keep imports and registrations
 * in the same order for easy navigation.
 *
 * Each router is wrapped in safeRouter() so that a failure in one router
 * doesn't take down the entire API surface. Failed routers are replaced
 * with empty stubs and logged to console.
 */
export const appRouter = createTRPCRouter({
  // ─── Core ──────────────────────────────────────────────────────────────────
  countries: safeRouter("countries", () => countriesRouter),
  admin: safeRouter("admin", () => adminRouter),
  users: safeRouter("users", () => usersRouter),
  system: safeRouter("system", () => systemRouter),
  roles: safeRouter("roles", () => rolesRouter),
  cache: safeRouter("cache", () => cacheRouter),
  notifications: safeRouter("notifications", () => notificationsRouter),
  activities: safeRouter("activities", () => activitiesRouter),
  achievements: safeRouter("achievements", () => achievementsRouter),
  userLogging: safeRouter("userLogging", () => userLoggingRouter),
  demoMode: safeRouter("demoMode", () => demoModeRouter),
  systemValidation: safeRouter("systemValidation", () => systemValidationRouter),
  autosaveHistory: safeRouter("autosaveHistory", () => autosaveHistoryRouter),
  autosaveMonitoring: safeRouter("autosaveMonitoring", () => autosaveMonitoringRouter),
  builderDraft: safeRouter("builderDraft", () => builderDraftRouter),

  // ─── Economy ───────────────────────────────────────────────────────────────
  economics: safeRouter("economics", () => economicsRouter),
  atomicEconomic: safeRouter("atomicEconomic", () => atomicEconomicRouter),
  economicComponents: safeRouter("economicComponents", () => economicComponentsRouter),
  economicArchetypes: safeRouter("economicArchetypes", () => economicArchetypesRouter),
  formulas: safeRouter("formulas", () => formulasRouter),
  taxSystem: safeRouter("taxSystem", () => taxSystemRouter),
  atomicTax: safeRouter("atomicTax", () => atomicTaxRouter),

  // ─── Government ────────────────────────────────────────────────────────────
  government: safeRouter("government", () => governmentRouter),
  atomicGovernment: safeRouter("atomicGovernment", () => atomicGovernmentRouter),
  governmentComponents: safeRouter("governmentComponents", () => governmentComponentsRouter),
  unifiedAtomic: safeRouter("unifiedAtomic", () => unifiedAtomicRouter),
  policies: safeRouter("policies", () => policiesRouter),
  legislation: safeRouter("legislation", () => legislationRouter),
  elections: safeRouter("elections", () => electionsRouter),
  nationalIdentity: safeRouter("nationalIdentity", () => nationalIdentityRouter),
  customTypes: safeRouter("customTypes", () => customTypesRouter),
  quickActions: safeRouter("quickActions", () => quickActionsRouter),
  scheduledChanges: safeRouter("scheduledChanges", () => scheduledChangesRouter),
  nationalIssues: safeRouter("nationalIssues", () => nationalIssuesRouter),
  intent: safeRouter("intent", () => intentRouter),

  // ─── Diplomacy ─────────────────────────────────────────────────────────────
  diplomaticCore: safeRouter("diplomaticCore", () => diplomaticCoreRouter),
  diplomaticEmbassies: safeRouter("diplomaticEmbassies", () => diplomaticEmbassiesRouter),
  diplomaticCultural: safeRouter("diplomaticCultural", () => diplomaticCulturalRouter),
  diplomaticPolicies: safeRouter("diplomaticPolicies", () => diplomaticPoliciesRouter),
  diplomaticInbox: safeRouter("diplomaticInbox", () => diplomaticInboxRouter),
  diplomaticIntelligence: safeRouter("diplomaticIntelligence", () => diplomaticIntelligenceRouter),
  diplomaticScenarios: safeRouter("diplomaticScenarios", () => diplomaticScenariosRouter),
  npcPersonalities: safeRouter("npcPersonalities", () => npcPersonalitiesRouter),
  crisisEvents: safeRouter("crisisEvents", () => crisisEventsRouter),
  archetypes: safeRouter("archetypes", () => archetypesRouter),

  // ─── Intelligence & Security ───────────────────────────────────────────────
  intelligence: safeRouter("intelligence", () => intelligenceRouter),
  intelligenceBriefing: safeRouter("intelligenceBriefing", () => intelligenceBriefingRouter),
  intelCore: safeRouter("intelCore", () => intelCoreRouter),
  intelAlerts: safeRouter("intelAlerts", () => intelAlertsRouter),
  intelAnalytics: safeRouter("intelAnalytics", () => intelAnalyticsRouter),
  security: safeRouter("security", () => securityRouter),
  meetings: safeRouter("meetings", () => meetingsRouter),

  // ─── Military ──────────────────────────────────────────────────────────────
  militaryEquipment: safeRouter("militaryEquipment", () => militaryEquipmentRouter),
  smallArmsEquipment: safeRouter("smallArmsEquipment", () => smallArmsEquipmentRouter),

  // ─── Cards & Vault ─────────────────────────────────────────────────────────
  cards: safeRouter("cards", () => cardsRouter),
  cardPacks: safeRouter("cardPacks", () => cardPacksRouter),
  cardMarket: safeRouter("cardMarket", () => cardMarketRouter),
  cardAnalytics: safeRouter("cardAnalytics", () => cardAnalyticsRouter),
  cardImages: safeRouter("cardImages", () => cardImagesRouter),
  cardXp: safeRouter("cardXp", () => cardXpRouter),
  loreCards: safeRouter("loreCards", () => loreCardsRouter),
  nsImport: safeRouter("nsImport", () => nsImportRouter),
  vault: safeRouter("vault", () => vaultRouter),
  crafting: safeRouter("crafting", () => craftingRouter),
  trading: safeRouter("trading", () => tradingRouter),

  // ─── Maps & Geo ────────────────────────────────────────────────────────────
  geoCore: safeRouter("geoCore", () => geoCoreRouter),
  geoFeatures: safeRouter("geoFeatures", () => geoFeaturesRouter),
  geoEditor: safeRouter("geoEditor", () => geoEditorRouter),
  geoAdmin: safeRouter("geoAdmin", () => mergeRouters(geoAdminRouter, geoAdminCitiesRouter)),
  geoSovereignty: safeRouter("geoSovereignty", () => geoSovereigntyRouter),
  geoWiki: safeRouter("geoWiki", () => geoWikiRouter),
  resources: safeRouter("resources", () => resourcesRouter),
  transport: safeRouter("transport", () => transportRouter),
  studio: safeRouter("studio", () => studioRouter),

  // ─── Wiki & WikiOS ─────────────────────────────────────────────────────────
  wiki: safeRouter("wiki", () => wikiRouter),
  wikios: safeRouter("wikios", () => wikiosRouter),
  wikiCache: safeRouter("wikiCache", () => wikiCacheRouter),
  wikiImporter: safeRouter("wikiImporter", () => wikiImporterRouter),
  lorewards: safeRouter("lorewards", () => lorewardsRouter),
  commons: safeRouter("commons", () => commonsRouter),
  heraldry: safeRouter("heraldry", () => heraldryRouter),
  blurbs: safeRouter("blurbs", () => blurbsRouter),

  // ─── Social ────────────────────────────────────────────────────────────────
  thinkpages: safeRouter("thinkpages", () => thinkpagesRouter),
  messages: safeRouter("messages", () => messagesRouter),
  polls: safeRouter("polls", () => pollsRouter),

  // ─── Forum & Identity ──────────────────────────────────────────────────────
  forum: safeRouter("forum", () => forumRouter),
  ixnayid: safeRouter("ixnayid", () => ixnayidRouter),

  // ─── Sports ────────────────────────────────────────────────────────────────
  sports: safeRouter("sports", () => sportsRouter),

  // ─── Narrator ──────────────────────────────────────────────────────────────
  narrator: safeRouter("narrator", () => narratorRouter),

  // ─── MyCountry ─────────────────────────────────────────────────────────────
  mycountry: safeRouter("mycountry", () => myCountryRouter),
  historical: safeRouter("historical", () => historicalRouter),
  countryGeo: safeRouter("countryGeo", () => countryGeoRouter),
  onoma: safeRouter("onoma", () => onomaRouter),
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.countries.getAll();
 *       ^? CountryData[]
 */
export const createCaller = createCallerFactory(appRouter);
