/**
 * tRPC Server Primitives
 * Modular entry point for tRPC router definitions, contexts, and procedure builders.
 */

// Context
export {
  createTRPCContext,
  getCachedUserContext,
  setCachedUserContext,
  type TRPCContext,
} from "./context";

// Core tRPC initialization & Router factories
export {
  t,
  createCallerFactory,
  createTRPCRouter,
  mergeRouters,
  middleware,
  procedure,
} from "./init";

// Middlewares
export {
  timingMiddleware,
  authMiddleware,
  countryOwnerMiddleware,
  rateLimitMiddleware,
  createRateLimitMiddleware,
  auditLogMiddleware,
  premiumMiddleware,
  adminMiddleware,
  dataPrivacyMiddleware,
  inputValidationMiddleware,
  standardMutationRateLimit,
  lightMutationRateLimit,
  readOnlyRateLimit,
  publicRateLimit,
  standardCacheMiddleware,
  staticCacheMiddleware,
  userCacheMiddleware,
  type RateLimitOptions,
} from "./middleware";

// Procedure builders
export {
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  countryOwnerProcedure,
  adminProcedure,
  executiveProcedure,
  standardMutationCountryOwnerProcedure,
  lightMutationProcedure,
  readOnlyProcedure,
  rateLimitedPublicProcedure,
  cachedPublicProcedure,
  cachedProtectedProcedure,
  cachedStaticProcedure,
} from "./procedures";
