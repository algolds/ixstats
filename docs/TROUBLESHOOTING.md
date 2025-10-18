# IxStats Troubleshooting Guide
**Version 1.1.1** | **Last Updated: October 17, 2025**

Common development issues and their solutions. Use this guide to quickly resolve problems you may encounter while developing IxStats.

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Database Problems](#database-problems)
- [Authentication Errors](#authentication-errors)
- [Build Failures](#build-failures)
- [Type Errors](#type-errors)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [API and tRPC Issues](#api-and-trpc-issues)
- [Development Server Issues](#development-server-issues)
- [Debugging Techniques](#debugging-techniques)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Run Health Checks

Start with these commands to identify issues:

```bash
# Check Node and npm versions
node --version  # Should be v18.17.0+
npm --version   # Should be 9.0.0+

# Verify installation
npm run check  # Runs lint + typecheck

# Test database connection
npm run db:studio  # Should open Prisma Studio

# Check API health
npm run test:health
```

### Common Error Patterns

| Error Message | Quick Fix | Section |
|--------------|-----------|---------|
| `ENOENT: no such file or directory` | Check file paths, run `npm install` | [Installation](#installation-issues) |
| `PrismaClientInitializationError` | Reset database: `npm run db:setup` | [Database](#database-problems) |
| `CLERK_SECRET_KEY is not set` | Add Clerk keys to `.env.local` | [Authentication](#authentication-errors) |
| `Type error: Cannot find module` | Run `npm run db:generate` | [Type Errors](#type-errors) |
| `Port 3000 is already in use` | Kill process or use different port | [Dev Server](#development-server-issues) |
| `Webpack compilation failed` | Clear cache: `npm run clean` | [Build](#build-failures) |

## Installation Issues

### npm install Fails

**Problem**: Dependencies fail to install.

**Symptoms**:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions**:

1. **Clear npm cache**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use correct Node version**:
   ```bash
   node --version  # Must be v18.17.0 or higher
   nvm use 18      # If using nvm
   npm install
   ```

3. **Check disk space**:
   ```bash
   df -h  # Linux/Mac
   ```

4. **Try legacy peer deps** (last resort):
   ```bash
   npm install --legacy-peer-deps
   ```

### Prisma Client Generation Fails

**Problem**: `@prisma/client` not generated.

**Symptoms**:
```
Error: Cannot find module '@prisma/client'
```

**Solutions**:

```bash
# Regenerate Prisma client
npm run db:generate

# If that fails, manual approach
npx prisma generate

# Verify it worked
ls node_modules/.prisma/client  # Should show generated files
```

### TypeScript Declaration Files Missing

**Problem**: Type declarations not found.

**Symptoms**:
```
Could not find a declaration file for module 'xyz'
```

**Solutions**:

```bash
# Reinstall dependencies
npm install

# Install type definitions
npm install --save-dev @types/node @types/react @types/react-dom

# Clear TypeScript cache
rm -rf .next
npm run typecheck
```

## Database Problems

### Database Connection Fails

**Problem**: Can't connect to database.

**Symptoms**:
```
PrismaClientInitializationError: Can't reach database server
```

**Solutions**:

**For SQLite** (Development):

```bash
# Check DATABASE_URL in .env.local
cat .env.local | grep DATABASE_URL
# Should be: DATABASE_URL="file:./dev.db"

# Reset database
npm run db:reset
npm run db:setup
```

**For PostgreSQL** (Production):

```bash
# Test connection manually
psql "postgresql://user:password@localhost:5432/ixstats"

# Check if database exists
psql -U postgres -c "\l" | grep ixstats

# Create database if missing
createdb ixstats

# Apply migrations
npm run db:migrate:deploy
```

### Migration Errors

**Problem**: Database migration fails.

**Symptoms**:
```
Error: P3009 migrate found failed migrations
```

**Solutions**:

```bash
# Development: Reset and start fresh
npm run db:reset
npm run db:setup

# Production: Roll back and reapply
npm run db:migrate:resolve --rolled-back "migration_name"
npm run db:migrate:deploy

# Check migration status
npx prisma migrate status
```

**Note on Latest Migration (20251017203807)**:
The atomic integration migration adds comprehensive atomic component tracking (131 total models, 36 routers). If this migration fails:
```bash
# Check if migration was partially applied
npx prisma migrate status

# Development: Reset and reapply
npm run db:reset
npm run db:setup

# Production: Ensure database supports all new models
npm run db:migrate:deploy
```

### Schema Out of Sync

**Problem**: Database schema doesn't match Prisma schema.

**Symptoms**:
```
Error: The provided value for the column is too long
Error: Unknown column 'xyz'
```

**Solutions**:

```bash
# Development: Push schema changes
npm run db:push

# Production: Create and apply migration
npm run db:migrate
npm run db:migrate:deploy

# Verify schema is in sync
npx prisma validate
```

### Prisma Studio Won't Open

**Problem**: `npm run db:studio` fails or hangs.

**Symptoms**:
- Port 5555 already in use
- Prisma Studio doesn't load

**Solutions**:

```bash
# Check if port 5555 is in use
lsof -i :5555

# Kill existing Prisma Studio
kill $(lsof -ti:5555)

# Restart Prisma Studio
npm run db:studio

# Use different port
npx prisma studio --port 5556
```

### Database Locked (SQLite)

**Problem**: SQLite database is locked.

**Symptoms**:
```
Error: SQLITE_BUSY: database is locked
```

**Solutions**:

```bash
# Close all applications using the database
# Kill Prisma Studio
kill $(lsof -ti:5555)

# Stop development server
# Press Ctrl+C in terminal

# Restart fresh
npm run dev
```

## Authentication Errors

### Clerk Not Initialized

**Problem**: Clerk authentication not working.

**Symptoms**:
```
Error: CLERK_SECRET_KEY is not set
ClerkProviderError: Clerk not initialized
```

**Solutions**:

1. **Add Clerk keys to `.env.local`**:
   ```bash
   # Get from https://dashboard.clerk.com
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   ```

2. **Restart development server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. **Verify keys are loaded**:
   ```bash
   npm run auth:check:dev
   ```

### Authentication Redirect Loop

**Problem**: Infinite redirect on login/logout.

**Symptoms**:
- Browser keeps redirecting
- Can't access protected pages

**Solutions**:

1. **Clear browser cookies and cache**

2. **Check Clerk dashboard settings**:
   - Go to Clerk Dashboard → Your App → Paths
   - Verify sign-in URL: `/sign-in`
   - Verify sign-up URL: `/sign-up`
   - Verify after sign-in URL: `/dashboard`

3. **Verify middleware configuration**:
   ```typescript
   // src/middleware.ts should have proper paths
   export default clerkMiddleware({
     publicRoutes: ["/", "/sign-in", "/sign-up"],
   });
   ```

4. **Test without middleware**:
   - Temporarily disable auth middleware
   - If works, issue is in middleware config

### Session Not Persisting

**Problem**: User keeps getting logged out.

**Symptoms**:
- Session lost on page refresh
- Random logouts

**Solutions**:

1. **Check browser cookies are enabled**

2. **Verify domain settings in Clerk**:
   - Dashboard → Settings → Domains
   - Add `localhost` for development

3. **Clear application storage**:
   - Browser DevTools → Application → Storage → Clear site data

4. **Check for conflicting middleware**

## Build Failures

### Build Times Out

**Problem**: `npm run build` times out or takes too long.

**Symptoms**:
```
Command timed out after 10 minutes
Webpack compilation taking forever
```

**Solutions**:

```bash
# Use fast build (skips validation)
npm run build:fast

# Clear build cache
npm run clean
npm run build:fast

# Increase memory allocation
NODE_OPTIONS='--max-old-space-size=8192' npm run build

# Check if specific file is causing issue
npm run typecheck  # Check types separately
npm run lint       # Check linting separately
```

### TypeScript Build Errors

**Problem**: Build fails with TypeScript errors.

**Symptoms**:
```
Type error: Property 'xyz' does not exist on type 'ABC'
```

**Solutions**:

```bash
# Check types without building
npm run typecheck

# Build without type checking (emergency fix)
npm run build:no-check

# Fix the type errors shown in output
# Then rebuild normally
npm run build
```

### Missing Dependencies

**Problem**: Build fails due to missing packages.

**Symptoms**:
```
Module not found: Can't resolve 'package-name'
```

**Solutions**:

```bash
# Reinstall all dependencies
npm run clean:all
npm install

# Install specific missing package
npm install package-name

# Check package.json for correct versions
```

### Out of Memory

**Problem**: Build fails with heap out of memory.

**Symptoms**:
```
FATAL ERROR: Reached heap limit
JavaScript heap out of memory
```

**Solutions**:

```bash
# Increase Node memory limit
NODE_OPTIONS='--max-old-space-size=8192' npm run build

# Use fast build
npm run build:fast

# Close other applications
# Clear system memory
```

## Type Errors

### Prisma Types Not Found

**Problem**: Can't import Prisma types.

**Symptoms**:
```
Cannot find module '@prisma/client'
Type 'Country' is not defined
```

**Solutions**:

```bash
# Regenerate Prisma client
npm run db:generate

# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Verify generation
ls node_modules/.prisma/client
```

### tRPC Type Inference Issues

**Problem**: tRPC types not working correctly.

**Symptoms**:
```
Type 'Router' is not assignable
Procedure types not inferred
```

**Solutions**:

```bash
# Restart TypeScript server
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Check tRPC version compatibility
npm list @trpc/server @trpc/client @trpc/react-query

# Update tRPC if needed
npm install @trpc/server@latest @trpc/client@latest @trpc/react-query@latest
```

### Path Alias Not Resolving

**Problem**: `~/*` or `@/*` imports not working.

**Symptoms**:
```
Cannot find module '~/lib/utils'
```

**Solutions**:

1. **Check `tsconfig.json`**:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "~/*": ["./src/*"],
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. **Restart TypeScript server**

3. **Use relative imports temporarily**:
   ```typescript
   // Instead of
   import { api } from "~/lib/trpc";
   // Use
   import { api } from "../../lib/trpc";
   ```

## Runtime Errors

### tRPC Query Fails

**Problem**: tRPC query returns error.

**Symptoms**:
```
TRPCClientError: Unexpected token in JSON
TRPCClientError: Failed to fetch
```

**Solutions**:

```bash
# Check API is running
curl http://localhost:3000/api/trpc/countries.getAll

# Check database connection
npm run db:studio

# Enable tRPC debugging
# Add to .env.local:
NEXT_PUBLIC_TRPC_DEBUG="true"

# Check browser console for details
```

### Clerk Session Error

**Problem**: Can't access user session.

**Symptoms**:
```
Error: useUser must be used within ClerkProvider
Session is undefined
```

**Solutions**:

1. **Ensure ClerkProvider wraps app**:
   ```typescript
   // app/layout.tsx
   import { ClerkProvider } from "@clerk/nextjs";

   export default function RootLayout({ children }) {
     return (
       <ClerkProvider>
         {children}
       </ClerkProvider>
     );
   }
   ```

2. **Use auth() for server components**:
   ```typescript
   import { auth } from "@clerk/nextjs";

   export default async function Page() {
     const { userId } = auth();
     // ...
   }
   ```

### Hydration Mismatch

**Problem**: React hydration error.

**Symptoms**:
```
Hydration failed because the initial UI does not match
Text content does not match server-rendered HTML
```

**Solutions**:

1. **Use `useEffect` for client-only code**:
   ```typescript
   const [mounted, setMounted] = useState(false);

   useEffect(() => {
     setMounted(true);
   }, []);

   if (!mounted) return null;
   ```

2. **Suppress hydration warning** (if intentional):
   ```typescript
   <div suppressHydrationWarning>
     {new Date().toString()}
   </div>
   ```

3. **Ensure SSR/CSR consistency**

## Performance Issues

### Slow Page Load

**Problem**: Pages load slowly.

**Symptoms**:
- Long wait times
- Spinner shows for several seconds

**Solutions**:

```typescript
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(function ExpensiveComponent() {
  // Component code
});

// Use useMemo for expensive calculations
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.value - a.value);
}, [data]);

// Use dynamic imports for large components
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <LoadingSpinner />,
});
```

**Check for N+1 queries**:
```typescript
// ❌ Bad: N+1 query
const countries = await db.country.findMany();
for (const country of countries) {
  country.economicData = await db.economicData.findUnique({
    where: { countryId: country.id },
  });
}

// ✅ Good: Single query with include
const countries = await db.country.findMany({
  include: {
    economicData: true,
  },
});
```

### Memory Leaks

**Problem**: Memory usage grows over time.

**Symptoms**:
- Browser slows down
- `useEffect` cleanup warnings

**Solutions**:

```typescript
// Always cleanup in useEffect
useEffect(() => {
  const interval = setInterval(() => {
    // Do something
  }, 1000);

  // Cleanup
  return () => clearInterval(interval);
}, []);

// Cancel pending requests
useEffect(() => {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then(handleData);

  return () => controller.abort();
}, []);
```

### Large Bundle Size

**Problem**: JavaScript bundle too large.

**Symptoms**:
- Slow initial page load
- Large network transfers

**Solutions**:

```bash
# Analyze bundle
npm run build
# Check .next/build-manifest.json

# Use dynamic imports
const Chart = dynamic(() => import("recharts"), {
  ssr: false,
});

# Check for duplicate dependencies
npm ls package-name
```

## API and tRPC Issues

### CORS Errors

**Problem**: CORS blocking API requests.

**Symptoms**:
```
Access to fetch blocked by CORS policy
```

**Solutions**:

1. **For development**:
   ```typescript
   // next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: "/api/:path*",
           headers: [
             { key: "Access-Control-Allow-Origin", value: "*" },
           ],
         },
       ];
     },
   };
   ```

2. **For production**: Configure proper CORS headers

### Rate Limiting Blocking Requests

**Problem**: Hitting rate limits during development.

**Symptoms**:
```
TRPCClientError: Too many requests
429 Too Many Requests
```

**Solutions**:

```bash
# Disable rate limiting temporarily
# In .env.local:
RATE_LIMIT_ENABLED="false"

# Or increase limits
RATE_LIMIT_MAX_REQUESTS="1000"
RATE_LIMIT_WINDOW_MS="60000"

# Clear Redis rate limit data
redis-cli FLUSHDB
```

### tRPC Input Validation Fails

**Problem**: Input doesn't pass Zod validation.

**Symptoms**:
```
TRPCClientError: Invalid input
ZodError: Expected string, received number
```

**Solutions**:

1. **Check input shape**:
   ```typescript
   // Router expects
   .input(z.object({
     name: z.string(),
     value: z.number(),
   }))

   // Ensure you pass
   mutation.mutate({
     name: "Test",
     value: 123,  // Not "123"
   });
   ```

2. **Use type inference**:
   ```typescript
   import { type RouterInputs } from "~/lib/trpc";

   type CreateCountryInput = RouterInputs["countries"]["create"];

   const data: CreateCountryInput = {
     name: "Test",
     value: 123,
   };
   ```

## Development Server Issues

### Port Already in Use

**Problem**: Can't start server, port is busy.

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions**:

```bash
# Find process using port
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
PORT=3001 npm run dev
```

### Hot Reload Not Working

**Problem**: Changes don't reflect in browser.

**Symptoms**:
- Edit files but browser doesn't update
- Need manual refresh

**Solutions**:

1. **Restart dev server**:
   ```bash
   # Stop (Ctrl+C) and restart
   npm run dev
   ```

2. **Clear Next.js cache**:
   ```bash
   npm run clean
   npm run dev
   ```

3. **Check file watcher limits** (Linux):
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

4. **Hard refresh browser**:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Environment Variables Not Loading

**Problem**: `.env.local` changes not applied.

**Symptoms**:
- New variables undefined
- Old values still used

**Solutions**:

```bash
# Restart server (required after env changes)
# Stop server
# Make changes to .env.local
npm run dev

# Verify variables loaded
# In code:
console.log(process.env.YOUR_VARIABLE);

# Check file name
ls -la | grep env
# Should be .env.local (note the dot prefix)

# Check syntax (no spaces around =)
DATABASE_URL="file:./dev.db"  # ✅ Good
DATABASE_URL = "file:./dev.db"  # ❌ Bad
```

## Debugging Techniques

### Enable Verbose Logging

```typescript
// Add to components
console.log("Debug:", { variable1, variable2 });

// Add to API routes
console.log("API called:", input);

// Enable tRPC logging
// .env.local
NEXT_PUBLIC_TRPC_DEBUG="true"
```

### Use Browser DevTools

1. **Console**: View errors and logs
2. **Network**: Check API requests
3. **React DevTools**: Inspect component state
4. **Sources**: Set breakpoints

### Database Debugging

```bash
# Open Prisma Studio to inspect data
npm run db:studio

# Check raw database
sqlite3 prisma/dev.db
# or
psql $DATABASE_URL

# Enable Prisma query logging
# In schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  log = ["query", "info", "warn", "error"]
}
```

### TypeScript Debugging

```bash
# Generate declaration files
npm run typecheck -- --declaration

# Show type at cursor (VS Code)
# Hover over variable

# Show type errors only for file
npx tsc --noEmit --watch src/path/to/file.ts
```

### Performance Debugging

```typescript
// Measure render time
console.time("ComponentRender");
// Component code
console.timeEnd("ComponentRender");

// Check re-renders
useEffect(() => {
  console.log("Component rendered");
});

// Profile with React DevTools
// Profiler tab → Record → Interact → Stop
```

## Getting Help

### Before Asking for Help

1. **Read error message carefully**
2. **Check this troubleshooting guide**
3. **Search existing issues on GitHub**
4. **Try the quick diagnostics**

### How to Ask for Help

**Provide**:
- Error message (full text)
- Steps to reproduce
- What you've tried
- Environment (OS, Node version, etc.)

**Example**:
```
Problem: Build fails with TypeScript error

Error:
Type 'Country' is not assignable to type 'CountryData'

Steps to reproduce:
1. Run npm run build
2. Error occurs in src/components/CountryCard.tsx line 42

What I tried:
- npm run typecheck (shows same error)
- Restarted TypeScript server
- npm run clean && npm install

Environment:
- OS: macOS 14
- Node: v18.17.0
- npm: 9.8.0
```

### Resources

- **Documentation**: `/docs` directory
- **GitHub Issues**: Report bugs
- **Code Comments**: Check inline documentation
- **Stack Traces**: Follow the error trail

### Emergency Recovery

If everything breaks:

```bash
# Nuclear option: Clean slate
git stash  # Save uncommitted changes
npm run clean:all  # Delete node_modules, .next, databases
npm install
npm run db:setup
npm run dev

# Restore changes
git stash pop
```

---

**Still having issues?** Check [GETTING_STARTED.md](./GETTING_STARTED.md) for setup instructions or [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for configuration reference.
