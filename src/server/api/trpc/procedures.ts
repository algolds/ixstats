/**
 * tRPC Procedure Builders
 * Standard, authenticated, premium, admin, rate-limited, and cached procedure builders.
 */

import { t } from "./init";
import {
  timingMiddleware,
  authMiddleware,
  countryOwnerMiddleware,
  premiumMiddleware,
  adminMiddleware,
  auditLogMiddleware,
  inputValidationMiddleware,
  rateLimitMiddleware,
  standardMutationRateLimit,
  lightMutationRateLimit,
  readOnlyRateLimit,
  publicRateLimit,
  wikiReadRateLimit,
  standardCacheMiddleware,
  userCacheMiddleware,
  staticCacheMiddleware,
} from "./middleware";
import { userLoggingMiddleware } from "~/lib/logging";

// Base procedures
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(userLoggingMiddleware.standard);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(userLoggingMiddleware.standard);

export const premiumProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(premiumMiddleware)
  .use(userLoggingMiddleware.withPerformance);

export const countryOwnerProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(countryOwnerMiddleware)
  .use(userLoggingMiddleware.standard);

export const adminProcedure = t.procedure
  .use(authMiddleware)
  .use(adminMiddleware)
  .use(inputValidationMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(userLoggingMiddleware.admin);

export const standardMutationCountryOwnerProcedure = countryOwnerProcedure
  .use(standardMutationRateLimit)
  .use(inputValidationMiddleware);

export const lightMutationProcedure = protectedProcedure.use(lightMutationRateLimit);

export const readOnlyProcedure = protectedProcedure.use(readOnlyRateLimit);

export const rateLimitedPublicProcedure = publicProcedure.use(publicRateLimit);

/** Public article reads, on their own generous `wiki_read` bucket (see `wikiReadRateLimit`). */
export const wikiReadProcedure = publicProcedure.use(wikiReadRateLimit);

// Cached procedure variants
export const cachedPublicProcedure = publicProcedure.use(standardCacheMiddleware);

export const cachedProtectedProcedure = protectedProcedure.use(userCacheMiddleware);

export const cachedStaticProcedure = publicProcedure.use(staticCacheMiddleware);
