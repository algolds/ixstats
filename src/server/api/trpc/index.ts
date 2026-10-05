/**
 * tRPC Server Primitives
 * Modular entry point for tRPC router definitions, contexts, and procedure builders.
 */

// Context
export { createTRPCContext } from "./context";

// Core tRPC initialization & Router factories
export { createCallerFactory, createTRPCRouter, mergeRouters } from "./init";

// Middlewares
export { createRateLimitMiddleware, userCacheMiddleware } from "./middleware";

// Procedure builders
export {
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  countryOwnerProcedure,
  adminProcedure,
  standardMutationCountryOwnerProcedure,
  lightMutationProcedure,
  rateLimitedMutationProcedure,
  premiumMutationProcedure,
  rateLimitedPublicProcedure,
  cachedPublicProcedure,
  cachedStaticProcedure,
} from "./procedures";
