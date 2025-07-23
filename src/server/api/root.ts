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

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  countries: countriesRouter,
  admin: adminRouter, // FIXED: Added admin router
  users: usersRouter, // FIXED: Added users router
  sdi: sdiRouter,
  intelligence: intelligenceRouter,
  eci: eciRouter, // ECI router for Executive Command Interface
  notifications: notificationsRouter, // Notifications router
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