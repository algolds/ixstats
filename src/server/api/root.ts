// src/server/api/root.ts
// FIXED: Updated main router with admin endpoints

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { countriesRouter } from "./routers/countries";
import { adminRouter } from "./routers/admin";
import { usersRouter } from "./routers/users";
import { intelligenceRouter, intelligenceBriefingRouter } from "./routers/intelligence";
import { meetingsRouter } from "./routers/meetings";
import { notificationsRouter } from "./routers/notifications";
import { myCountryRouter } from "./routers/mycountry";
import { policiesRouter } from "./routers/policies";
import { diplomaticIntelligenceRouter } from "./routers/diplomatic-intelligence";
import { diplomaticRouter } from "./routers/diplomatic";
import { thinkpagesRouter } from "./routers/thinkpages";
import { archetypesRouter } from "./routers/archetypes";
import { economicArchetypesRouter } from "./routers/economicArchetypes";
import { activitiesRouter } from "./routers/activities";
import { enhancedEconomicsRouter } from "./routers/enhanced-economics";
import { rolesRouter } from "./routers/roles";
import { governmentRouter } from "./routers/government";
import { atomicGovernmentRouter } from "./routers/atomicGovernment";
import { atomicEconomicRouter } from "./routers/atomicEconomic";
import { atomicTaxRouter } from "./routers/atomicTax";
import { unifiedAtomicRouter } from "./routers/unifiedAtomic";
import { formulasRouter } from "./routers/formulas";
import { quickActionsRouter } from "./routers/quickactions";
import { scheduledChangesRouter } from "./routers/scheduledChanges";
import { taxSystemRouter } from "./routers/taxSystem";
import { wikiImporterRouter } from "./routers/wikiImporter";
import { wikiCacheRouter } from "./routers/wikiCache";
import { securityRouter } from "./routers/security";
import { achievementsRouter } from "./routers/achievements";
import { userLoggingRouter } from "./routers/user-logging";
import { customTypesRouter } from "./routers/customTypes";
import { economicsRouter } from "./routers/economics";
import { unifiedIntelligenceRouter } from "./routers/unified-intelligence";
import { nationalIdentityRouter } from "./routers/nationalIdentity";
import { cacheRouter } from "./routers/cache";
import { governmentComponentsRouter } from "./routers/governmentComponents";
import { economicComponentsRouter } from "./routers/economicComponents";
import { militaryEquipmentRouter } from "./routers/militaryEquipment";
import { smallArmsEquipmentRouter } from "./routers/smallArmsEquipment";
import { diplomaticScenariosRouter } from "./routers/diplomaticScenarios";
import { npcPersonalitiesRouter } from "./routers/npcPersonalities";
import { crisisEventsRouter } from "./routers/crisis-events";
import { historicalRouter } from "./routers/historical";
import { systemRouter } from "./routers/system";
import { cardPacksRouter } from "./routers/card-packs";
import { vaultRouter } from "./routers/vault";
import { cardsRouter } from "./routers/cards";
import { loreCardsRouter } from "./routers/lore-cards";
import { nsImportRouter } from "./routers/ns-import";
import { cardMarketRouter } from "./routers/card-market";
import { cardAnalyticsRouter } from "./routers/card-analytics";
import { autosaveHistoryRouter } from "./routers/autosaveHistory";
import { autosaveMonitoringRouter } from "./routers/autosaveMonitoring";
import { craftingRouter } from "./routers/crafting";
import { tradingRouter } from "./routers/trading";
import { cardImagesRouter } from "./routers/cardImages";
import { electionsRouter } from "./routers/elections";
import { forumRouter } from "./routers/forum";
import { nationalIssuesRouter } from "./routers/national-issues";
import { demoModeRouter } from "./routers/demo-mode";
import { systemValidationRouter } from "./routers/system-validation";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  countries: countriesRouter,
  admin: adminRouter, // FIXED: Added admin router
  users: usersRouter, // FIXED: Added users router
  system: systemRouter, // Public system information (IxTime, etc.)
  roles: rolesRouter, // Role and permission management
  intelligence: intelligenceRouter,
  intelligenceBriefing: intelligenceBriefingRouter, // Intelligence Briefing system (stored in database)
  unifiedIntelligence: unifiedIntelligenceRouter, // Unified Intelligence system (SDI/ECI combined with executive operations)
  meetings: meetingsRouter, // Cabinet meetings, government officials, and meeting management
  notifications: notificationsRouter, // Notifications router
  mycountry: myCountryRouter, // MyCountry specialized endpoints
  policies: policiesRouter, // Policy management and tracking system
  diplomaticIntelligence: diplomaticIntelligenceRouter, // Diplomatic Intelligence system
  diplomatic: diplomaticRouter, // Diplomatic relations management
  thinkpages: thinkpagesRouter, // Thinkpages social platform
  archetypes: archetypesRouter, // Enhanced archetype system for country filtering
  economicArchetypes: economicArchetypesRouter, // Economic archetype system for builder (Phase 3 migration)
  activities: activitiesRouter, // Live activity feed system
  enhancedEconomics: enhancedEconomicsRouter, // Enhanced economic analysis system
  government: governmentRouter, // Government structure and budget management system
  atomicGovernment: atomicGovernmentRouter, // Atomic government component system
  atomicEconomic: atomicEconomicRouter, // Atomic economic component system
  atomicTax: atomicTaxRouter, // Atomic tax component system
  unifiedAtomic: unifiedAtomicRouter, // Unified atomic component system (cross-builder)
  formulas: formulasRouter, // Internal calculation formulas and system monitoring
  quickActions: quickActionsRouter, // Quick Actions system (meetings, policies, officials, activities)
  scheduledChanges: scheduledChangesRouter, // Scheduled changes system for delayed impact
  taxSystem: taxSystemRouter, // Tax system management
  wikiImporter: wikiImporterRouter, // MediaWiki infobox importer for country data
  wikiCache: wikiCacheRouter, // Wiki data caching system (Redis + Database + API)
  security: securityRouter, // Security & Defense system
  achievements: achievementsRouter, // Achievement system for country milestones
  userLogging: userLoggingRouter, // User activity logging and analytics
  customTypes: customTypesRouter, // Custom government types and field autocomplete system
  economics: economicsRouter, // Economy builder and economic data management
  nationalIdentity: nationalIdentityRouter, // National identity CRUD and autosave
  cache: cacheRouter, // External API cache management (MediaWiki, Unsplash, flags, etc.)
  governmentComponents: governmentComponentsRouter, // Government component library and synergy system (Phase 4)
  economicComponents: economicComponentsRouter, // Economic component library system (Phase 5)
  militaryEquipment: militaryEquipmentRouter, // Military equipment catalog and manufacturer system (Phase 6)
  smallArmsEquipment: smallArmsEquipmentRouter, // Small arms equipment catalog (Phase 9 - October 2025)
  diplomaticScenarios: diplomaticScenariosRouter, // Diplomatic scenario generation and choice tracking (Phase 7B)
  npcPersonalities: npcPersonalitiesRouter, // NPC personality system for behavioral prediction (Phase 8 - FINAL PHASE)
  crisisEvents: crisisEventsRouter, // Crisis events management (natural disasters, economic crises, diplomatic incidents, etc.)
  historical: historicalRouter, // Historical time-series data and analytics (12 endpoints)
  cardPacks: cardPacksRouter, // IxCards pack purchase and opening system (Phase 1 - Card Packs)
  vault: vaultRouter, // MyVault IxCredits economy system (Phase 1 - MyVault)
  cards: cardsRouter, // IxCards trading card system (Phase 1 - Card Service & Router)
  loreCards: loreCardsRouter, // Wiki lore card generation and user request system (Phase 4 - Advanced Features)
  nsImport: nsImportRouter, // NationStates deck import for IxCards (Phase 2 - NS Deck Import)
  cardMarket: cardMarketRouter, // Card marketplace and auction system (Phase 2 - Auction Logic & Market Services)
  cardAnalytics: cardAnalyticsRouter, // Card economy analytics for Intelligence dashboard (Phase 5-6 - Analytics Integration)
  autosaveHistory: autosaveHistoryRouter, // Autosave history for country builders (read-only)
  autosaveMonitoring: autosaveMonitoringRouter, // Autosave system monitoring and analytics (admin-only)
  crafting: craftingRouter, // Card crafting/fusion/evolution system (Phase 3 - Crafting System)
  trading: tradingRouter, // P2P card trading system (Phase 3 - Trading System)
  cardImages: cardImagesRouter, // Card background image management for MyCountry UI customization
  elections: electionsRouter, // Election system: parties, legislature, elections, hemicycle visualization
  forum: forumRouter, // XenForo forum integration (profile sync, account linking)
  nationalIssues: nationalIssuesRouter, // National Issues Engine - dynamic decision/event generation system
  demoMode: demoModeRouter, // Demo mode management - clone country with seeded data for live demos
  systemValidation: systemValidationRouter, // System validation dashboard for admin health checks
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
