// src/server/api/root.ts
// IxStates — Unified tRPC API Router
// Routers are organized by domain module for architectural clarity.

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

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

// ─── Economy ─────────────────────────────────────────────────────────────────
import { economicsRouter } from "./routers/economics";
import { enhancedEconomicsRouter } from "./routers/enhanced-economics";
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
import { electionsRouter } from "./routers/elections";
import { nationalIdentityRouter } from "./routers/nationalIdentity";
import { customTypesRouter } from "./routers/customTypes";
import { quickActionsRouter } from "./routers/quickactions";
import { scheduledChangesRouter } from "./routers/scheduledChanges";
import { nationalIssuesRouter } from "./routers/national-issues";

// ─── Diplomacy ───────────────────────────────────────────────────────────────
import { diplomaticRouter } from "./routers/diplomatic";
import { diplomaticIntelligenceRouter } from "./routers/diplomatic-intelligence";
import { diplomaticScenariosRouter } from "./routers/diplomaticScenarios";
import { npcPersonalitiesRouter } from "./routers/npcPersonalities";
import { crisisEventsRouter } from "./routers/crisis-events";
import { archetypesRouter } from "./routers/archetypes";

// ─── Intelligence & Security ─────────────────────────────────────────────────
import { intelligenceRouter, intelligenceBriefingRouter } from "./routers/intelligence";
import { unifiedIntelligenceRouter } from "./routers/unified-intelligence";
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
import { loreCardsRouter } from "./routers/lore-cards";
import { nsImportRouter } from "./routers/ns-import";
import { vaultRouter } from "./routers/vault";
import { craftingRouter } from "./routers/crafting";
import { tradingRouter } from "./routers/trading";

// ─── Maps & Geo ──────────────────────────────────────────────────────────────
import { geoRouter } from "./routers/geo";
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
import { blurbsRouter } from "./routers/blurbs";

// ─── Social ──────────────────────────────────────────────────────────────────
import { thinkpagesRouter } from "./routers/thinkpages";
import { messagesRouter } from "./routers/messages";

// ─── Forum & Identity ────────────────────────────────────────────────────────
import { forumRouter } from "./routers/forum";
import { ixnayidRouter } from "./routers/ixnayid";

// ─── MyCountry ───────────────────────────────────────────────────────────────
import { myCountryRouter } from "./routers/mycountry";
import { historicalRouter } from "./routers/historical";

/**
 * Primary tRPC router for IxStates.
 *
 * All routers added in /api/routers should be manually added here.
 * Routers are grouped by domain module — keep imports and registrations
 * in the same order for easy navigation.
 */
export const appRouter = createTRPCRouter({
  // ─── Core ──────────────────────────────────────────────────────────────────
  countries: countriesRouter,
  admin: adminRouter,
  users: usersRouter,
  system: systemRouter,
  roles: rolesRouter,
  cache: cacheRouter,
  notifications: notificationsRouter,
  activities: activitiesRouter,
  achievements: achievementsRouter,
  userLogging: userLoggingRouter,
  demoMode: demoModeRouter,
  systemValidation: systemValidationRouter,
  autosaveHistory: autosaveHistoryRouter,
  autosaveMonitoring: autosaveMonitoringRouter,

  // ─── Economy ───────────────────────────────────────────────────────────────
  economics: economicsRouter,
  enhancedEconomics: enhancedEconomicsRouter,
  atomicEconomic: atomicEconomicRouter,
  economicComponents: economicComponentsRouter,
  economicArchetypes: economicArchetypesRouter,
  formulas: formulasRouter,
  taxSystem: taxSystemRouter,
  atomicTax: atomicTaxRouter,

  // ─── Government ────────────────────────────────────────────────────────────
  government: governmentRouter,
  atomicGovernment: atomicGovernmentRouter,
  governmentComponents: governmentComponentsRouter,
  unifiedAtomic: unifiedAtomicRouter,
  policies: policiesRouter,
  elections: electionsRouter,
  nationalIdentity: nationalIdentityRouter,
  customTypes: customTypesRouter,
  quickActions: quickActionsRouter,
  scheduledChanges: scheduledChangesRouter,
  nationalIssues: nationalIssuesRouter,

  // ─── Diplomacy ─────────────────────────────────────────────────────────────
  diplomatic: diplomaticRouter,
  diplomaticIntelligence: diplomaticIntelligenceRouter,
  diplomaticScenarios: diplomaticScenariosRouter,
  npcPersonalities: npcPersonalitiesRouter,
  crisisEvents: crisisEventsRouter,
  archetypes: archetypesRouter,

  // ─── Intelligence & Security ───────────────────────────────────────────────
  intelligence: intelligenceRouter,
  intelligenceBriefing: intelligenceBriefingRouter,
  unifiedIntelligence: unifiedIntelligenceRouter,
  security: securityRouter,
  meetings: meetingsRouter,

  // ─── Military ──────────────────────────────────────────────────────────────
  militaryEquipment: militaryEquipmentRouter,
  smallArmsEquipment: smallArmsEquipmentRouter,

  // ─── Cards & Vault ─────────────────────────────────────────────────────────
  cards: cardsRouter,
  cardPacks: cardPacksRouter,
  cardMarket: cardMarketRouter,
  cardAnalytics: cardAnalyticsRouter,
  cardImages: cardImagesRouter,
  loreCards: loreCardsRouter,
  nsImport: nsImportRouter,
  vault: vaultRouter,
  crafting: craftingRouter,
  trading: tradingRouter,

  // ─── Maps & Geo ────────────────────────────────────────────────────────────
  geo: geoRouter,
  resources: resourcesRouter,
  transport: transportRouter,
  studio: studioRouter,

  // ─── Wiki & WikiOS ─────────────────────────────────────────────────────────
  wiki: wikiRouter,
  wikios: wikiosRouter,
  wikiCache: wikiCacheRouter,
  wikiImporter: wikiImporterRouter,
  lorewards: lorewardsRouter,
  commons: commonsRouter,
  blurbs: blurbsRouter,

  // ─── Social ────────────────────────────────────────────────────────────────
  thinkpages: thinkpagesRouter,
  messages: messagesRouter,

  // ─── Forum & Identity ──────────────────────────────────────────────────────
  forum: forumRouter,
  ixnayid: ixnayidRouter,

  // ─── MyCountry ─────────────────────────────────────────────────────────────
  mycountry: myCountryRouter,
  historical: historicalRouter,
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
