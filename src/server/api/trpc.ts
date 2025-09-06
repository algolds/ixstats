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
import type { NextRequest } from "next/server";

import { db } from "~/server/db";

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
    if (opts.req) {
      auth = getAuth(opts.req);
      if (auth?.userId) {
        // Get user from database to include country ownership info
        user = await db.user.findUnique({
          where: { clerkUserId: auth.userId },
          include: { country: true }
        });
      }
    }
  } catch (error) {
    console.warn('[TRPC Context] Auth extraction failed:', error);
    // Continue without auth rather than failing
  }

  return {
    db,
    auth,
    user,
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
  errorFormatter({ shape, error }) {
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

// In-memory rate limiting store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware for sensitive operations
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const userId = ctx.auth?.userId;
  if (!userId) {
    return next(); // Skip rate limiting for unauthenticated requests
  }

  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = path.includes('execute') ? 5 : 30; // 5 executions or 30 queries per minute
  
  const key = `${userId}:${path}`;
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // Create new or reset expired record
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
  } else {
    // Check if limit exceeded
    if (record.count >= maxRequests) {
      console.warn(`[RATE_LIMIT] User ${userId} exceeded rate limit for ${path}`);
      throw new Error('RATE_LIMITED: Too many requests - please wait before trying again');
    }
    
    // Increment counter
    record.count++;
  }
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    const cutoff = now - windowMs;
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetTime < cutoff) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  console.log(`[RATE_LIMIT] ${userId} accessing ${path} (${record?.count || 1}/${maxRequests})`);
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
      } else {
        console.log('[AUDIT]', auditEntry);
      }
      
      // TODO: Implement database audit logging
      // try {
      //   await db.securityAuditLog.create({
      //     data: {
      //       ...auditEntry,
      //       inputData: JSON.stringify(input),
      //       resultData: error ? null : JSON.stringify(result),
      //     }
      //   });
      // } catch (dbError) {
      //   console.error('[AUDIT_DB] Failed to log audit entry:', dbError);
      // }
    }
  }
  
  return result;
});

/**
 * Admin role middleware - Validates user has admin permissions
 */
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  // First ensure user is authenticated
  if (!ctx.auth?.userId || !ctx.user) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  // Check if user has admin role
  if (!ctx.user.role) {
    throw new Error('FORBIDDEN: No role assigned');
  }

  // Check for admin roles (level 0-20 are considered admin levels)
  const adminRoles = ['owner', 'admin', 'staff'];
  const isAdmin = adminRoles.includes(ctx.user.role.name) || ctx.user.role.level <= 20;

  if (!isAdmin) {
    console.warn(`[ADMIN_ACCESS_DENIED] User ${ctx.auth.userId} (role: ${ctx.user.role.name}) attempted admin access`);
    throw new Error('FORBIDDEN: Admin privileges required');
  }

  console.log(`[ADMIN_ACCESS] Admin ${ctx.auth.userId} (role: ${ctx.user.role.name}) accessing admin functions`);

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
      user: ctx.user,
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
    
    // TODO: Implement data sanitization based on user permissions
    // This would filter out sensitive information based on user role/permissions
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
