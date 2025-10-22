# IxStats Troubleshooting Guide v1.2
**Last Updated: October 22, 2025**
**Version:** v1.2.0

Comprehensive troubleshooting guide for IxStats development and production environments. This guide covers common issues, their root causes, and step-by-step solutions.

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Installation & Setup Issues](#installation--setup-issues)
- [Database Problems](#database-problems)
- [Authentication & Authorization](#authentication--authorization)
- [Build & Deployment](#build--deployment)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Rate Limiting](#rate-limiting)
- [Builder System Issues](#builder-system-issues)
- [Data Persistence Problems](#data-persistence-problems)
- [Production-Specific Issues](#production-specific-issues)
- [External Service Integration](#external-service-integration)
- [Debugging Workflows](#debugging-workflows)

---

## Quick Diagnostics

### Health Check Commands
Run these commands to quickly identify issues:

```bash
# Verify Node.js and npm versions
node --version  # Should be v18.17.0 or higher
npm --version   # Should be 9.0.0 or higher

# Run comprehensive checks
npm run check  # Runs lint + typecheck
npm run typecheck  # TypeScript validation only
npm run lint  # ESLint validation only

# Test database connection
npm run db:studio  # Opens Prisma Studio (port 5555)

# Check environment configuration
npm run auth:check:dev  # Development environment
npm run auth:check:prod  # Production environment

# Verify production build
npm run build:fast  # Fast build without full validation
npm run verify:production  # Full production readiness check
```

### Common Error Quick Reference

| Error Pattern | Quick Fix | Section |
|--------------|-----------|---------|
| `ENOENT: no such file` | Run `npm install` | [Installation](#installation--setup-issues) |
| `PrismaClientInitializationError` | Run `npm run db:setup` | [Database](#database-problems) |
| `CLERK_SECRET_KEY is not set` | Add to `.env.local` | [Authentication](#authentication--authorization) |
| `Type error: Cannot find module` | Run `npm run db:generate` | [Build](#build--deployment) |
| `Port already in use` | Kill process or change port | [Runtime](#runtime-errors) |
| `Rate limit exceeded` | Adjust limits in env | [Rate Limiting](#rate-limiting) |
| `Builder data not saving` | Check persistence hooks | [Builder System](#builder-system-issues) |
| `Webhook failed` | Verify Discord webhook URL | [External Services](#external-service-integration) |

---

## Installation & Setup Issues

### Problem: npm install Fails with Dependency Conflicts

**Symptoms:**
```bash
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! ERESOLVE could not resolve
```

**Root Cause:** Conflicting peer dependencies or corrupted package lock.

**Solutions:**

1. **Clear npm cache and reinstall:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verify Node.js version:**
   ```bash
   node --version  # Must be v18.17.0+

   # If using nvm, switch version
   nvm use 18
   npm install
   ```

3. **Check disk space:**
   ```bash
   df -h  # Linux/Mac
   # Ensure at least 2GB free for node_modules
   ```

4. **Try legacy peer deps (last resort):**
   ```bash
   npm install --legacy-peer-deps
   # Note: This may cause runtime issues, use cautiously
   ```

---

### Problem: Prisma Client Not Generated

**Symptoms:**
```bash
Error: Cannot find module '@prisma/client'
Cannot find module '.prisma/client'
```

**Root Cause:** Prisma client not generated after schema changes or fresh install.

**Solutions:**

```bash
# Generate Prisma client
npm run db:generate

# If that fails, try manual generation
npx prisma generate

# Verify generation succeeded
ls -la node_modules/.prisma/client
# Should show generated files

# If still failing, check Prisma schema
npx prisma validate
# Will show schema errors if any

# Clear Prisma cache and regenerate
rm -rf node_modules/.prisma
npm run db:generate
```

**Prevention:**
- Always run `npm run db:generate` after pulling schema changes
- Add to your git hooks to auto-generate on checkout

---

### Problem: Environment Variables Not Loading

**Symptoms:**
- `undefined` values for environment variables
- Features not working as expected
- Authentication failing

**Root Cause:** Wrong file name, incorrect syntax, or server not restarted.

**Solutions:**

1. **Verify file name and location:**
   ```bash
   ls -la | grep env
   # Should see: .env.local (development) or .env.production (production)
   # NOT: env.local or .env-local
   ```

2. **Check file syntax:**
   ```bash
   cat .env.local
   # Correct format:
   DATABASE_URL="file:./dev.db"
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

   # WRONG (spaces around =):
   DATABASE_URL = "file:./dev.db"
   ```

3. **Restart development server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   # Environment variables only load on server start
   ```

4. **Verify variables are loaded:**
   ```typescript
   // Add temporary debug log in your code
   console.log("DATABASE_URL:", process.env.DATABASE_URL);
   console.log("CLERK_SECRET_KEY:", process.env.CLERK_SECRET_KEY?.substring(0, 10) + "...");
   ```

5. **Check Next.js public variable prefix:**
   ```bash
   # Client-side variables MUST start with NEXT_PUBLIC_
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."  # ✅ Works in browser
   CLERK_SECRET_KEY="sk_test_..."                    # ❌ Server-only, not in browser
   ```

---

## Database Problems

### Problem: Database Migration Fails

**Symptoms:**
```bash
Error: P3009 migrate found failed migrations
Error: Migration failed to apply
Database schema is out of sync
```

**Root Cause:** Incomplete migration, schema conflicts, or database lock.

**Solutions:**

**For Development (SQLite):**
```bash
# Nuclear option: Reset database
npm run db:reset
npm run db:setup

# Verify schema
npx prisma validate

# Check migration status
npx prisma migrate status

# If specific migration failed, mark as rolled back
npx prisma migrate resolve --rolled-back "20251020_migration_name"
npm run db:migrate
```

**For Production (PostgreSQL):**
```bash
# ALWAYS backup first
npm run db:backup

# Check migration status
npx prisma migrate status

# Deploy pending migrations
npm run db:migrate:deploy

# If migration fails, check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Rollback option (if safe)
# Manually revert database changes, then:
npx prisma migrate resolve --rolled-back "migration_name"
```

**Common Migration Errors:**

| Error Code | Meaning | Solution |
|------------|---------|----------|
| P3009 | Failed migration found | Resolve or rollback failed migration |
| P3005 | Non-empty database | Use `npx prisma migrate dev --force` (dev only) |
| P3014 | Migration needs manual action | Review migration file, apply manually if needed |
| P1017 | Connection timeout | Check database server is running |

---

### Problem: Database Locked (SQLite)

**Symptoms:**
```bash
Error: SQLITE_BUSY: database is locked
Error: database is locked
```

**Root Cause:** Multiple processes accessing SQLite database simultaneously.

**Solutions:**

```bash
# 1. Close Prisma Studio
kill $(lsof -ti:5555)

# 2. Stop development server
# Press Ctrl+C in terminal running npm run dev

# 3. Check for other processes using database
lsof prisma/dev.db
# Kill any processes shown

# 4. If database is corrupted, restore from backup
cp prisma/backups/dev-backup-YYYYMMDD.db prisma/dev.db

# 5. Restart fresh
npm run dev
```

**Prevention:**
- Don't run multiple development servers simultaneously
- Close Prisma Studio when not needed
- Use PostgreSQL for production (better concurrent access)

---

### Problem: Schema Out of Sync with Database

**Symptoms:**
```bash
Error: The provided value for the column is too long
Error: Unknown column 'xyz' in 'field list'
Type 'X' is not assignable to type 'Y'
```

**Root Cause:** Database schema doesn't match Prisma schema file.

**Solutions:**

```bash
# Development: Push schema changes (WARNING: may lose data)
npm run db:push

# Better: Create migration for schema changes
npm run db:migrate
# This creates a migration file you can review

# Verify schema is valid
npx prisma validate

# Check what would change
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script

# Production: Deploy migrations only
npm run db:migrate:deploy
```

**Debugging Schema Issues:**
```bash
# Compare database schema to Prisma schema
npx prisma db pull --print
# This shows what Prisma thinks the database looks like

# If there's drift, options:
# 1. Update Prisma schema to match database
# 2. Create migration to update database to match Prisma schema
```

---

## Authentication & Authorization

### Problem: Clerk Authentication Not Working

**Symptoms:**
```bash
Error: CLERK_SECRET_KEY is not set
ClerkProviderError: Clerk not initialized
useUser must be used within ClerkProvider
```

**Root Cause:** Missing Clerk configuration or incorrect middleware setup.

**Solutions:**

1. **Add Clerk environment variables:**
   ```bash
   # Get from https://dashboard.clerk.com -> Your App -> API Keys

   # For Development (.env.local):
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."

   # For Production (.env.production):
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
   CLERK_SECRET_KEY="sk_live_..."
   ```

2. **Restart development server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. **Verify ClerkProvider in layout:**
   ```typescript
   // src/app/layout.tsx
   import { ClerkProvider } from "@clerk/nextjs";

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <ClerkProvider>
         <html lang="en">
           <body>{children}</body>
         </html>
       </ClerkProvider>
     );
   }
   ```

4. **Check Clerk middleware configuration:**
   ```typescript
   // src/middleware.ts
   import { clerkMiddleware } from "@clerk/nextjs/server";

   export default clerkMiddleware();

   export const config = {
     matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
   };
   ```

5. **Verify Clerk Dashboard settings:**
   - Go to Clerk Dashboard → Your App → Paths
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/dashboard` or `/mycountry`
   - After sign-up URL: `/builder` or `/setup`

---

### Problem: Authentication Redirect Loop

**Symptoms:**
- Browser continuously redirects between sign-in and protected pages
- Cannot access any protected routes
- Sign-in appears successful but immediately redirects back

**Root Cause:** Middleware configuration conflict or Clerk path mismatch.

**Solutions:**

1. **Clear browser data:**
   ```
   - Open DevTools → Application tab
   - Clear site data (cookies, localStorage, sessionStorage)
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   ```

2. **Check middleware publicRoutes:**
   ```typescript
   // src/middleware.ts
   import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

   const isPublicRoute = createRouteMatcher([
     "/",
     "/sign-in(.*)",
     "/sign-up(.*)",
     "/api/trpc/(.*)",  // tRPC endpoints
     "/countries(.*)",  // Public country viewing
   ]);

   export default clerkMiddleware((auth, request) => {
     if (!isPublicRoute(request)) {
       auth().protect();
     }
   });
   ```

3. **Verify Clerk webhook URLs (if using):**
   ```bash
   # In .env.local
   WEBHOOK_SECRET="whsec_..."

   # Ensure webhook endpoint is public
   # src/app/api/webhooks/clerk/route.ts
   ```

4. **Test without middleware temporarily:**
   ```typescript
   // Temporarily disable middleware to test
   // Comment out auth protection in src/middleware.ts

   // If it works without middleware, the issue is in middleware config
   ```

5. **Check for conflicting redirects:**
   ```typescript
   // Search codebase for redirect() calls
   grep -r "redirect(" src/

   // Look for circular redirect logic
   ```

---

### Problem: User Permissions Not Working

**Symptoms:**
- Admin panel not accessible
- "Unauthorized" errors on protected endpoints
- User role not detected correctly

**Root Cause:** Role not assigned, metadata not syncing, or middleware not checking roles.

**Solutions:**

1. **Verify user role in database:**
   ```bash
   npm run db:studio
   # Open User table → find your user → check role relation
   ```

2. **Assign admin role via script:**
   ```bash
   # Set admin role for specific user
   npm run script:set-admin -- user_2xyz789abc123

   # Or run the manual script
   npx tsx scripts/set-admin-role.ts
   ```

3. **Check Clerk public metadata:**
   ```typescript
   // In Clerk Dashboard → Users → Select User → Metadata
   // Public metadata should contain:
   {
     "role": "ADMIN",
     "countryId": "clx8a1b2c3d4e5f6g7h8i9j0"
   }
   ```

4. **Verify middleware role check:**
   ```typescript
   // src/server/api/trpc.ts
   export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
     const user = await ctx.db.user.findUnique({
       where: { clerkUserId: ctx.auth.userId },
       include: { role: true }
     });

     if (!user || user.role.name !== "ADMIN") {
       throw new TRPCError({ code: "UNAUTHORIZED" });
     }

     return next({ ctx: { ...ctx, user } });
   });
   ```

5. **Force role refresh:**
   ```bash
   # Clear Clerk session
   # Sign out and sign in again

   # Or run sync script
   npm run script:sync-user-roles
   ```

---

## Build & Deployment

### Problem: Build Fails with TypeScript Errors

**Symptoms:**
```bash
Type error: Property 'xyz' does not exist on type 'ABC'
Build failed: TypeScript compilation failed
```

**Root Cause:** Type mismatches, missing type definitions, or schema drift.

**Solutions:**

1. **Run typecheck independently:**
   ```bash
   npm run typecheck
   # This shows all TypeScript errors without building
   ```

2. **Common type error fixes:**
   ```bash
   # Regenerate Prisma types
   npm run db:generate

   # Restart TypeScript server in VS Code
   # Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

   # Clear TypeScript cache
   rm -rf .next/cache
   rm -rf .tsbuildinfo
   ```

3. **Check for common type issues:**
   ```typescript
   // ❌ BAD: Accessing property without null check
   const name = country.nationalIdentity.motto;

   // ✅ GOOD: Optional chaining
   const name = country.nationalIdentity?.motto;

   // ❌ BAD: Wrong type from database
   const count: number = await db.country.count();  // Returns object

   // ✅ GOOD: Correct type handling
   const { _count } = await db.country.aggregate({ _count: true });
   ```

4. **Emergency build (skip type checking):**
   ```bash
   # Only use for emergency deployments
   npm run build:no-check

   # Or set in next.config.js temporarily
   typescript: {
     ignoreBuildErrors: true,  // ONLY FOR DEBUGGING
   }
   ```

5. **Identify specific type errors:**
   ```bash
   # Check types for specific file
   npx tsc --noEmit src/path/to/file.ts

   # Show type information
   npx tsc --noEmit --pretty
   ```

---

### Problem: Build Timeout or Out of Memory

**Symptoms:**
```bash
FATAL ERROR: Reached heap limit Allocation failed
JavaScript heap out of memory
Command timed out after 10 minutes
```

**Root Cause:** Insufficient memory allocation or large bundle size.

**Solutions:**

1. **Increase Node.js memory:**
   ```bash
   # Set higher memory limit (8GB)
   NODE_OPTIONS='--max-old-space-size=8192' npm run build

   # Or add to package.json scripts:
   "build": "NODE_OPTIONS='--max-old-space-size=8192' next build"
   ```

2. **Use fast build:**
   ```bash
   # Skip validation steps
   npm run build:fast

   # Or build without lint
   npm run build:no-check
   ```

3. **Check bundle size:**
   ```bash
   # Analyze bundle after build
   npm run build
   # Check .next/build-manifest.json

   # Look for large dependencies
   npm ls --depth=0 | sort
   ```

4. **Reduce build load:**
   ```bash
   # Clear build cache
   rm -rf .next

   # Reduce concurrent processes
   NODE_OPTIONS='--max-old-space-size=4096 --max-old-space-size=4096' npm run build

   # Close other applications during build
   ```

5. **Production build optimization:**
   ```javascript
   // next.config.js
   module.exports = {
     swcMinify: true,  // Faster minification
     compiler: {
       removeConsole: process.env.NODE_ENV === "production",  // Remove console.logs
     },
     experimental: {
       optimizeCss: true,  // Optimize CSS
     }
   };
   ```

---

### Problem: Production Build Missing Environment Variables

**Symptoms:**
- Build succeeds but app fails at runtime
- Features work locally but not in production
- "undefined" values in production

**Root Cause:** Environment variables not available during build or runtime.

**Solutions:**

1. **Separate build-time and runtime variables:**
   ```bash
   # Build-time (baked into bundle)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
   NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com"

   # Runtime (server-side only)
   DATABASE_URL="postgresql://..."
   CLERK_SECRET_KEY="sk_live_..."
   ```

2. **Set variables in deployment platform:**
   ```bash
   # Example for Vercel
   vercel env add DATABASE_URL production
   vercel env add CLERK_SECRET_KEY production

   # Example for Docker
   docker run -e DATABASE_URL="..." -e CLERK_SECRET_KEY="..." ...
   ```

3. **Verify production environment file:**
   ```bash
   # Check .env.production exists
   ls -la .env.production

   # Ensure no spaces in variable definitions
   cat .env.production
   ```

4. **Use environment validation:**
   ```typescript
   // src/env.js
   import { createEnv } from "@t3-oss/env-nextjs";
   import { z } from "zod";

   export const env = createEnv({
     server: {
       DATABASE_URL: z.string().url(),
       CLERK_SECRET_KEY: z.string().min(1),
     },
     client: {
       NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
     },
     runtimeEnv: {
       DATABASE_URL: process.env.DATABASE_URL,
       CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
       NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
     },
   });
   ```

---

## Runtime Errors

### Problem: tRPC Query/Mutation Fails

**Symptoms:**
```bash
TRPCClientError: Unexpected token in JSON
TRPCClientError: Failed to fetch
INTERNAL_SERVER_ERROR
```

**Root Cause:** Server error, network issue, or invalid input.

**Solutions:**

1. **Enable tRPC debugging:**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_TRPC_DEBUG="true"

   # Check browser console for detailed errors
   ```

2. **Test API endpoint directly:**
   ```bash
   # Check if tRPC endpoint is accessible
   curl http://localhost:3000/api/trpc/countries.getAll

   # Should return JSON (might be error, but should respond)
   ```

3. **Check database connection:**
   ```bash
   # Open Prisma Studio
   npm run db:studio

   # If this fails, database connection is broken
   ```

4. **Inspect network request:**
   ```
   # Browser DevTools → Network tab
   # Look for API calls to /api/trpc/
   # Check:
   - Request payload
   - Response body
   - Status code
   - Response headers
   ```

5. **Common tRPC error fixes:**
   ```typescript
   // ❌ BAD: Wrong input type
   api.countries.getById.useQuery({ id: 123 });  // ID should be string

   // ✅ GOOD: Correct input type
   api.countries.getById.useQuery({ id: "clx8a1b2c3..." });

   // ❌ BAD: Accessing data without null check
   const name = data.countryName;  // data might be undefined

   // ✅ GOOD: Optional chaining
   const name = data?.countryName ?? "Unknown";
   ```

6. **Check server logs:**
   ```bash
   # Development server logs
   # Look for error stack traces in terminal running npm run dev

   # Production logs
   tail -f logs/production.log
   ```

---

### Problem: Hydration Mismatch Errors

**Symptoms:**
```bash
Hydration failed because the initial UI does not match
Text content does not match server-rendered HTML
Warning: Expected server HTML to contain...
```

**Root Cause:** Server-rendered HTML differs from client-rendered HTML.

**Solutions:**

1. **Use `useEffect` for client-only code:**
   ```typescript
   "use client";

   import { useState, useEffect } from "react";

   function MyComponent() {
     const [mounted, setMounted] = useState(false);

     useEffect(() => {
       setMounted(true);
     }, []);

     if (!mounted) {
       return null;  // or return loading skeleton
     }

     return <div>{new Date().toString()}</div>;
   }
   ```

2. **Suppress hydration warning (if intentional):**
   ```typescript
   <div suppressHydrationWarning>
     {new Date().toString()}
   </div>
   ```

3. **Common hydration issues:**
   ```typescript
   // ❌ BAD: Random data that changes between server/client
   <div>{Math.random()}</div>

   // ❌ BAD: Date that differs between renders
   <div>{new Date().toString()}</div>

   // ❌ BAD: localStorage access on server
   const value = localStorage.getItem("key");  // Crashes on server

   // ✅ GOOD: Use client-side only
   const [value, setValue] = useState<string | null>(null);

   useEffect(() => {
     setValue(localStorage.getItem("key"));
   }, []);
   ```

4. **Check for HTML structure mismatches:**
   ```typescript
   // ❌ BAD: Conditional rendering that differs
   {isServer ? <div>Server</div> : <span>Client</span>}

   // ✅ GOOD: Consistent structure
   <div>{isServer ? "Server" : "Client"}</div>
   ```

---

## Performance Issues

### Problem: Slow Page Load Times

**Symptoms:**
- Pages take 3+ seconds to load
- Spinner shows for extended periods
- Poor Lighthouse scores
- High Time to First Byte (TTFB)

**Root Cause:** N+1 queries, large bundles, or inefficient rendering.

**Solutions:**

1. **Optimize database queries:**
   ```typescript
   // ❌ BAD: N+1 query
   const countries = await db.country.findMany();
   for (const country of countries) {
     country.economicData = await db.economicData.findUnique({
       where: { countryId: country.id }
     });
   }

   // ✅ GOOD: Single query with include
   const countries = await db.country.findMany({
     include: {
       economicData: true,
       diplomaticRelations: true,
     }
   });

   // ✅ EVEN BETTER: Select only needed fields
   const countries = await db.country.findMany({
     select: {
       id: true,
       countryName: true,
       currentTotalGdp: true,
       economicData: {
         select: {
           gdpGrowthRate: true,
           inflationRate: true,
         }
       }
     }
   });
   ```

2. **Use React optimization patterns:**
   ```typescript
   import React, { useMemo, useCallback } from "react";

   // Memoize expensive components
   export const ExpensiveComponent = React.memo(function ExpensiveComponent({ data }) {
     // Component that re-renders infrequently
     return <div>{/* ... */}</div>;
   });

   // Memoize expensive calculations
   const sortedData = useMemo(() => {
     return data.sort((a, b) => b.gdp - a.gdp);
   }, [data]);

   // Memoize callbacks
   const handleClick = useCallback(() => {
     // Handle click
   }, [dependency]);
   ```

3. **Implement code splitting:**
   ```typescript
   import dynamic from "next/dynamic";

   // Lazy load heavy components
   const HeavyChart = dynamic(() => import("./HeavyChart"), {
     loading: () => <LoadingSpinner />,
     ssr: false,  // Skip server-side rendering if not needed
   });

   // Lazy load admin features
   const AdminPanel = dynamic(() => import("./AdminPanel"), {
     loading: () => <div>Loading admin panel...</div>,
   });
   ```

4. **Add caching:**
   ```typescript
   // tRPC procedure with caching
   getCountries: publicProcedure
     .query(async ({ ctx }) => {
       const cacheKey = "countries:all";
       const cached = cache.get(cacheKey);

       if (cached) return cached;

       const countries = await ctx.db.country.findMany();
       cache.set(cacheKey, countries, { ttl: 300 });  // 5 minutes

       return countries;
     }),
   ```

5. **Monitor performance:**
   ```typescript
   // Add performance logging
   console.time("Database Query");
   const countries = await db.country.findMany();
   console.timeEnd("Database Query");

   // Use React DevTools Profiler
   // Profiler tab → Record → Interact → Stop → Analyze
   ```

---

### Problem: Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Browser becomes slow and unresponsive
- `useEffect` cleanup warnings in console
- Tab crashes after extended use

**Root Cause:** Uncleaned event listeners, intervals, or subscriptions.

**Solutions:**

1. **Always cleanup in useEffect:**
   ```typescript
   useEffect(() => {
     // ❌ BAD: No cleanup
     setInterval(() => {
       fetchData();
     }, 5000);
   }, []);

   // ✅ GOOD: With cleanup
   useEffect(() => {
     const intervalId = setInterval(() => {
       fetchData();
     }, 5000);

     return () => clearInterval(intervalId);  // Cleanup
   }, []);
   ```

2. **Cleanup event listeners:**
   ```typescript
   useEffect(() => {
     const handleResize = () => {
       // Handle resize
     };

     window.addEventListener("resize", handleResize);

     return () => {
       window.removeEventListener("resize", handleResize);  // Cleanup
     };
   }, []);
   ```

3. **Cancel pending requests:**
   ```typescript
   useEffect(() => {
     const controller = new AbortController();

     fetch("/api/data", { signal: controller.signal })
       .then(handleData)
       .catch((err) => {
         if (err.name !== "AbortError") {
           console.error(err);
         }
       });

     return () => controller.abort();  // Cleanup
   }, []);
   ```

4. **Unsubscribe from observables:**
   ```typescript
   useEffect(() => {
     const subscription = someObservable.subscribe((data) => {
       // Handle data
     });

     return () => subscription.unsubscribe();  // Cleanup
   }, []);
   ```

5. **Debug memory leaks:**
   ```
   # Chrome DevTools
   1. Open DevTools → Memory tab
   2. Take heap snapshot
   3. Interact with app
   4. Take another snapshot
   5. Compare snapshots to find growing objects
   ```

---

## Rate Limiting

### Problem: Rate Limit Errors in Development

**Symptoms:**
```bash
TRPCClientError: Too many requests
429 Too Many Requests
Rate limit exceeded
```

**Root Cause:** Hitting rate limits while developing.

**Solutions:**

1. **Disable rate limiting temporarily:**
   ```bash
   # Add to .env.local
   RATE_LIMIT_ENABLED="false"

   # Restart server
   npm run dev
   ```

2. **Increase development limits:**
   ```bash
   # .env.local
   RATE_LIMIT_ENABLED="true"
   RATE_LIMIT_MAX_REQUESTS="1000"  # Default: 100
   RATE_LIMIT_WINDOW_MS="60000"    # 60 seconds
   ```

3. **Clear Redis rate limit data:**
   ```bash
   # If using Redis
   redis-cli FLUSHDB

   # Or clear specific keys
   redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL
   ```

4. **Use different test accounts:**
   ```bash
   # Rate limits are per-user
   # Create multiple test accounts for different features
   ```

---

### Problem: Production Rate Limiting Too Strict

**Symptoms:**
- Legitimate users getting rate limited
- API becomes unusable during peak times
- Mobile apps hitting limits frequently

**Root Cause:** Rate limits set too low for production usage.

**Solutions:**

1. **Adjust production limits:**
   ```bash
   # .env.production
   RATE_LIMIT_MAX_REQUESTS="500"  # Increase from default
   RATE_LIMIT_WINDOW_MS="60000"   # 60 seconds

   # For specific endpoints, configure in code:
   # src/server/api/trpc.ts
   ```

2. **Implement tiered rate limits:**
   ```typescript
   // src/server/api/trpc.ts
   export const rateLimitedProcedure = publicProcedure.use(async ({ ctx, next }) => {
     const userId = ctx.auth?.userId;

     // Higher limits for authenticated users
     const limit = userId ? 500 : 100;

     // Check rate limit
     const isLimited = await checkRateLimit(userId ?? ctx.ip, limit);

     if (isLimited) {
       throw new TRPCError({
         code: "TOO_MANY_REQUESTS",
         message: `Rate limit exceeded. Please try again later.`,
       });
     }

     return next();
   });
   ```

3. **Add retry logic in client:**
   ```typescript
   const mutation = api.countries.create.useMutation({
     retry: (failureCount, error) => {
       // Retry on rate limit (up to 3 times with backoff)
       if (error.data?.code === "TOO_MANY_REQUESTS" && failureCount < 3) {
         return true;
       }
       return false;
     },
     retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
   });
   ```

4. **Monitor rate limit hits:**
   ```typescript
   // Add logging for rate limit hits
   if (isLimited) {
     console.warn(`Rate limit hit: ${userId ?? ctx.ip} on ${ctx.path}`);

     // Send to monitoring service
     await logToDiscord({
       title: "Rate Limit Hit",
       description: `User ${userId} hit rate limit on ${ctx.path}`,
     });
   }
   ```

---

## Builder System Issues

### Problem: Builder Data Not Saving

**Symptoms:**
- Data entered in builder disappears on page refresh
- "Save successful" message shows but data not persisted
- Partial data saving (some fields save, others don't)

**Root Cause:** Missing persistence hooks, validation errors, or database constraints.

**Solutions:**

1. **Check browser console for errors:**
   ```
   # Open DevTools → Console
   # Look for:
   - Network errors (failed POST/PUT requests)
   - Validation errors
   - Type errors
   ```

2. **Verify persistence hooks are enabled:**
   ```typescript
   // src/app/builder/components/enhanced/AtomicBuilderPage.tsx

   // Ensure useNationalIdentityAutoSync is active
   useNationalIdentityAutoSync({
     countryId,
     nationalIdentityState,
     enabled: true,  // Must be true
   });

   // Check useEconomyBuilderState has onSuccess callback
   const { saveEconomy } = useEconomyBuilderState({
     countryId,
     onSuccess: (data) => {
       console.log("Economy saved:", data);  // Should log on save
     },
   });
   ```

3. **Test save operation manually:**
   ```typescript
   // Add debug logging to save function
   const handleSave = async () => {
     console.log("Saving data:", formData);

     try {
       const result = await saveData.mutateAsync(formData);
       console.log("Save result:", result);
     } catch (error) {
       console.error("Save error:", error);
     }
   };
   ```

4. **Check validation errors:**
   ```typescript
   // Validation errors may prevent save
   // Check formState.errors
   console.log("Form errors:", formState.errors);

   // Check Zod validation
   const validation = schema.safeParse(formData);
   if (!validation.success) {
     console.error("Validation errors:", validation.error);
   }
   ```

5. **Verify database constraints:**
   ```bash
   # Check Prisma schema for constraints
   # Unique constraints, required fields, etc.
   cat prisma/schema.prisma | grep -A 10 "model Country"

   # Test save directly in Prisma Studio
   npm run db:studio
   # Try creating/updating record manually
   ```

6. **Check network request:**
   ```
   # DevTools → Network tab
   # Find the save request
   # Check:
   - Request payload (is data correct?)
   - Response status (200? 400? 500?)
   - Response body (error message?)
   ```

---

### Problem: Economy Builder Calculations Not Working

**Symptoms:**
- GDP per capita shows as 0 or NaN
- Tier not calculating correctly
- Economic indicators not updating
- Projections showing unrealistic values

**Root Cause:** Missing economic data, calculation errors, or type mismatches.

**Solutions:**

1. **Verify required fields are populated:**
   ```typescript
   // Check that these fields have valid values:
   console.log({
     population: coreIndicators.population,  // Must be > 0
     nominalGDP: coreIndicators.nominalGDP,  // Must be > 0
     gdpPerCapita: coreIndicators.gdpPerCapita,  // Should auto-calculate
   });
   ```

2. **Test calculations manually:**
   ```typescript
   import { IxStatsCalculator } from "~/lib/calculations";

   // Test GDP per capita calculation
   const gdpPerCapita = IxStatsCalculator.calculateGdpPerCapita(
     1000000000000,  // $1 trillion GDP
     50000000        // 50 million population
   );
   console.log("GDP per capita:", gdpPerCapita);  // Should be 20000

   // Test tier calculation
   import { getEconomicTierFromGdpPerCapita } from "~/types/ixstats";
   const tier = getEconomicTierFromGdpPerCapita(gdpPerCapita);
   console.log("Economic tier:", tier);  // Should be "EMERGING" or similar
   ```

3. **Check for division by zero:**
   ```typescript
   // Common error: dividing by zero population
   const gdpPerCapita = population > 0
     ? nominalGDP / population
     : 0;
   ```

4. **Verify data types:**
   ```typescript
   // Ensure numbers aren't strings
   const population = typeof rawPopulation === "string"
     ? parseInt(rawPopulation, 10)
     : rawPopulation;

   console.log(typeof population);  // Should be "number"
   ```

5. **Check calculation service:**
   ```typescript
   // Test calculation service directly
   import { calculateCountryDataWithAtomicEnhancement } from "~/lib/atomic-economic-integration.server";

   const result = calculateCountryDataWithAtomicEnhancement(countryData);
   console.log("Calculated data:", result);
   ```

---

## Data Persistence Problems

### Problem: Tax System Data Not Persisting

**Symptoms:**
- Tax brackets reset after page reload
- Tax categories disappear
- "Tax system updated" message shows but data lost on refresh

**Root Cause:** Persistence layer not saving to database, validation failing, or state not syncing.

**Solutions:**

1. **Check tax system update mutation:**
   ```typescript
   // Verify mutation is being called
   const updateTaxSystem = api.taxSystem.update.useMutation({
     onSuccess: (data) => {
       console.log("Tax system saved:", data);  // Should log
       toast.success("Tax system updated");
     },
     onError: (error) => {
       console.error("Tax system save failed:", error);  // Check for errors
       toast.error(`Failed to save: ${error.message}`);
     },
   });
   ```

2. **Validate tax bracket structure:**
   ```typescript
   // Tax brackets must follow correct structure
   const validBrackets = [
     { minIncome: 0, maxIncome: 50000, rate: 10 },
     { minIncome: 50000, maxIncome: 100000, rate: 20 },
     { minIncome: 100000, rate: 30 },  // No maxIncome = top bracket
   ];

   // ❌ INVALID: Overlapping brackets
   const invalidBrackets = [
     { minIncome: 0, maxIncome: 60000, rate: 10 },
     { minIncome: 50000, maxIncome: 100000, rate: 20 },  // Overlaps!
   ];
   ```

3. **Check database schema:**
   ```bash
   # Verify tax system models exist
   grep -A 20 "model TaxSystem" prisma/schema.prisma
   grep -A 20 "model TaxCategory" prisma/schema.prisma

   # Ensure migrations are applied
   npx prisma migrate status
   ```

4. **Test tax system persistence:**
   ```bash
   # Open Prisma Studio
   npm run db:studio

   # Check TaxSystem table
   # After saving, verify data appears in database
   ```

5. **Verify JSON serialization:**
   ```typescript
   // Tax brackets are stored as JSON
   // Ensure they serialize correctly
   const brackets = JSON.stringify(taxBrackets);
   console.log("Serialized brackets:", brackets);

   const parsed = JSON.parse(brackets);
   console.log("Parsed brackets:", parsed);
   ```

---

### Problem: National Identity Data Not Loading

**Symptoms:**
- National identity fields empty on page load
- Default values showing instead of saved data
- "Loading..." state never completes

**Root Cause:** Query not fetching data, permission issues, or data not saved.

**Solutions:**

1. **Check national identity query:**
   ```typescript
   // Verify query is running
   const { data, isLoading, error } = api.nationalIdentity.get.useQuery({
     countryId: "clx8a1b2c3..."
   });

   console.log("Loading:", isLoading);
   console.log("Error:", error);
   console.log("Data:", data);
   ```

2. **Verify country ownership:**
   ```typescript
   // User must own the country to view/edit national identity
   const { data: profile } = api.users.getProfile.useQuery();

   if (profile?.countryId !== countryId) {
     console.error("User does not own this country");
   }
   ```

3. **Check database for data:**
   ```bash
   # Open Prisma Studio
   npm run db:studio

   # Find your country in Country table
   # Check if nationalIdentity relation exists
   ```

4. **Test query directly:**
   ```bash
   # Use tRPC panel or curl
   curl http://localhost:3000/api/trpc/nationalIdentity.get?input={"countryId":"clx8a1b2c3..."}
   ```

5. **Initialize national identity if missing:**
   ```typescript
   // Auto-create national identity if not exists
   useEffect(() => {
     if (!isLoading && !data && !error) {
       // Create default national identity
       createNationalIdentity.mutate({
         countryId,
         identity: {
           motto: "",
           anthem: "",
           officialLanguages: [],
           // ... default values
         },
       });
     }
   }, [isLoading, data, error]);
   ```

---

## Production-Specific Issues

### Problem: Production Environment Variables Not Loading

**Symptoms:**
- Features work in development but fail in production
- "undefined" errors for environment variables
- Database connection fails in production

**Root Cause:** Production env file not deployed or variables not set in hosting platform.

**Solutions:**

1. **Verify production env file exists:**
   ```bash
   # SSH into production server
   ls -la /path/to/app/.env.production

   # Check contents (be careful not to expose secrets)
   cat .env.production | grep -v "SECRET\|KEY\|PASSWORD"
   ```

2. **Set variables in hosting platform:**
   ```bash
   # Vercel example
   vercel env add DATABASE_URL production
   vercel env add CLERK_SECRET_KEY production

   # Netlify example
   netlify env:set DATABASE_URL "postgresql://..."

   # Docker example
   docker run -e DATABASE_URL="..." -e CLERK_SECRET_KEY="..." app
   ```

3. **Use environment variable validation:**
   ```typescript
   // src/env.js will fail build if required vars missing
   // Check build logs for validation errors
   ```

4. **Test production build locally:**
   ```bash
   # Create .env.production locally
   cp .env.example .env.production
   # Fill in production values

   # Build and run in production mode
   npm run build
   npm run start
   ```

5. **Check server logs:**
   ```bash
   # View production logs
   tail -f /var/log/ixstats/production.log

   # Or check hosting platform logs
   vercel logs
   netlify logs
   ```

---

### Problem: WebSocket Connection Failing in Production

**Symptoms:**
- Real-time updates not working
- "WebSocket connection failed" errors
- ThinkPages feed not updating live

**Root Cause:** WebSocket proxy misconfiguration or firewall blocking.

**Solutions:**

1. **Verify WebSocket server is running:**
   ```bash
   # Check server.mjs logs
   tail -f logs/production.log | grep "WebSocket"

   # Should see: "[Server] ✓ WebSocket server running"
   ```

2. **Check nginx/reverse proxy configuration:**
   ```nginx
   # nginx.conf
   location /socket.io/ {
       proxy_pass http://localhost:3550;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

3. **Test WebSocket connection:**
   ```javascript
   // In browser console
   const socket = io("https://ixstats.com", {
     path: "/socket.io",
     transports: ["websocket", "polling"]
   });

   socket.on("connect", () => {
     console.log("Connected:", socket.id);
   });

   socket.on("connect_error", (error) => {
     console.error("Connection error:", error);
   });
   ```

4. **Check firewall rules:**
   ```bash
   # Ensure WebSocket port is open
   sudo ufw status

   # If blocked, allow it
   sudo ufw allow 3550/tcp
   ```

5. **Fallback to polling:**
   ```typescript
   // src/lib/websocket-client.ts
   const socket = io({
     transports: ["polling", "websocket"],  // Try polling first
   });
   ```

---

### Problem: Database Connection Pool Exhausted

**Symptoms:**
```bash
Error: Connection pool timeout
Error: Can't reach database server
Too many connections
```

**Root Cause:** Connection pool too small or connections not released.

**Solutions:**

1. **Increase connection pool size:**
   ```bash
   # .env.production
   DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20"
   ```

2. **Check for connection leaks:**
   ```typescript
   // ❌ BAD: Connection not released
   const data = await db.country.findMany();
   // Long-running operation that blocks connection

   // ✅ GOOD: Release connection quickly
   const data = await db.country.findMany();
   // Process data after query completes
   ```

3. **Monitor connection usage:**
   ```bash
   # PostgreSQL: Check active connections
   psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

   # Check connections by database
   psql -U postgres -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
   ```

4. **Configure Prisma connection pool:**
   ```prisma
   // prisma/schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")

     // Connection pooling config
     connectionLimit = 20
     poolTimeout = 20
   }
   ```

5. **Use connection pooler (PgBouncer):**
   ```bash
   # Install PgBouncer
   sudo apt install pgbouncer

   # Configure for transaction pooling
   # Point DATABASE_URL to PgBouncer instead of direct PostgreSQL
   ```

---

## External Service Integration

### Problem: IxWiki API Not Responding

**Symptoms:**
- Country import from wiki fails
- Wiki data not loading
- "Failed to fetch from wiki" errors

**Root Cause:** IxWiki down, rate limited, or network issue.

**Solutions:**

1. **Check IxWiki availability:**
   ```bash
   # Test wiki API
   curl https://ixwiki.com/api.php

   # Should return XML API documentation
   ```

2. **Verify wiki cache:**
   ```typescript
   // Check cache for wiki data
   const cached = await api.wikiCache.get.query({ slug: "country-name" });
   console.log("Cached wiki data:", cached);
   ```

3. **Check rate limiting:**
   ```bash
   # IxWiki may rate limit API requests
   # Space out requests, implement exponential backoff
   ```

4. **Test wiki search:**
   ```bash
   curl "https://ixwiki.com/api.php?action=query&list=search&srsearch=innovation&format=json"
   ```

5. **Use fallback data:**
   ```typescript
   // If wiki fails, use default/cached data
   const wikiData = await fetchFromWiki(slug);

   if (!wikiData) {
     console.warn("Wiki fetch failed, using cached data");
     return cachedData ?? defaultData;
   }
   ```

---

### Problem: Discord Webhook Failing

**Symptoms:**
- No Discord notifications
- "Webhook failed" in server logs
- 404 or 401 errors on webhook POST

**Root Cause:** Invalid webhook URL, webhook deleted, or Discord API issue.

**Solutions:**

1. **Verify webhook URL:**
   ```bash
   # Check .env.production
   echo $DISCORD_WEBHOOK_URL

   # Should look like:
   # https://discord.com/api/webhooks/1234567890/abcdefghijklmnop
   ```

2. **Test webhook manually:**
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}' \
     "$DISCORD_WEBHOOK_URL"

   # Should return 204 No Content on success
   ```

3. **Check webhook exists in Discord:**
   ```
   # Discord Server → Channel Settings → Integrations → Webhooks
   # Verify webhook still exists
   # Regenerate URL if needed
   ```

4. **Enable webhook in environment:**
   ```bash
   # .env.production
   DISCORD_WEBHOOK_ENABLED="true"
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   ```

5. **Add error handling:**
   ```typescript
   // src/lib/discord-logger.ts
   try {
     await fetch(webhookUrl, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ content: message }),
     });
   } catch (error) {
     console.error("Discord webhook failed:", error);
     // Don't crash app if webhook fails
   }
   ```

---

## Debugging Workflows

### Performance Profiling

```bash
# 1. Profile React components
# Open React DevTools → Profiler tab
# Click Record → Interact with app → Stop
# Analyze flame graph for slow renders

# 2. Profile database queries
# Enable Prisma query logging
DATABASE_LOG_LEVEL="query"

# 3. Profile API endpoints
# Add timing logs
console.time("API Call");
const result = await api.countries.getAll.query();
console.timeEnd("API Call");

# 4. Check bundle size
npm run build
# Review .next/build-manifest.json

# 5. Lighthouse audit
npx lighthouse http://localhost:3000 --view
```

### Network Debugging

```bash
# 1. Monitor all API calls
# Browser DevTools → Network tab → Filter: Fetch/XHR

# 2. Check response times
# Network tab → Timing column

# 3. Inspect request/response
# Click on request → Headers/Preview/Response tabs

# 4. Test with curl
curl -v http://localhost:3000/api/trpc/countries.getAll

# 5. Check WebSocket frames
# Network tab → WS filter → Messages tab
```

### Database Query Optimization

```bash
# 1. Enable query logging
# prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  log      = ["query", "info", "warn", "error"]
}

# 2. Analyze slow queries
tail -f logs/queries.log | grep "duration"

# 3. Add database indexes
# Check EXPLAIN for slow queries in Prisma Studio

# 4. Use Prisma Studio query profiler
npm run db:studio
# Run queries and check execution time

# 5. Monitor database performance
# PostgreSQL: pg_stat_statements extension
```

---

## Getting Advanced Help

### Before Creating an Issue

1. **Search existing issues:** Check GitHub issues for similar problems
2. **Review documentation:** Read all relevant guides thoroughly
3. **Check recent changes:** Review git history for breaking changes
4. **Collect diagnostics:** Run all health checks and save logs

### Information to Provide

When asking for help, include:

```markdown
## Environment
- OS: [e.g., macOS 14.0, Ubuntu 22.04, Windows 11]
- Node.js: [e.g., v18.17.0]
- npm: [e.g., 9.8.0]
- Database: [SQLite/PostgreSQL version]

## Problem Description
[Clear description of the issue]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Error Messages
```
[Full error message with stack trace]
```

## What I've Tried
- [Solution 1]
- [Solution 2]
- [Solution 3]

## Logs
[Relevant log excerpts]

## Screenshots
[If applicable]
```

### Emergency Recovery

If everything is broken:

```bash
# 1. Stash uncommitted changes
git stash

# 2. Nuclear cleanup
npm run clean:all
rm -rf node_modules package-lock.json .next

# 3. Fresh install
npm install

# 4. Reset database
npm run db:reset
npm run db:setup

# 5. Regenerate Prisma client
npm run db:generate

# 6. Test development server
npm run dev

# 7. If working, restore changes
git stash pop

# 8. If still broken, check git history
git log --oneline -10
# Consider reverting recent commits
```

---

## Additional Resources

- **API Examples:** [/docs/reference/api-examples.md](/docs/reference/api-examples.md)
- **Database Reference:** [/docs/reference/database.md](/docs/reference/database.md)
- **Deployment Guide:** [/docs/operations/deployment.md](/docs/operations/deployment.md)
- **Environment Setup:** [/docs/operations/environments.md](/docs/operations/environments.md)
- **Rate Limiting Guide:** [/docs/RATE_LIMITING_GUIDE.md](/docs/RATE_LIMITING_GUIDE.md)

---

**Last Updated:** October 22, 2025
**Version:** v1.2.0
**Maintainer:** IxStats Development Team
