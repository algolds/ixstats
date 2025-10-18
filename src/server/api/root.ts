// src/server/api/root.ts
// FIXED: Updated main router with admin endpoints

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { countriesRouter } from "./routers/countries";
import { adminRouter } from "./routers/admin";
import { usersRouter } from "./routers/users";
// DEPRECATED: Use unifiedIntelligence router instead
import { sdiRouter } from "./routers/sdi";
import { intelligenceRouter, intelligenceBriefingRouter } from "./routers/intelligence";
// DEPRECATED: Use unifiedIntelligence router instead
import { eciRouter } from "./routers/eci";
import { meetingsRouter } from "./routers/meetings";
import { notificationsRouter } from "./routers/notifications";
import { myCountryRouter } from "./routers/mycountry";
import { policiesRouter } from "./routers/policies";
import { diplomaticIntelligenceRouter } from "./routers/diplomatic-intelligence";
import { diplomaticRouter } from "./routers/diplomatic";
import { thinkpagesRouter } from "./routers/thinkpages";
import { archetypesRouter } from "./routers/archetypes";
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

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  countries: countriesRouter,
  admin: adminRouter, // FIXED: Added admin router
  users: usersRouter, // FIXED: Added users router
  roles: rolesRouter, // Role and permission management
  // DEPRECATED: Use unifiedIntelligence router instead (will be removed in v2.0.0)
  sdi: sdiRouter,
  intelligence: intelligenceRouter,
  intelligenceBriefing: intelligenceBriefingRouter, // Intelligence Briefing system (stored in database)
  unifiedIntelligence: unifiedIntelligenceRouter, // Unified Intelligence system (SDI/ECI combined with executive operations)
  // DEPRECATED: Use unifiedIntelligence router instead (will be removed in v2.0.0)
  eci: eciRouter, // ECI router for Executive Command Interface
  meetings: meetingsRouter, // Cabinet meetings, government officials, and meeting management
  notifications: notificationsRouter, // Notifications router
  mycountry: myCountryRouter, // MyCountry specialized endpoints
  policies: policiesRouter, // Policy management and tracking system
  diplomaticIntelligence: diplomaticIntelligenceRouter, // Diplomatic Intelligence system
  diplomatic: diplomaticRouter, // Diplomatic relations management
  thinkpages: thinkpagesRouter, // Thinkpages social platform
  archetypes: archetypesRouter, // Enhanced archetype system for country filtering
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
  system: adminRouter, // Alias for global stats
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