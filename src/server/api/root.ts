// src/server/api/root.ts
// FIXED: Updated main router with admin endpoints

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { countriesRouter } from "./routers/countries";
import { adminRouter } from "./routers/admin";
import { usersRouter } from "./routers/users";
import { sdiRouter } from "./routers/sdi";
import { intelligenceRouter } from "./routers/intelligence";
import { eciRouter } from "./routers/eci";
import { notificationsRouter } from "./routers/notifications";
import { myCountryRouter } from "./routers/mycountry";
import { diplomaticIntelligenceRouter } from "./routers/diplomatic-intelligence";
import { diplomaticRouter } from "./routers/diplomatic";
import { thinkpagesRouter } from "./routers/thinkpages";
import { archetypesRouter } from "./routers/archetypes";
import { activitiesRouter } from "./routers/activities";
import { enhancedEconomicsRouter } from "./routers/enhanced-economics";
import { rolesRouter } from "./routers/roles";
import { governmentRouter } from "./routers/government";
import { atomicGovernmentRouter } from "./routers/atomicGovernment";
import { formulasRouter } from "./routers/formulas";
import { quickActionsRouter } from "./routers/quickactions";

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
  sdi: sdiRouter,
  intelligence: intelligenceRouter,
  eci: eciRouter, // ECI router for Executive Command Interface
  notifications: notificationsRouter, // Notifications router
  mycountry: myCountryRouter, // MyCountry specialized endpoints
  diplomaticIntelligence: diplomaticIntelligenceRouter, // Diplomatic Intelligence system
  diplomatic: diplomaticRouter, // Diplomatic relations management
  thinkpages: thinkpagesRouter, // Thinkpages social platform
  archetypes: archetypesRouter, // Enhanced archetype system for country filtering
  activities: activitiesRouter, // Live activity feed system
  enhancedEconomics: enhancedEconomicsRouter, // Enhanced economic analysis system
  government: governmentRouter, // Government structure and budget management system
  atomicGovernment: atomicGovernmentRouter, // Atomic government component system
  formulas: formulasRouter, // Internal calculation formulas and system monitoring
  quickActions: quickActionsRouter, // Quick Actions system (meetings, policies, officials, activities)
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