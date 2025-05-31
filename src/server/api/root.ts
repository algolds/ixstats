// src/server/api/root.ts
import { countriesRouter } from "~/server/api/routers/countries"; // Ensure this path is correct
import { adminRouter } from "~/server/api/routers/admin"; // Ensure this path is correct
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  countries: countriesRouter,
  admin: adminRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 * ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);

// The local definitions of countriesRouter and adminRouter have been removed.
// They should be solely defined in their respective files:
// ./routers/countries.ts and ./routers/admin.ts