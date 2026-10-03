/**
 * tRPC Middlewares
 * Authentication, authorization, rate limiting, logging, caching, and validation.
 */

import { t } from "./init";
import { rateLimiter } from "~/lib/cache";
import { isDatabaseReadOnly } from "~/server/db";
import { isSystemOwner } from "~/lib/auth";
import { hasPremiumTier } from "~/lib/auth/premium";
import { getRoleName, isPrivilegedCountryWriter } from "~/server/shared/country-authorization";
import { touchLastSeen } from "./last-seen";
import {
  UnauthorizedError,
  ForbiddenError,
  InternalError,
  RateLimitError,
  ValidationError,
  SecurityError,
} from "~/lib/app-error";
import { createCacheMiddlewareFactory, cacheConfigs } from "~/lib/cache";
import { ALL_REALMS, DEFAULT_REALM_ID, realmScopeInput } from "~/lib/realms/realm-ids";

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

  touchLastSeen(ctx.db, ctx.user);

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

  // No impersonation-specific handling needed here: while playing as another user this
  // evaluates the *target* (the intended play-as behavior), `ctx.auth.userId` is the target's ID
  // (impersonation.ts rebuilds `auth` without spreading), and decidePlayAs already guarantees the
  // target cannot outrank the impersonator or carry the impersonator's session claims.
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

interface RateLimitOptions {
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

    const result = await rateLimiter.check(identifier, namespace, {
      maxRequests: options.max,
      windowMs: options.windowMs,
    });

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

function auditSecurityLevel(path: string, isMutation: boolean) {
  if (path.includes("execute")) return "HIGH";
  return isMutation || path.includes("Intelligence") ? "MEDIUM" : "LOW";
}

function buildAuditEntry(
  ctx: {
    auth?: { userId?: string | null } | null;
    user?: { countryId?: string | null } | null;
    headers?: Headers;
    impersonatorId?: string;
  },
  call: {
    path: string;
    type: string;
    input: unknown;
    duration: number;
    failure: unknown;
    securityLevel: string;
  }
) {
  const { input, failure } = call;
  const failed = failure !== null && failure !== undefined;
  return {
    timestamp: new Date().toISOString(),
    userId: ctx.auth?.userId || "anonymous",
    action: call.path,
    method: "tRPC",
    type: call.type,
    success: !failed,
    duration: call.duration,
    errorMessage: failed ? (failure instanceof Error ? failure.message : String(failure)) : null,
    countryId: (input as { countryId?: string } | null)?.countryId || ctx.user?.countryId || null,
    userAgent: ctx.headers?.get("user-agent")?.slice(0, 200) || null,
    ip: ctx.headers?.get("cf-connecting-ip") || ctx.headers?.get("x-real-ip") || null,
    inputSummary: input && typeof input === "object" ? Object.keys(input).join(",") : null,
    securityLevel: call.securityLevel,
    impersonatorId: ctx.impersonatorId || null,
  };
}

type AuditEntry = ReturnType<typeof buildAuditEntry>;

async function persistAuditLog(ctx: { db: typeof import("~/server/db").db }, entry: AuditEntry) {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: "trpc_admin",
        ipAddress: entry.ip,
        userAgent: entry.userAgent,
        details: JSON.stringify({
          method: entry.method,
          type: entry.type,
          duration: entry.duration,
          securityLevel: entry.securityLevel,
          ip: entry.ip,
          userAgent: entry.userAgent,
          countryId: entry.countryId,
          inputSummary: entry.inputSummary,
          impersonatorId: entry.impersonatorId,
        }),
        success: entry.success,
        error: entry.errorMessage,
        timestamp: new Date(),
      },
    });
  } catch (dbError) {
    console.error("[AUDIT_DB] Failed to persist audit log:", dbError);
  }
}

/**
 * Audit log for admin procedures (applied in `adminProcedure`, after the admin check).
 *
 * tRPC v11 `next()` resolves `{ ok: false, error }` instead of throwing when the procedure fails,
 * so the outcome is read from the result; a throw is still handled for safety. Every admin
 * mutation, every failed call and every HIGH-sensitivity path is written to `AuditLog`
 * (skipped in read-only mode). The IP comes from trusted headers only (see
 * resolveRateLimitIdentifier), never the client-controlled `x-forwarded-for`.
 */
export const auditLogMiddleware = t.middleware(async ({ ctx, next, path, input, type }) => {
  const startTime = Date.now();
  let result: Awaited<ReturnType<typeof next>> | undefined;
  let thrown: unknown = null;

  try {
    result = await next();
    return result;
  } catch (err) {
    thrown = err;
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.log(`[TRPC] ${path} took ${duration}ms to execute`);
    }

    const failure: unknown = thrown ?? (result && !result.ok ? result.error : null);
    const failed = failure !== null && failure !== undefined;
    const isMutation = type === "mutation";
    const securityLevel = auditSecurityLevel(path, isMutation);

    const auditEntry = buildAuditEntry(ctx, {
      path,
      type,
      input,
      duration,
      failure,
      securityLevel,
    });

    if (failed || securityLevel === "HIGH") {
      console.error("[SECURITY_AUDIT]", auditEntry);
    } else if (VERBOSE) {
      console.log("[AUDIT]", auditEntry);
    }

    if (isMutation || failed || securityLevel === "HIGH") {
      if (!isDatabaseReadOnly) await persistAuditLog(ctx, auditEntry);
      else if (VERBOSE) console.log("[AUDIT_DB] Skipping database write (read-only mode)");
    }
  }
});

export const premiumMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  const membershipTier = (ctx.user as any).membershipTier || "basic";
  // hasPremiumTier also honours NEXT_PUBLIC_PREMIUM_FOR_ALL (test builds).
  const isPremium = hasPremiumTier(membershipTier);

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

  // Admin rights are dropped while impersonating another user (play-as mode). The impersonated
  // user's own role/permissions are still evaluated normally by everything below this check —
  // only *admin*-gated procedures are blocked outright. See src/server/api/trpc/impersonation.ts.
  if (ctx.impersonatorId) {
    throw new ForbiddenError(
      "Admin actions are disabled while playing as another user. Exit play-as mode first."
    );
  }

  const user = ctx.user;

  if (isSystemOwner(ctx.auth.userId)) {
    if (VERBOSE) {
      console.log(
        `[ADMIN_MIDDLEWARE] System owner detected: ${ctx.auth.userId} - bypassing role checks`
      );
    }
    return next({ ctx: { ...ctx, user } });
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

// Until plan 340 the limiter ignored per-procedure limits and every namespace got the env default
// (100/min). Keep that effective ceiling for the 49 public procedures on this tier rather than
// silently tightening it to the 30/min that was declared but never enforced.
export const publicRateLimit = createRateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  namespace: "public",
});

/**
 * Cached reads. The key carries the viewer's realm unless it is IxWorld (ruling E-q), because realm-scoped
 * listings fall back to it when the input names none. An all-realms read ("*") is never cached: whether
 * "*" applies depends on the caller being a site admin (ruling E-o).
 */
function realmAwareCacheMiddleware(config: keyof typeof cacheConfigs) {
  return t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
    const rawInput = await getRawInput();
    const scope = realmScopeInput.safeParse(rawInput);
    if (scope.success && scope.data.realm === ALL_REALMS) return next();
    const activeRealmId: string | undefined = ctx.user?.country?.realmId ?? undefined;
    const realmKey = activeRealmId === DEFAULT_REALM_ID ? undefined : activeRealmId;
    const cacheFactory = createCacheMiddlewareFactory(cacheConfigs[config]);
    return cacheFactory({ ctx, path, type, input: rawInput, next, realmKey });
  });
}

export const standardCacheMiddleware = realmAwareCacheMiddleware("standard");

export const staticCacheMiddleware = realmAwareCacheMiddleware("static");

export const userCacheMiddleware = realmAwareCacheMiddleware("userSpecific");
