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
      const authHeader = opts.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const verifiedToken = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY!,
          });
          if (verifiedToken?.sub) {
            auth = { userId: verifiedToken.sub };
          }
        } catch (tokenError) {
          console.warn('[TRPC Context] Token verification failed:', tokenError);
        }
      }
    }

    // Get user from database if we have a userId
    if (auth?.userId) {
      try {
        user = await db.user.findUnique({
          where: { clerkUserId: auth.userId },
          include: {
            country: true,
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        });

        if (user) {
          console.log(`[TRPC Context] User loaded: ${auth.userId}, role: ${(user as any).role?.name || 'NO_ROLE'}, roleId: ${(user as any).roleId || 'NULL'}`);
        } else {
          // Auto-create user if authenticated but not in database
          console.warn(`[TRPC Context] User ${auth.userId} authenticated but not found in database - auto-creating`);

          try {
            // Get default user role
            const defaultRole = await db.role.findFirst({
              where: { name: 'user' }
            });

            // Create user with default role
            user = await db.user.create({
              data: {
                clerkUserId: auth.userId,
                roleId: defaultRole?.id || null,
              },
              include: {
                country: true,
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            });

            console.log(`[TRPC Context] Auto-created user ${auth.userId} with role: ${(user as any).role?.name || 'NO_ROLE'}`);
          } catch (createError) {
            console.error('[TRPC Context] Failed to auto-create user:', createError);
            // Continue without user rather than failing
          }
        }
      } catch (dbError) {
        console.error('[TRPC Context] Database user lookup failed:', dbError);
        // Continue without user rather than failing - auth is still valid
      }
    }
  } catch (error) {
    console.warn('[TRPC Context] Auth extraction failed:', error);
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
    if (process.env.NODE_ENV === 'production' && error.code !== 'BAD_REQUEST') {
      // Import ErrorLogger dynamically to avoid circular dependencies
      import('~/lib/error-logger').then(({ ErrorLogger }) => {
        ErrorLogger.logAPIError(
          path || 'unknown',
          error as Error,
          {
            userId: ctx?.auth?.userId ?? undefined,
            countryId: ctx?.user?.countryId ?? undefined,
            path: path || 'unknown',
            action: 'TRPC_ERROR',
            metadata: {
              code: error.code,
              httpStatus: shape.data.httpStatus,
            }
          }
        ).catch(logError => {
          console.error('[TRPC] Failed to log error:', logError);
        });
      }).catch(() => {
        // Silent fail if ErrorLogger import fails
      });
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
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
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  // Check if user is authenticated via Clerk
  if (!ctx.auth?.userId) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  // Ensure user exists in our database
  if (!ctx.user) {
    throw new Error('UNAUTHORIZED: User not found in system');
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
    }
  });
});

/**
 * Country ownership middleware - Validates user owns a country
 */
const countryOwnerMiddleware = t.middleware(async ({ ctx, next }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  // Check if user has a linked country
  if (!ctx.user.countryId || !ctx.user.country) {
    throw new Error('FORBIDDEN: Country ownership required');
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
      country: ctx.user.country,
    }
  });
});

/**
 * Rate limiting middleware - Uses Redis or in-memory store
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (!rateLimiter.isEnabled()) {
    return next();
  }

  // Use rate limit identifier from context (set by middleware)
  const identifier = ctx.rateLimitIdentifier;

  // Different limits for different types of operations
  const namespace = path.includes('execute') || path.includes('create') || path.includes('update')
    ? 'mutations'
    : 'queries';

  const result = await rateLimiter.check(identifier, namespace);

  if (!result.success) {
    console.warn(`[RATE_LIMIT] ${identifier} exceeded rate limit for ${path}`);
    throw new Error(
      `RATE_LIMITED: Too many requests. Try again at ${result.resetAt.toISOString()}`
    );
  }

  // Warn when close to limit
  if (result.remaining < 10) {
    console.warn(
      `[RATE_LIMIT] ${identifier} on ${path}: ${result.remaining} requests remaining`
    );
  }

  return next();
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
      path.includes('execute') || 
      path.includes('Action') || 
      path.includes('executive') ||
      path.includes('Intelligence') ||
      path.includes('sensitive') ||
      error; // Always audit errors
    
    if (shouldAudit) {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        userId: ctx.auth?.userId || 'anonymous',
        action: path,
        method: 'tRPC',
        success: !error,
        duration: endTime - startTime,
        errorMessage: error?.message || null,
        countryId: (input as any)?.countryId || ctx.user?.countryId || null,
        userAgent: ctx.headers?.get('user-agent')?.slice(0, 200) || null,
        ip: ctx.headers?.get('x-forwarded-for') || ctx.headers?.get('x-real-ip') || null,
        inputSummary: input ? Object.keys(input as object).join(',') : null,
        // Security classification
        securityLevel: path.includes('execute') ? 'HIGH' : 
                      path.includes('Intelligence') ? 'MEDIUM' : 'LOW',
      };
      
      // Log based on security level
      if (auditEntry.securityLevel === 'HIGH' || error) {
        console.error('[SECURITY_AUDIT]', auditEntry);

        // Persist high-security events to database
        try {
          await ctx.db.auditLog.create({
            data: {
              userId: auditEntry.userId || 'anonymous',
              action: auditEntry.action,
              details: JSON.stringify({
                method: auditEntry.method,
                duration: auditEntry.duration,
                securityLevel: auditEntry.securityLevel,
                ip: auditEntry.ip,
                userAgent: auditEntry.userAgent,
                inputSummary: auditEntry.inputSummary
              }),
              success: auditEntry.success,
              error: auditEntry.errorMessage,
              timestamp: new Date()
            }
          });
        } catch (dbError) {
          // Don't fail the request if audit logging fails
          console.error('[AUDIT_DB] Failed to persist audit log:', dbError);
        }
      } else if (process.env.NODE_ENV === 'development') {
        // Development: Log all actions to console for debugging
        console.log('[AUDIT]', auditEntry);
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
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  // Check membership tier
  const membershipTier = (ctx.user as any).membershipTier || 'basic';
  const isPremium = membershipTier === 'mycountry_premium';

  if (!isPremium) {
    console.warn(`[PREMIUM_ACCESS_DENIED] User ${ctx.auth.userId} (tier: ${membershipTier}) attempted premium content access`);
    throw new Error('FORBIDDEN: MyCountry Premium membership required');
  }

  console.log(`[PREMIUM_ACCESS] Premium user ${ctx.auth.userId} accessing premium content`);

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
      isPremium: true,
    }
  });
});

/**
 * Admin role middleware - Validates user has admin permissions
 */
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId) {
    throw new Error('UNAUTHORIZED: Authentication required');
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
                  permission: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error(`[ADMIN_MIDDLEWARE] Failed to load user:`, error);
      throw new Error('UNAUTHORIZED: Failed to load user');
    }
  }

  if (!user) {
    console.error(`[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} not found in database`);
    throw new Error('UNAUTHORIZED: User not found');
  }

  // Check if user has admin role - if not, try to assign default role
  if (!(user as any).role) {
    console.warn(`[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} has no role assigned (roleId: ${(user as any).roleId}), attempting to assign default role`);

    // Try to get the default user role
    try {
      const defaultRole = await db.role.findFirst({
        where: { name: 'user' }
      });

      if (defaultRole && !(user as any).roleId) {
        // User has no roleId at all - assign default role
        user = await db.user.update({
          where: { clerkUserId: ctx.auth.userId },
          data: { roleId: defaultRole.id },
          include: {
            country: true,
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        });
        console.log(`[ADMIN_MIDDLEWARE] Assigned default role to user ${ctx.auth.userId}`);
      }

      // After attempting to assign role, check again
      if (!(user as any).role) {
        console.error(`[ADMIN_MIDDLEWARE] User ${ctx.auth.userId} still has no role after attempted assignment`);
        throw new Error('FORBIDDEN: No role assigned and unable to assign default role');
      }
    } catch (roleError) {
      console.error(`[ADMIN_MIDDLEWARE] Failed to assign default role:`, roleError);
      throw new Error('FORBIDDEN: No role assigned');
    }
  }

  // Check for admin roles (level 0-20 are considered admin levels)
  const adminRoles = ['owner', 'admin', 'staff'];
  const isAdmin = adminRoles.includes((user as any).role.name) || (user as any).role.level <= 20;

  if (!isAdmin) {
    console.warn(`[ADMIN_ACCESS_DENIED] User ${ctx.auth.userId} (role: ${(user as any).role.name}) attempted admin access`);
    throw new Error('FORBIDDEN: Admin privileges required');
  }

  console.log(`[ADMIN_ACCESS] Admin ${ctx.auth.userId} (role: ${(user as any).role.name}) accessing admin functions`);

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: user,
      isAdmin: true,
    }
  });
});

/**
 * Data privacy middleware - Sanitizes sensitive information in responses
 */
const dataPrivacyMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const result = await next();
  
  // For intelligence feeds and executive data, ensure sensitive info is filtered
  if (path.includes('Intelligence') || path.includes('executive')) {
    // Log data access for privacy compliance
    console.log(`[DATA_PRIVACY] User ${ctx.auth?.userId} accessed ${path} at ${new Date().toISOString()}`);
    
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
  if (path.includes('execute') || path.includes('Action')) {
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
        console.error(`[SECURITY] Suspicious input detected from user ${ctx.auth?.userId}: ${pattern}`);
        throw new Error('SECURITY_VIOLATION: Invalid input detected');
      }
    }
    
    // Check input size limits
    if (inputStr.length > 10000) {
      throw new Error('VALIDATION_ERROR: Input too large');
    }
  }
  
  return next();
});

// Export all procedure types with appropriate security layers
export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure.use(timingMiddleware).use(authMiddleware);
export const premiumProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(premiumMiddleware)
  .use(dataPrivacyMiddleware);
export const countryOwnerProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(countryOwnerMiddleware)
  .use(dataPrivacyMiddleware);
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(adminMiddleware)
  .use(inputValidationMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(dataPrivacyMiddleware);
export const executiveProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(countryOwnerMiddleware)
  .use(inputValidationMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(dataPrivacyMiddleware);
