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
  perProcedureMutationRateLimit,
  publicRateLimit,
  readOnlyRateLimit,
  wikiReadRateLimit,
  standardCacheMiddleware,
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

/** Signed-in mutations: each procedure rate-limited on its own (60/min per user). */
export const rateLimitedMutationProcedure = protectedProcedure.use(perProcedureMutationRateLimit);

/** Premium mutations with the same per-procedure limit. */
export const premiumMutationProcedure = premiumProcedure.use(perProcedureMutationRateLimit);

export const rateLimitedPublicProcedure = publicProcedure.use(publicRateLimit);
/** Signed-in reads that cost the server something (previews, credentials lists), on the read-only bucket. */
export const readOnlyProcedure = protectedProcedure.use(readOnlyRateLimit);

/** Public article reads, on their own generous `wiki_read` bucket (see `wikiReadRateLimit`). */
export const wikiReadProcedure = publicProcedure.use(wikiReadRateLimit);

// Cached procedure variants
export const cachedPublicProcedure = publicProcedure.use(standardCacheMiddleware);

export const cachedStaticProcedure = publicProcedure.use(staticCacheMiddleware);
