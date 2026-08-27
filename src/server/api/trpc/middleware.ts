/**
 * tRPC Middlewares
 * Authentication, authorization, rate limiting, logging, caching, and validation.
 */

import { t } from "./init";
import { rateLimiter } from "~/lib/cache";
import { db, isDatabaseReadOnly } from "~/server/db";
import { isSystemOwner } from "~/lib/auth";
import { getRoleName, isPrivilegedCountryWriter } from "~/server/shared/country-authorization";
import {
  UnauthorizedError,
  ForbiddenError,
  InternalError,
  RateLimitError,
  ValidationError,
  SecurityError,
} from "~/lib/app-error";
import { createCacheMiddlewareFactory, cacheConfigs } from "~/lib/cache";

const VERBOSE = process.env.TRPC_VERBOSE === "true";

/**
 * Timing middleware for procedure execution diagnostics.
 */
export const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();
  const duration = end - start;
  if (duration > 500) {
    console.log(`[TRPC] ${path} took ${duration}ms to execute`);
  }
  return result;
});

/**
 * Authentication middleware - Validates Clerk authentication
 */
export const authMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.auth?.userId) {
    console.warn(
      `[AUTH_MIDDLEWARE] Unauthenticated access attempt to: ${path || "unknown"}, ` +
        `IP: ${ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"}`
    );
    throw new UnauthorizedError("Authentication required. Please sign in to access this resource.");
  }

  if (!ctx.user) {
    console.error(
      `[AUTH_MIDDLEWARE] User ${ctx.auth.userId} authenticated with Clerk but not found in database. ` +
        `This may indicate a first-time login that failed to create a user record.`
    );
    throw new UnauthorizedError(
      "User account not found in system. Please try logging out and logging back in. " +
        "If the issue persists, contact support."
    );
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
    },
  });
});

/**
 * Country ownership middleware - Validates user owns a country
 */
export const countryOwnerMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  const userRole = getRoleName(ctx.user, (ctx.auth as any)?.sessionClaims);
  const isAdmin = isPrivilegedCountryWriter(ctx.auth.userId, userRole);
  if (isAdmin) {
    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth,
        user: ctx.user,
        country: null,
      },
    });
  }

  if (!ctx.user.countryId) {
    console.warn(
      `[COUNTRY_OWNERSHIP] User ${ctx.auth.userId} attempted to access country-specific endpoint without a linked country: ${path || "unknown"}`
    );
    throw new ForbiddenError(
      "Country ownership required. You must create or claim a country before accessing this feature. " +
        "Visit the Country Builder to get started."
    );
  }

  const country =
    (ctx.user as any).country ||
    (await ctx.db.country.findUnique({
      where: { id: ctx.user.countryId },
    }));

  if (!country) {
    console.error(
      `[COUNTRY_OWNERSHIP] User ${ctx.auth.userId} has countryId ${ctx.user.countryId} but country record not found in database`
    );
    throw new InternalError(
      "Your linked country could not be found in the database. " +
        "This may indicate a data integrity issue. Please contact support."
    );
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
      country,
    },
  });
});

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  namespace?: string;
}

export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  return t.middleware(async ({ ctx, next, path }) => {
    if (!rateLimiter.isEnabled()) {
      return next();
    }

    const identifier = ctx.rateLimitIdentifier;
    const namespace = options.namespace || "default";

    const result = await rateLimiter.check(identifier, namespace);

    if (!result.success) {
      console.warn(
        `[RATE_LIMIT] ${identifier} exceeded ${options.max} requests per ${options.windowMs}ms limit for ${path} (namespace: ${namespace})`
      );
      throw new RateLimitError(
        `Too many requests. Maximum ${options.max} requests per ${options.windowMs / 1000} seconds. Try again at ${result.resetAt.toISOString()}`,
        result.resetAt
      );
    }

    const warningThreshold = Math.max(5, Math.floor(options.max * 0.2));
    if (result.remaining < warningThreshold) {
      console.warn(
        `[RATE_LIMIT] ${identifier} on ${path}: ${result.remaining} of ${options.max} requests remaining (namespace: ${namespace})`
      );
    }

    return next();
  });
};

export const rateLimitMiddleware = createRateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  namespace: "default",
});

export const auditLogMiddleware = t.middleware(async ({ ctx, next, path, input }) => {
  const startTime = Date.now();
  let result;
  let error = null;

  try {
    result = await next();
  } catch (err) {
    error = err as Error;
    throw err;
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;
    if (duration > 500) {
      console.log(`[TRPC] ${path} took ${duration}ms to execute`);
    }

    const shouldAudit =
      path.includes("execute") ||
      path.includes("Action") ||
      path.includes("executive") ||
      path.includes("Intelligence") ||
      path.includes("sensitive") ||
      error;

    if (shouldAudit) {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        userId: ctx.auth?.userId || "anonymous",
        action: path,
        method: "tRPC",
        success: !error,
        duration: endTime - startTime,
        errorMessage: error?.message || null,
        countryId: (input as any)?.countryId || ctx.user?.countryId || null,
        userAgent: ctx.headers?.get("user-agent")?.slice(0, 200) || null,
        ip: ctx.headers?.get("x-forwarded-for") || ctx.headers?.get("x-real-ip") || null,
        inputSummary: input ? Object.keys(input as object).join(",") : null,
        securityLevel: path.includes("execute")
          ? "HIGH"
          : path.includes("Intelligence")
            ? "MEDIUM"
            : "LOW",
        impersonatorId: (ctx as any).impersonatorId || null,
      };

      if (auditEntry.securityLevel === "HIGH" || error) {
        console.error("[SECURITY_AUDIT]", auditEntry);

        if (!isDatabaseReadOnly) {
          try {
            await ctx.db.auditLog.create({
              data: {
                userId: auditEntry.userId || "anonymous",
                action: auditEntry.action,
                details: JSON.stringify({
                  method: auditEntry.method,
                  duration: auditEntry.duration,
                  securityLevel: auditEntry.securityLevel,
                  ip: auditEntry.ip,
                  userAgent: auditEntry.userAgent,
                  inputSummary: auditEntry.inputSummary,
                  impersonatorId: auditEntry.impersonatorId,
                }),
                success: auditEntry.success,
                error: auditEntry.errorMessage,
                timestamp: new Date(),
              },
            });
          } catch (dbError) {
            console.error("[AUDIT_DB] Failed to persist audit log:", dbError);
          }
        } else if (VERBOSE) {
          console.log("[AUDIT_DB] Skipping database write (read-only mode)");
        }
      } else if (VERBOSE) {
        console.log("[AUDIT]", auditEntry);
      }
    }
  }

  return result;
});

export const premiumMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  const membershipTier = (ctx.user as any).membershipTier || "basic";
  const isPremium = membershipTier === "mycountry_premium";

  if (!isPremium) {
    console.warn(
      `[PREMIUM_ACCESS_DENIED] User ${ctx.auth.userId} (tier: ${membershipTier}) attempted premium content access`
    );
    throw new ForbiddenError("MyCountry Premium membership required");
  }

  if (VERBOSE) {
    console.log(`[PREMIUM_ACCESS] Premium user ${ctx.auth.userId} accessing premium content`);
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
      isPremium: true,
    },
  });
});

export const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.auth?.userId || !ctx.user) {
    throw new UnauthorizedError("Authentication required");
  }

  let user = ctx.user;
  if (!user) {
    try {
      user = await db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        include: {
          country: true,
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error(`[ADMIN_MIDDLEWARE] Failed to load user:`, error);
      throw new UnauthorizedError("Failed to load user");
    }
  }

  const isSystemOwnerUser = isSystemOwner(ctx.auth.userId);

  if (isSystemOwnerUser) {
    if (VERBOSE) {
      console.log(
        `[ADMIN_MIDDLEWARE] System owner detected: ${ctx.auth.userId} - bypassing role checks`
      );
    }
    return next({
      ctx: {
        ...ctx,
        user,
      },
    });
  }

  if (!user) {
    console.error(`[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} not found in database`);
    throw new UnauthorizedError("User not found");
  }

  if (!(user as any).role) {
    console.error(
      `[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} has no role assigned (roleId: ${(user as any).roleId}).`
    );
    throw new ForbiddenError(
      "Your account has no assigned role. Please contact support. " +
        `(User ID: ${ctx.auth.userId.substring(0, 8)}...)`
    );
  }

  const adminRoles = ["owner", "admin", "staff"];
  const roleLevel = (user as any).role?.level ?? 999;
  const roleName = (user as any).role?.name || "NO_ROLE";
  const isAdmin = adminRoles.includes(roleName) || roleLevel <= 20;

  if (!isAdmin) {
    console.warn(
      `[ADMIN_ACCESS_DENIED] User ${ctx.auth.userId} (role: ${roleName}, level: ${roleLevel}) attempted admin access`
    );
    throw new ForbiddenError(
      `Admin privileges required. Your current role is "${roleName}" (level ${roleLevel}).`
    );
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user,
      isAdmin: true,
    },
  });
});

export const inputValidationMiddleware = t.middleware(async ({ ctx, next, input, path }) => {
  if (!path.includes("execute") && !path.includes("Action")) {
    return next();
  }

  const inputStr = JSON.stringify(input);
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec\s*\(/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(inputStr)) {
      console.error(
        `[SECURITY] Suspicious input detected from user ${ctx.auth?.userId}: ${pattern}`
      );
      throw new SecurityError("Invalid input detected");
    }
  }

  if (inputStr.length > 10000) {
    throw new ValidationError("Input too large");
  }

  return next();
});

export const standardMutationRateLimit = createRateLimitMiddleware({
  max: 60,
  windowMs: 60000,
  namespace: "mutations",
});

export const lightMutationRateLimit = createRateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  namespace: "light_mutations",
});

export const readOnlyRateLimit = createRateLimitMiddleware({
  max: 120,
  windowMs: 60000,
  namespace: "queries",
});

export const publicRateLimit = createRateLimitMiddleware({
  max: 30,
  windowMs: 60000,
  namespace: "public",
});

export const standardCacheMiddleware = t.middleware(async ({ ctx, next, path, getRawInput }) => {
  const rawInput = await getRawInput();
  const cacheFactory = createCacheMiddlewareFactory(cacheConfigs.standard);
  return cacheFactory({ ctx, path, input: rawInput, next });
});

export const staticCacheMiddleware = t.middleware(async ({ ctx, next, path, getRawInput }) => {
  const rawInput = await getRawInput();
  const cacheFactory = createCacheMiddlewareFactory(cacheConfigs.static);
  return cacheFactory({ ctx, path, input: rawInput, next });
});

export const userCacheMiddleware = t.middleware(async ({ ctx, next, path, getRawInput }) => {
  const rawInput = await getRawInput();
  const cacheFactory = createCacheMiddlewareFactory(cacheConfigs.userSpecific);
  return cacheFactory({ ctx, path, input: rawInput, next });
});
