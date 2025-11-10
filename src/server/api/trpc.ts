/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getAuth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { db } from "~/server/db";
import { rateLimiter } from "~/lib/rate-limiter";
import { userLoggingMiddleware } from "~/lib/user-logging-middleware";
import { UserManagementService } from "~/lib/user-management-service";
import { isSystemOwner } from "~/lib/system-owner-constants";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers; req?: NextRequest }) => {
  // Extract Clerk auth information if available
  let auth = null;
  let user = null;

  try {
    // Try to get auth from request first (for app router)
    if (opts.req) {
      auth = getAuth(opts.req);
    }

    // If no auth from request, try to get it from authorization header (for API routes)
    if (!auth?.userId) {
      const authHeader = opts.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const verifiedToken = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY!,
          });
          if (verifiedToken?.sub) {
            auth = { userId: verifiedToken.sub };
          }
        } catch (tokenError) {
          console.error("[TRPC Context] Token verification failed:", tokenError);
          // Reject invalid tokens explicitly instead of silent continuation
          throw new Error("UNAUTHORIZED: Invalid or expired authentication token");
        }
      }
    }

    // Get user from database if we have a userId
    if (auth?.userId) {
      try {
        // ALWAYS use centralized user management service to ensure correct role
        console.log(`[TRPC Context] Using centralized service for user: ${auth.userId}`);
        const userService = new UserManagementService(db);
        user = await userService.getOrCreateUser(auth.userId);

        if (user) {
          console.log(
            `[TRPC Context] User loaded: ${auth.userId}, role: ${(user as any).role?.name || "NO_ROLE"}, roleId: ${(user as any).roleId || "NULL"}, roleLevel: ${(user as any).role?.level ?? "NULL"}`
          );
        } else {
          console.error(`[TRPC Context] Failed to get/create user: ${auth.userId}`);
        }
      } catch (dbError) {
        console.error("[TRPC Context] Database user lookup failed:", dbError);
        // Continue without user rather than failing - auth is still valid
      }
    }
  } catch (error) {
    console.warn("[TRPC Context] Auth extraction failed:", error);
    // Continue without auth rather than failing
  }

  // Get rate limit identifier from headers (set by middleware)
  const rateLimitIdentifier = opts.headers.get("x-ratelimit-identifier") || "anonymous";

  return {
    db,
    auth,
    user,
    rateLimitIdentifier,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path, ctx }) {
    // Log all tRPC errors in production (except validation errors)
    if (process.env.NODE_ENV === "production" && error.code !== "BAD_REQUEST") {
      // Import ErrorLogger dynamically to avoid circular dependencies
      import("~/lib/error-logger")
        .then(({ ErrorLogger }) => {
          ErrorLogger.logAPIError(path || "unknown", error as Error, {
            userId: ctx?.auth?.userId ?? undefined,
            countryId: ctx?.user?.countryId ?? undefined,
            path: path || "unknown",
            action: "TRPC_ERROR",
            metadata: {
              code: error.code,
              httpStatus: shape.data.httpStatus,
            },
          }).catch((logError) => {
            console.error("[TRPC] Failed to log error:", logError);
          });
        })
        .catch(() => {
          // Silent fail if ErrorLogger import fails
        });
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */

/**
 * Authentication middleware - Validates Clerk authentication
 */
const authMiddleware = t.middleware(async ({ ctx, next, path }) => {
  // Check if user is authenticated via Clerk
  if (!ctx.auth?.userId) {
    console.warn(
      `[AUTH_MIDDLEWARE] Unauthenticated access attempt to: ${path || "unknown"}, ` +
      `IP: ${ctx.headers.get("x-forwarded-for") || ctx.headers.get("x-real-ip") || "unknown"}`
    );
    throw new Error(
      "UNAUTHORIZED: Authentication required. Please sign in to access this resource."
    );
  }

  // Ensure user exists in our database
  if (!ctx.user) {
    console.error(
      `[AUTH_MIDDLEWARE] User ${ctx.auth.userId} authenticated with Clerk but not found in database. ` +
      `This may indicate a first-time login that failed to create a user record.`
    );
    throw new Error(
      "UNAUTHORIZED: User account not found in system. Please try logging out and logging back in. " +
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
const countryOwnerMiddleware = t.middleware(async ({ ctx, next, path }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  // System owners can access any country, bypass country ownership check
  if (isSystemOwner(ctx.auth.userId)) {
    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth,
        user: ctx.user,
        country: null, // System owners bypass country check
      },
    });
  }

  // Check if user has a linked country
  if (!ctx.user.countryId) {
    console.warn(
      `[COUNTRY_OWNERSHIP] User ${ctx.auth.userId} attempted to access country-specific endpoint without a linked country: ${path || "unknown"}`
    );
    throw new Error(
      "FORBIDDEN: Country ownership required. You must create or claim a country before accessing this feature. " +
      "Visit the Country Builder to get started."
    );
  }

  // Fetch country data since it's not included in UserWithRole type
  const country = await ctx.db.country.findUnique({
    where: { id: ctx.user.countryId },
  });

  if (!country) {
    console.error(
      `[COUNTRY_OWNERSHIP] User ${ctx.auth.userId} has countryId ${ctx.user.countryId} but country record not found in database`
    );
    throw new Error(
      "INTERNAL_ERROR: Your linked country could not be found in the database. " +
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

/**
 * Rate limit configuration types
 */
interface RateLimitOptions {
  max: number;
  windowMs: number;
  namespace?: string;
}

/**
 * Create rate limiting middleware with custom configuration
 */
const createRateLimitMiddleware = (options: RateLimitOptions) => {
  return t.middleware(async ({ ctx, next, path }) => {
    if (!rateLimiter.isEnabled()) {
      return next();
    }

    // Use rate limit identifier from context (set by middleware)
    const identifier = ctx.rateLimitIdentifier;
    const namespace = options.namespace || "default";

    // Create custom rate limiter for this specific configuration
    const now = Date.now();
    const key = `ratelimit:${namespace}:${identifier}`;

    // Simple check using the rateLimiter's check method with custom namespace
    const result = await rateLimiter.check(identifier, namespace);

    if (!result.success) {
      console.warn(
        `[RATE_LIMIT] ${identifier} exceeded ${options.max} requests per ${options.windowMs}ms limit for ${path} (namespace: ${namespace})`
      );
      throw new Error(
        `RATE_LIMITED: Too many requests. Maximum ${options.max} requests per ${options.windowMs / 1000} seconds. Try again at ${result.resetAt.toISOString()}`
      );
    }

    // Warn when close to limit (when less than 20% remaining)
    const warningThreshold = Math.max(5, Math.floor(options.max * 0.2));
    if (result.remaining < warningThreshold) {
      console.warn(
        `[RATE_LIMIT] ${identifier} on ${path}: ${result.remaining} of ${options.max} requests remaining (namespace: ${namespace})`
      );
    }

    return next();
  });
};

/**
 * Rate limiting middleware - Uses Redis or in-memory store
 * Default configuration for backward compatibility
 */
const rateLimitMiddleware = createRateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  namespace: "default",
});

/**
 * Audit logging middleware for executive actions and sensitive operations
 */
const auditLogMiddleware = t.middleware(async ({ ctx, next, path, input }) => {
  const startTime = Date.now();
  let result;
  let error = null;

  try {
    result = await next();
  } catch (err) {
    error = err as Error;
    throw err; // Re-throw to maintain error handling
  } finally {
    const endTime = Date.now();

    // Determine if this operation should be audited
    const shouldAudit =
      path.includes("execute") ||
      path.includes("Action") ||
      path.includes("executive") ||
      path.includes("Intelligence") ||
      path.includes("sensitive") ||
      error; // Always audit errors

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
        // Security classification
        securityLevel: path.includes("execute")
          ? "HIGH"
          : path.includes("Intelligence")
            ? "MEDIUM"
            : "LOW",
      };

      // Log based on security level
      if (auditEntry.securityLevel === "HIGH" || error) {
        console.error("[SECURITY_AUDIT]", auditEntry);

        // Persist high-security events to database
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
              }),
              success: auditEntry.success,
              error: auditEntry.errorMessage,
              timestamp: new Date(),
            },
          });
        } catch (dbError) {
          // Don't fail the request if audit logging fails
          console.error("[AUDIT_DB] Failed to persist audit log:", dbError);
        }
      } else if (process.env.NODE_ENV === "development") {
        // Development: Log all actions to console for debugging
        console.log("[AUDIT]", auditEntry);
      }
    }
  }

  return result;
});

/**
 * Premium membership middleware - Validates user has premium access
 */
const premiumMiddleware = t.middleware(async ({ ctx, next }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  // Check membership tier
  const membershipTier = (ctx.user as any).membershipTier || "basic";
  const isPremium = membershipTier === "mycountry_premium";

  if (!isPremium) {
    console.warn(
      `[PREMIUM_ACCESS_DENIED] User ${ctx.auth.userId} (tier: ${membershipTier}) attempted premium content access`
    );
    throw new Error("FORBIDDEN: MyCountry Premium membership required");
  }

  console.log(`[PREMIUM_ACCESS] Premium user ${ctx.auth.userId} accessing premium content`);

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
      isPremium: true,
    },
  });
});

/**
 * Admin role middleware - Validates user has admin permissions
 */
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  // If user wasn't loaded in context, try to load it here
  let user = ctx.user;
  if (!user) {
    console.log(`[ADMIN_MIDDLEWARE] User not in context, loading for ${ctx.auth.userId}`);
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
      throw new Error("UNAUTHORIZED: Failed to load user");
    }
  }

  // Use centralized system owner constants - check BEFORE database role check
  const isSystemOwnerUser = isSystemOwner(ctx.auth.userId);

  // System owners bypass all role checks
  if (isSystemOwnerUser) {
    console.log(`[ADMIN_MIDDLEWARE] System owner detected: ${ctx.auth.userId} - bypassing role checks`);
    return next({
      ctx: {
        ...ctx,
        user,
      },
    });
  }

  // For non-system-owners, require database user record
  if (!user) {
    console.error(`[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} not found in database`);
    throw new Error("UNAUTHORIZED: User not found");
  }

  // SECURITY: Check if user has admin role - NEVER auto-assign roles in middleware
  // Role assignment must ONLY happen through UserManagementService to prevent privilege escalation
  if (!(user as any).role) {
    console.error(
      `[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} has no role assigned (roleId: ${(user as any).roleId}). ` +
      `User record exists but roleId may be NULL or role record may be missing.`
    );
    throw new Error(
      "FORBIDDEN: Your account has no assigned role. This usually means your account was created before the role system was implemented. " +
      "Please try logging out and logging back in, or contact support if the issue persists. " +
      `(User ID: ${ctx.auth.userId.substring(0, 8)}...)`
    );
  }

  // Check for admin roles (level 0-20 are considered admin levels)
  const adminRoles = ["owner", "admin", "staff"];
  const roleLevel = (user as any).role?.level ?? 999;
  const roleName = (user as any).role?.name || "NO_ROLE";
  const isAdmin = adminRoles.includes(roleName) || roleLevel <= 20;

  if (!isAdmin) {
    console.warn(
      `[ADMIN_ACCESS_DENIED] User ${ctx.auth.userId} (role: ${roleName}, level: ${roleLevel}) attempted admin access to: ${ctx.headers.get("x-trpc-path") || "unknown"}`
    );
    throw new Error(
      `FORBIDDEN: Admin privileges required. Your current role is "${roleName}" (level ${roleLevel}), which does not have admin access. ` +
      "Contact a system administrator if you believe this is an error."
    );
  }

  if (isSystemOwnerUser) {
    console.log(
      `[ADMIN_ACCESS] System owner ${ctx.auth.userId} accessing admin functions (hardcoded override)`
    );
  } else {
    console.log(
      `[ADMIN_ACCESS] Admin ${ctx.auth.userId} (role: ${(user as any).role?.name || "NO_ROLE"}, level: ${roleLevel}) accessing admin functions`
    );
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: user,
      isAdmin: true,
    },
  });
});

/**
 * Data privacy middleware - Sanitizes sensitive information in responses
 */
const dataPrivacyMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const result = await next();

  // For intelligence feeds and executive data, ensure sensitive info is filtered
  if (path.includes("Intelligence") || path.includes("executive")) {
    // Log data access for privacy compliance
    console.log(
      `[DATA_PRIVACY] User ${ctx.auth?.userId} accessed ${path} at ${new Date().toISOString()}`
    );

    // Data sanitization based on user permissions handled by individual routers
    // Each router implements appropriate data filtering for public vs authenticated access
  }

  return result;
});

/**
 * Input validation enhancement middleware
 */
const inputValidationMiddleware = t.middleware(async ({ ctx, next, input, path }) => {
  // Enhanced validation for sensitive endpoints
  if (path.includes("execute") || path.includes("Action")) {
    // Validate input doesn't contain potential security risks
    const inputStr = JSON.stringify(input);

    // Check for potential injection attempts
    const suspiciousPatterns = [
      /<script/i, // XSS
      /javascript:/i, // XSS
      /on\w+\s*=/i, // Event handlers
      /union\s+select/i, // SQL injection
      /drop\s+table/i, // SQL injection
      /exec\s*\(/i, // Code execution
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(inputStr)) {
        console.error(
          `[SECURITY] Suspicious input detected from user ${ctx.auth?.userId}: ${pattern}`
        );
        throw new Error("SECURITY_VIOLATION: Invalid input detected");
      }
    }

    // Check input size limits
    if (inputStr.length > 10000) {
      throw new Error("VALIDATION_ERROR: Input too large");
    }
  }

  return next();
});

// Category-specific rate limit middleware
const heavyMutationRateLimit = createRateLimitMiddleware({
  max: 10,
  windowMs: 60000,
  namespace: "heavy_mutations",
});

const standardMutationRateLimit = createRateLimitMiddleware({
  max: 60,
  windowMs: 60000,
  namespace: "mutations",
});

const lightMutationRateLimit = createRateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  namespace: "light_mutations",
});

const readOnlyRateLimit = createRateLimitMiddleware({
  max: 120,
  windowMs: 60000,
  namespace: "queries",
});

const publicRateLimit = createRateLimitMiddleware({
  max: 30,
  windowMs: 60000,
  namespace: "public",
});

// Export all procedure types with appropriate security layers
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
  .use(dataPrivacyMiddleware)
  .use(userLoggingMiddleware.withPerformance);
export const countryOwnerProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(countryOwnerMiddleware)
  .use(dataPrivacyMiddleware)
  .use(userLoggingMiddleware.standard);
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(adminMiddleware)
  .use(inputValidationMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(dataPrivacyMiddleware)
  .use(userLoggingMiddleware.admin);
export const executiveProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(countryOwnerMiddleware)
  .use(inputValidationMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(dataPrivacyMiddleware)
  .use(userLoggingMiddleware.sensitive);

/**
 * RATE-LIMITED PROCEDURE VARIANTS
 *
 * Use these procedures for mutations to prevent API abuse and ensure fair resource allocation.
 * Choose the appropriate variant based on the operation's resource intensity:
 *
 * - heavyMutationProcedure: For resource-intensive operations (10 req/min)
 *   Examples: createCountry, bulkUpdate, calculateEconomy, massImport
 *
 * - standardMutationProcedure: For normal mutation operations (60 req/min)
 *   Examples: updateProfile, createPost, submitForm, updateSettings
 *
 * - lightMutationProcedure: For lightweight mutations (100 req/min)
 *   Examples: toggleLike, markAsRead, updatePreference, simpleUpdate
 *
 * - readOnlyProcedure: For read-heavy operations (120 req/min)
 *   Examples: getCountries, searchUsers, getStatistics, listData
 *
 * - rateLimitedPublicProcedure: For public endpoints (30 req/min)
 *   Examples: publicSearch, publicStats, publicData
 */

// Heavy mutation procedures (10 req/min) - for resource-intensive operations
export const heavyMutationProcedure = protectedProcedure
  .use(heavyMutationRateLimit)
  .use(inputValidationMiddleware)
  .use(auditLogMiddleware);

export const heavyMutationCountryOwnerProcedure = countryOwnerProcedure
  .use(heavyMutationRateLimit)
  .use(inputValidationMiddleware)
  .use(auditLogMiddleware);

// Standard mutation procedures (60 req/min) - for normal mutations
export const standardMutationProcedure = protectedProcedure
  .use(standardMutationRateLimit)
  .use(inputValidationMiddleware);

export const standardMutationCountryOwnerProcedure = countryOwnerProcedure
  .use(standardMutationRateLimit)
  .use(inputValidationMiddleware);

export const standardMutationPremiumProcedure = premiumProcedure
  .use(standardMutationRateLimit)
  .use(inputValidationMiddleware);

// Light mutation procedures (100 req/min) - for lightweight mutations
export const lightMutationProcedure = protectedProcedure.use(lightMutationRateLimit);

export const lightMutationCountryOwnerProcedure = countryOwnerProcedure.use(lightMutationRateLimit);

// Read-only procedures (120 req/min) - for read-heavy operations
export const readOnlyProcedure = protectedProcedure.use(readOnlyRateLimit);

export const readOnlyPublicProcedure = publicProcedure.use(readOnlyRateLimit);

// Public rate-limited procedures (30 req/min)
export const rateLimitedPublicProcedure = publicProcedure.use(publicRateLimit);
