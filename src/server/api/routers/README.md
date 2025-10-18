# tRPC Router System Documentation

**Version:** 1.1.0
**Last Updated:** October 16, 2025
**Architecture:** tRPC v11 with Next.js 15 App Router
**Total Routers:** 31
**Total Endpoints:** 304

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Router Index](#router-index)
4. [Core Patterns](#core-patterns)
5. [Authentication & Authorization](#authentication--authorization)
6. [Creating a New Router](#creating-a-new-router)
7. [Error Handling](#error-handling)
8. [Performance Optimization](#performance-optimization)
9. [Testing](#testing)
10. [Best Practices](#best-practices)

---

## Overview

The IxStats tRPC API provides **304 type-safe endpoints** across **31 specialized routers**. All endpoints use tRPC v11 for end-to-end type safety between client and server, with Zod for runtime validation and SuperJSON for serialization.

### Key Features

- **End-to-End Type Safety**: Full TypeScript inference from server to client
- **Zod Validation**: Runtime input validation with automatic TypeScript types
- **8-Layer Middleware Stack**: Auth, rate limiting, audit logging, timing, error handling
- **SuperJSON Serialization**: Automatic handling of Date, Map, Set, BigInt, etc.
- **Redis Rate Limiting**: Production rate limiting with in-memory fallback
- **Audit Logging**: Database persistence for high-security operations
- **Error Tracking**: Production error logging with context and metadata

### Technology Stack

- **tRPC**: v11.0.0 (type-safe API layer)
- **Zod**: v3.23+ (validation schemas)
- **Prisma**: v5.0+ (database ORM)
- **Clerk**: Authentication provider
- **Redis**: Rate limiting (production)
- **SuperJSON**: Enhanced serialization

---

## Architecture

### Request Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Request                            │
│                    (Typed tRPC Call)                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                 ┌──────────▼──────────┐
                 │  Next.js API Route  │
                 │  /api/trpc/[trpc]   │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │   tRPC Context      │
                 │  (Auth, DB, User)   │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │    Middleware Stack (8 Layers)    │
          ├───────────────────────────────────┤
          │  1. SuperJSON Transformer         │
          │  2. Error Formatter               │
          │  3. Timing Middleware             │
          │  4. Auth Middleware               │
          │  5. Country Owner Middleware      │
          │  6. Rate Limit Middleware         │
          │  7. Audit Log Middleware          │
          │  8. User Logging Middleware       │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │      Router + Procedure           │
          │   (Business Logic + Validation)   │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │        Prisma Database            │
          │  (124 Models, 8 Migrations)       │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │      Response (Type-Safe)         │
          │    Serialized with SuperJSON      │
          └───────────────────────────────────┘
```

### File Structure

```
src/server/api/
├── routers/                    # All router files
│   ├── achievements.ts         # Achievement system (15 endpoints)
│   ├── activities.ts           # Activity feed (8 endpoints)
│   ├── admin.ts                # System administration (24 endpoints)
│   ├── archetypes.ts           # Country archetypes (8 endpoints)
│   ├── atomicGovernment.ts     # Atomic government components (12 endpoints)
│   ├── countries.ts            # Country management (32 endpoints)
│   ├── customTypes.ts          # Custom government types (6 endpoints)
│   ├── diplomatic.ts           # Diplomatic relations (28 endpoints)
│   ├── diplomatic-intelligence.ts  # Diplomatic intelligence (16 endpoints)
│   ├── eci.ts                  # Executive Command Interface (10 endpoints)
│   ├── economics.ts            # Economic data management (18 endpoints)
│   ├── enhanced-economics.ts   # Advanced economic indices (6 endpoints)
│   ├── formulas.ts             # Economic formulas (4 endpoints)
│   ├── government.ts           # Government structures (14 endpoints)
│   ├── intelligence.ts         # Intelligence system (12 endpoints)
│   ├── mycountry.ts            # MyCountry dashboard (10 endpoints)
│   ├── notifications.ts        # Notification system (18 endpoints)
│   ├── policies.ts             # Policy management (8 endpoints)
│   ├── quickactions.ts         # Quick actions (12 endpoints)
│   ├── roles.ts                # Role & permission management (8 endpoints)
│   ├── scheduledChanges.ts     # Scheduled changes (6 endpoints)
│   ├── sdi.ts                  # Social Development Index (14 endpoints)
│   ├── security.ts             # Defense & security (22 endpoints)
│   ├── taxSystem.ts            # Tax configuration (16 endpoints)
│   ├── thinkpages.ts           # Social platform (54 endpoints)
│   ├── user-logging.ts         # Activity logging (6 endpoints)
│   ├── users.ts                # User management (8 endpoints)
│   ├── wikiCache.ts            # Wiki cache management (8 endpoints)
│   ├── wikiImporter.ts         # Wiki data import (5 endpoints)
│   └── README.md               # This file
├── root.ts                     # Main app router (exports all routers)
└── trpc.ts                     # tRPC configuration and procedures
```

---

## Router Index

### Complete Router List

| Router | Endpoints | Purpose | Auth Level | File |
|--------|-----------|---------|------------|------|
| **achievements** | 15 | Achievement system, milestones, rankings | Protected | `achievements.ts` |
| **activities** | 8 | Live activity feed, country actions | Protected | `activities.ts` |
| **admin** | 24 | System administration, god-mode operations | Admin | `admin.ts` |
| **archetypes** | 8 | Country archetypes, filtering | Public | `archetypes.ts` |
| **atomicGovernment** | 12 | Atomic government component system | Protected | `atomicGovernment.ts` |
| **countries** | 32 | Country creation, retrieval, management | Mixed | `countries.ts` |
| **customTypes** | 6 | Custom government types, autocomplete | Protected | `customTypes.ts` |
| **diplomatic** | 28 | Embassies, treaties, relations | Protected | `diplomatic.ts` |
| **diplomatic-intelligence** | 16 | Diplomatic intelligence, analysis | Protected | `diplomatic-intelligence.ts` |
| **eci** | 10 | Executive Command Interface | Executive | `eci.ts` |
| **economics** | 18 | Economic profiles, labor, fiscal data | Protected | `economics.ts` |
| **enhanced-economics** | 6 | Advanced economic indices, analytics | Protected | `enhanced-economics.ts` |
| **formulas** | 4 | Economic formulas, calculations | Public | `formulas.ts` |
| **government** | 14 | Government structures, budgets, departments | Protected | `government.ts` |
| **intelligence** | 12 | Intelligence system, vitality scores | Protected | `intelligence.ts` |
| **mycountry** | 10 | MyCountry dashboard, specialized views | Country Owner | `mycountry.ts` |
| **notifications** | 18 | Unified notification system | Protected | `notifications.ts` |
| **policies** | 8 | Policy management, effects | Protected | `policies.ts` |
| **quickactions** | 12 | Quick actions (meetings, officials) | Protected | `quickactions.ts` |
| **roles** | 8 | Role-based access control | Admin | `roles.ts` |
| **scheduledChanges** | 6 | Delayed impact changes | Protected | `scheduledChanges.ts` |
| **sdi** | 14 | Social Development Index | Protected | `sdi.ts` |
| **security** | 22 | Defense, military, security systems | Protected | `security.ts` |
| **taxSystem** | 16 | Tax system configuration | Protected | `taxSystem.ts` |
| **thinkpages** | 54 | Social platform (Feed, ThinkTanks, ThinkShare) | Protected | `thinkpages.ts` |
| **user-logging** | 6 | User activity logging, analytics | Protected | `user-logging.ts` |
| **users** | 8 | User management, profiles | Protected | `users.ts` |
| **wikiCache** | 8 | Wiki data caching, refresh | Admin | `wikiCache.ts` |
| **wikiImporter** | 5 | MediaWiki infobox importer | Protected | `wikiImporter.ts` |

**Total**: 304 endpoints across 22 routers

### Router Categories

#### Core Data Management (5 routers, 88 endpoints)
- `countries` - Country lifecycle management
- `economics` - Economic data (profiles, labor, fiscal)
- `government` - Government structures and budgets
- `taxSystem` - Tax configuration
- `users` - User profiles and settings

#### Intelligence & Analytics (4 routers, 48 endpoints)
- `intelligence` - Intelligence system
- `diplomatic-intelligence` - Diplomatic intelligence
- `enhanced-economics` - Advanced economic analytics
- `formulas` - Calculation formulas

#### Social Platform (2 routers, 62 endpoints)
- `thinkpages` - Social platform (54 endpoints)
- `activities` - Activity feed (8 endpoints)

#### Diplomatic Systems (1 router, 28 endpoints)
- `diplomatic` - Embassies, treaties, relations

#### Administration (4 routers, 46 endpoints)
- `admin` - System administration
- `eci` - Executive Command Interface
- `roles` - Role & permission management
- `wikiCache` - Wiki cache management

#### Supporting Systems (6 routers, 72 endpoints)
- `notifications` - Unified notifications
- `achievements` - Achievement system
- `security` - Defense systems
- `policies` - Policy management
- `quickactions` - Quick actions
- `user-logging` - Activity logging

---

## Core Patterns

### 1. Router Structure

All routers follow a consistent pattern:

```typescript
// src/server/api/routers/example.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure
} from "~/server/api/trpc";

export const exampleRouter = createTRPCRouter({
  // Query: Fetch data
  getById: publicProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.example.findUnique({
        where: { id: input.id }
      });
    }),

  // Query with complex validation
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      filter: z.enum(['active', 'archived', 'all']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.example.findMany({
        take: input.limit,
        skip: input.offset,
        where: input.filter === 'active'
          ? { isActive: true }
          : undefined,
      });
    }),

  // Mutation: Create data
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership/permissions
      if (!ctx.user?.id) {
        throw new Error('Authentication required');
      }

      return await ctx.db.example.create({
        data: {
          ...input,
          userId: ctx.user.id,
        }
      });
    }),

  // Mutation: Update data
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
      })
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.example.findUnique({
        where: { id: input.id }
      });

      if (!existing || existing.userId !== ctx.user?.id) {
        throw new Error('Not authorized');
      }

      return await ctx.db.example.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  // Mutation: Delete data
  delete: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.example.findUnique({
        where: { id: input.id }
      });

      if (!existing || existing.userId !== ctx.user?.id) {
        throw new Error('Not authorized');
      }

      return await ctx.db.example.delete({
        where: { id: input.id }
      });
    }),
});
```

### 2. Input Validation Patterns

#### Basic Validation
```typescript
// Simple object
.input(z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  count: z.number().int().positive(),
}))

// Optional fields
.input(z.object({
  id: z.string(),
  name: z.string().optional(),
  active: z.boolean().default(true),
}))

// Enums
.input(z.object({
  status: z.enum(['pending', 'active', 'archived']),
  tier: z.enum(['1', '2', '3', '4', '5', '6', '7']),
}))

// Arrays
.input(z.object({
  ids: z.array(z.string()),
  tags: z.array(z.string()).min(1).max(10),
}))
```

#### Complex Validation
```typescript
// Nested objects
.input(z.object({
  country: z.object({
    name: z.string().min(1),
    population: z.number().positive(),
    economicData: z.object({
      gdp: z.number().nonnegative(),
      gdpPerCapita: z.number().positive(),
    }),
  }),
}))

// Conditional validation
.input(z.object({
  type: z.enum(['user', 'admin']),
  permissions: z.array(z.string()).optional(),
}).refine(
  (data) => data.type === 'admin' ? data.permissions !== undefined : true,
  { message: "Admin requires permissions" }
))

// Custom validation
.input(z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase")
    .regex(/[a-z]/, "Password must contain lowercase")
    .regex(/[0-9]/, "Password must contain number"),
}))
```

### 3. Database Query Patterns

#### Basic Queries
```typescript
// Find unique
const country = await ctx.db.country.findUnique({
  where: { id: input.id }
});

// Find first
const user = await ctx.db.user.findFirst({
  where: { email: input.email }
});

// Find many with filters
const countries = await ctx.db.country.findMany({
  where: {
    economicTier: input.tier,
    isActive: true,
  },
  orderBy: { name: 'asc' },
  take: 50,
  skip: input.offset,
});
```

#### Advanced Queries with Relations
```typescript
// Include relations
const country = await ctx.db.country.findUnique({
  where: { id: input.id },
  include: {
    demographics: true,
    economicProfile: true,
    laborMarket: true,
    fiscalSystem: true,
    governmentComponents: true,
    historicalData: {
      orderBy: { timestamp: 'desc' },
      take: 10,
    },
  },
});

// Select specific fields
const countries = await ctx.db.country.findMany({
  select: {
    id: true,
    name: true,
    slug: true,
    currentGdpPerCapita: true,
    currentPopulation: true,
  },
});

// Complex filtering
const results = await ctx.db.country.findMany({
  where: {
    AND: [
      { economicTier: { gte: '4' } },
      { populationTier: { in: ['large', 'massive'] } },
      {
        OR: [
          { continent: 'Europe' },
          { region: 'North America' },
        ],
      },
    ],
  },
});
```

#### Transactions
```typescript
// Atomic operations
const result = await ctx.db.$transaction(async (tx) => {
  // Create country
  const country = await tx.country.create({
    data: countryData,
  });

  // Create related records
  await tx.economicProfile.create({
    data: {
      countryId: country.id,
      ...economicData,
    },
  });

  await tx.demographics.create({
    data: {
      countryId: country.id,
      ...demographicData,
    },
  });

  return country;
});
```

---

## Authentication & Authorization

### Available Procedures

The system provides 6 types of procedures with different authentication levels:

```typescript
// src/server/api/trpc.ts

// 1. Public Procedure - No authentication required
export const publicProcedure = t.procedure;

// 2. Protected Procedure - Requires logged-in user
export const protectedProcedure = t.procedure
  .use(authMiddleware)
  .use(rateLimitMiddleware)
  .use(auditLogMiddleware)
  .use(userLoggingMiddleware);

// 3. Country Owner Procedure - Requires country ownership
export const countryOwnerProcedure = protectedProcedure
  .use(countryOwnerMiddleware);

// 4. Executive Procedure - Requires executive-level access
export const executiveProcedure = protectedProcedure
  .use(async ({ ctx, next }) => {
    // Check for executive role
    const hasExecutiveAccess = ctx.user?.role?.name === 'executive'
      || ctx.user?.role?.name === 'admin';

    if (!hasExecutiveAccess) {
      throw new Error('FORBIDDEN: Executive access required');
    }

    return next();
  });

// 5. Admin Procedure - Requires admin role
export const adminProcedure = protectedProcedure
  .use(async ({ ctx, next }) => {
    // Check for admin role
    if (ctx.user?.role?.name !== 'admin') {
      throw new Error('FORBIDDEN: Admin access required');
    }

    return next();
  });

// 6. Premium Procedure - Requires premium subscription (future)
export const premiumProcedure = protectedProcedure
  .use(async ({ ctx, next }) => {
    // Check for premium tier
    if (!ctx.user?.isPremium) {
      throw new Error('FORBIDDEN: Premium subscription required');
    }

    return next();
  });
```

### Usage Examples

```typescript
export const myRouter = createTRPCRouter({
  // Public endpoint - anyone can access
  getPublicData: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.data.findUnique({
        where: { id: input.id }
      });
    }),

  // Protected endpoint - requires login
  getUserData: protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.user is guaranteed to exist
      return await ctx.db.user.findUnique({
        where: { id: ctx.user.id }
      });
    }),

  // Country owner endpoint - requires country ownership
  updateCountry: countryOwnerProcedure
    .input(z.object({
      data: z.object({ name: z.string() })
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.country is guaranteed to exist
      return await ctx.db.country.update({
        where: { id: ctx.country.id },
        data: input.data,
      });
    }),

  // Admin endpoint - requires admin role
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.user.delete({
        where: { id: input.userId }
      });
    }),
});
```

### Context Types

```typescript
// Context available in all procedures
interface BaseTRPCContext {
  db: PrismaClient;              // Database client
  headers: Headers;              // Request headers
  req?: NextRequest;             // Next.js request object
  rateLimitIdentifier: string;   // Rate limit identifier
}

// Context in protectedProcedure
interface ProtectedContext extends BaseTRPCContext {
  auth: {
    userId: string;              // Clerk user ID
  };
  user: {
    id: string;                  // Database user ID
    clerkUserId: string;
    countryId: string | null;
    country: Country | null;
    role: Role | null;
    // ... other user fields
  };
}

// Context in countryOwnerProcedure
interface CountryOwnerContext extends ProtectedContext {
  country: Country;              // User's country (guaranteed)
}
```

---

## Creating a New Router

### Step-by-Step Guide

#### 1. Create Router File

Create a new file in `src/server/api/routers/`:

```typescript
// src/server/api/routers/myNewRouter.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure
} from "~/server/api/trpc";

export const myNewRouter = createTRPCRouter({
  // Add your endpoints here
});
```

#### 2. Add Endpoints

```typescript
export const myNewRouter = createTRPCRouter({
  // Query endpoint
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.myModel.findMany();
    }),

  // Query with input
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.myModel.findUnique({
        where: { id: input.id }
      });
    }),

  // Mutation endpoint
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.myModel.create({
        data: {
          ...input,
          userId: ctx.user.id,
        }
      });
    }),
});
```

#### 3. Register in Root Router

Add your router to `src/server/api/root.ts`:

```typescript
// src/server/api/root.ts
import { createTRPCRouter } from "~/server/api/trpc";
import { myNewRouter } from "./routers/myNewRouter";
// ... other imports

export const appRouter = createTRPCRouter({
  // ... existing routers
  myNew: myNewRouter,  // Add your router here
});

export type AppRouter = typeof appRouter;
```

#### 4. Use in Client

```typescript
// In any React component
import { api } from "~/trpc/react";

function MyComponent() {
  // Query
  const { data, isLoading } = api.myNew.getAll.useQuery();

  // Mutation
  const createMutation = api.myNew.create.useMutation({
    onSuccess: () => {
      console.log('Created successfully!');
    }
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: 'Test',
      description: 'Test description',
    });
  };

  return <div>{/* Your UI */}</div>;
}
```

### Router Template

```typescript
// src/server/api/routers/template.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Define validation schemas
const createInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  value: z.number().positive("Value must be positive"),
});

const updateInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    value: z.number().positive().optional(),
  }),
});

export const templateRouter = createTRPCRouter({
  // ==================== QUERIES ====================

  // Get all items (public)
  getAll: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.model.findMany({
        take: input.limit,
        skip: input.offset,
        orderBy: { createdAt: 'desc' },
      });
    }),

  // Get by ID (public)
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.model.findUnique({
        where: { id: input.id },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      return item;
    }),

  // Get user's items (protected)
  getMine: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.model.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
      });
    }),

  // ==================== MUTATIONS ====================

  // Create item (protected)
  create: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.model.create({
        data: {
          ...input,
          userId: ctx.user.id,
        },
      });
    }),

  // Update item (protected)
  update: protectedProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.model.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      if (existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to update this item',
        });
      }

      return await ctx.db.model.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  // Delete item (protected)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.db.model.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      if (existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to delete this item',
        });
      }

      return await ctx.db.model.delete({
        where: { id: input.id },
      });
    }),

  // Admin-only operations
  deleteAny: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.model.delete({
        where: { id: input.id },
      });
    }),
});
```

---

## Error Handling

### tRPC Error Codes

```typescript
import { TRPCError } from "@trpc/server";

// Standard error codes
throw new TRPCError({
  code: 'UNAUTHORIZED',           // Not authenticated
  message: 'Authentication required',
});

throw new TRPCError({
  code: 'FORBIDDEN',              // Not authorized
  message: 'Insufficient permissions',
});

throw new TRPCError({
  code: 'NOT_FOUND',              // Resource not found
  message: 'Item not found',
});

throw new TRPCError({
  code: 'BAD_REQUEST',            // Invalid input
  message: 'Invalid data provided',
});

throw new TRPCError({
  code: 'CONFLICT',               // Resource conflict
  message: 'Item already exists',
});

throw new TRPCError({
  code: 'TOO_MANY_REQUESTS',      // Rate limit
  message: 'Rate limit exceeded',
});

throw new TRPCError({
  code: 'INTERNAL_SERVER_ERROR',  // Server error
  message: 'Something went wrong',
});
```

### Error Handling Patterns

```typescript
// Pattern 1: Validation errors (handled by Zod)
.input(z.object({
  email: z.string().email("Invalid email format"),
  age: z.number().min(18, "Must be 18 or older"),
}))

// Pattern 2: Not found errors
const item = await ctx.db.model.findUnique({
  where: { id: input.id }
});

if (!item) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Item not found',
  });
}

// Pattern 3: Authorization errors
if (item.userId !== ctx.user.id) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Not authorized',
  });
}

// Pattern 4: Business logic errors
if (user.credits < cost) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Insufficient credits',
  });
}

// Pattern 5: Database errors
try {
  return await ctx.db.model.create({ data: input });
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Item already exists',
    });
  }
  throw error;
}
```

### Client-Side Error Handling

```typescript
// In React components
const { data, error, isLoading } = api.myRouter.getData.useQuery();

if (error) {
  // error.data.code contains the tRPC error code
  // error.message contains the error message
  console.error('Error:', error.message);

  if (error.data?.code === 'UNAUTHORIZED') {
    // Handle auth error
  }
}

// Mutation error handling
const createMutation = api.myRouter.create.useMutation({
  onError: (error) => {
    if (error.data?.code === 'FORBIDDEN') {
      // Show permission error
    } else if (error.data?.code === 'BAD_REQUEST') {
      // Show validation error
    }
  },
  onSuccess: (data) => {
    // Handle success
  },
});
```

---

## Performance Optimization

### 1. Caching Strategies

```typescript
// In-memory cache (for frequently accessed data)
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

function getCachedData(key: string): unknown | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key: string, data: unknown, ttl = 30000): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

// Usage in router
getExpensiveData: publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const cacheKey = `expensiveData_${input.id}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await performExpensiveQuery(ctx.db, input.id);
    setCachedData(cacheKey, data, 60000); // 1 minute TTL

    return data;
  }),
```

### 2. Database Query Optimization

```typescript
// Use select to fetch only needed fields
const countries = await ctx.db.country.findMany({
  select: {
    id: true,
    name: true,
    slug: true,
    // Only select what you need
  },
});

// Use pagination
const countries = await ctx.db.country.findMany({
  take: input.limit,
  skip: input.offset,
  orderBy: { createdAt: 'desc' },
});

// Use cursor-based pagination for large datasets
const countries = await ctx.db.country.findMany({
  take: input.limit,
  cursor: input.cursor ? { id: input.cursor } : undefined,
  skip: input.cursor ? 1 : 0,
  orderBy: { id: 'asc' },
});

// Batch queries to avoid N+1 problems
const countryIds = posts.map(p => p.countryId);
const countries = await ctx.db.country.findMany({
  where: { id: { in: countryIds } }
});

// Use transactions for multiple operations
await ctx.db.$transaction([
  ctx.db.country.create({ data: countryData }),
  ctx.db.economicProfile.create({ data: economicData }),
]);
```

### 3. Rate Limiting

Rate limiting is automatically applied via middleware:

```typescript
// Default limits (configured in rate-limiter.ts)
- Standard queries: 100 requests/minute
- Mutations: 60 requests/minute
- Admin operations: 200 requests/minute
- Search operations: 30 requests/minute
```

### 4. Response Optimization

```typescript
// Use SuperJSON for automatic serialization
// Dates, Maps, Sets, BigInt, etc. are automatically handled

// Return only necessary data
getCountry: publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const country = await ctx.db.country.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        // Don't include large fields unless needed
        // historicalData: false,
      },
    });

    return country;
  }),
```

---

## Testing

### Unit Testing Routers

```typescript
// tests/routers/example.test.ts
import { createInnerTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { mockDeep } from "jest-mock-extended";
import type { PrismaClient } from "@prisma/client";

describe('Example Router', () => {
  let mockDb: any;
  let caller: any;

  beforeEach(() => {
    // Mock database
    mockDb = mockDeep<PrismaClient>();

    // Create test context
    const ctx = {
      db: mockDb,
      auth: { userId: 'test-user-id' },
      user: {
        id: 'test-user-id',
        clerkUserId: 'clerk-test-id',
        countryId: null,
        role: null,
      },
      rateLimitIdentifier: 'test',
      headers: new Headers(),
    };

    // Create caller
    caller = appRouter.createCaller(ctx);
  });

  test('getAll returns all items', async () => {
    const mockItems = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    mockDb.example.findMany.mockResolvedValue(mockItems);

    const result = await caller.example.getAll();

    expect(result).toEqual(mockItems);
    expect(mockDb.example.findMany).toHaveBeenCalledTimes(1);
  });

  test('getById throws NOT_FOUND for invalid ID', async () => {
    mockDb.example.findUnique.mockResolvedValue(null);

    await expect(
      caller.example.getById({ id: 'invalid-id' })
    ).rejects.toThrow('NOT_FOUND');
  });

  test('create requires authentication', async () => {
    // Create caller without auth
    const unauthCaller = appRouter.createCaller({
      db: mockDb,
      auth: null,
      user: null,
      rateLimitIdentifier: 'test',
      headers: new Headers(),
    });

    await expect(
      unauthCaller.example.create({ name: 'Test' })
    ).rejects.toThrow('UNAUTHORIZED');
  });
});
```

### Integration Testing

```typescript
// tests/integration/countries.test.ts
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";

describe('Countries Integration', () => {
  let caller: any;
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await db.user.create({
      data: { clerkUserId: 'test-clerk-id' }
    });
    testUserId = user.id;

    // Create caller with test context
    caller = createCaller({
      db,
      auth: { userId: 'test-clerk-id' },
      user: user,
      rateLimitIdentifier: 'test',
      headers: new Headers(),
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.user.delete({ where: { id: testUserId } });
  });

  test('create and retrieve country', async () => {
    // Create country
    const country = await caller.countries.create({
      name: 'Test Country',
      economicInputs: { /* ... */ },
    });

    expect(country).toBeDefined();
    expect(country.name).toBe('Test Country');

    // Retrieve country
    const retrieved = await caller.countries.getById({
      id: country.id
    });

    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(country.id);
  });
});
```

---

## Best Practices

### 1. Input Validation

✅ **DO**:
- Always validate inputs with Zod schemas
- Use descriptive error messages
- Set reasonable limits (min/max)
- Make optional fields explicit

```typescript
// Good
.input(z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  age: z.number().int().min(0).max(150),
  email: z.string().email("Invalid email"),
  tags: z.array(z.string()).max(10, "Too many tags"),
}))
```

❌ **DON'T**:
- Skip validation
- Use loose types
- Allow unbounded inputs

```typescript
// Bad
.input(z.any())  // No validation!
.input(z.object({
  name: z.string(),  // No constraints
  data: z.record(z.any()),  // Too loose
}))
```

### 2. Authorization

✅ **DO**:
- Always verify ownership before mutations
- Use appropriate procedure types
- Check permissions at the start of handlers
- Log authorization failures

```typescript
// Good
update: protectedProcedure
  .input(updateSchema)
  .mutation(async ({ ctx, input }) => {
    // Verify ownership first
    const item = await ctx.db.item.findUnique({
      where: { id: input.id }
    });

    if (!item || item.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Not authorized',
      });
    }

    // Proceed with update
    return await ctx.db.item.update({
      where: { id: input.id },
      data: input.data,
    });
  }),
```

❌ **DON'T**:
- Skip ownership checks
- Trust client-provided user IDs
- Use publicProcedure for mutations

```typescript
// Bad
update: publicProcedure  // Should be protected!
  .input(z.object({
    id: z.string(),
    userId: z.string(),  // Never trust this!
    data: z.any(),
  }))
  .mutation(async ({ ctx, input }) => {
    // No ownership check!
    return await ctx.db.item.update({
      where: { id: input.id },
      data: input.data,
    });
  }),
```

### 3. Error Handling

✅ **DO**:
- Use appropriate tRPC error codes
- Provide helpful error messages
- Handle database errors gracefully
- Log errors for debugging

```typescript
// Good
try {
  return await ctx.db.item.create({ data: input });
} catch (error) {
  if (error.code === 'P2002') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Item with this name already exists',
    });
  }
  console.error('Create item error:', error);
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to create item',
  });
}
```

❌ **DON'T**:
- Throw generic errors
- Expose internal details
- Swallow errors silently

```typescript
// Bad
try {
  return await ctx.db.item.create({ data: input });
} catch (error) {
  // Too generic!
  throw new Error('Something went wrong');

  // Exposes internals!
  throw new Error(`DB Error: ${error.message}`);

  // Silent failure!
  return null;
}
```

### 4. Performance

✅ **DO**:
- Select only needed fields
- Use pagination for large datasets
- Cache expensive queries
- Use database indexes

```typescript
// Good
getAll: publicProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
  }))
  .query(async ({ ctx, input }) => {
    return await ctx.db.item.findMany({
      select: {
        id: true,
        name: true,
        // Only what you need
      },
      take: input.limit,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }),
```

❌ **DON'T**:
- Fetch all fields unnecessarily
- Return unbounded datasets
- Perform N+1 queries

```typescript
// Bad
getAll: publicProcedure
  .query(async ({ ctx }) => {
    // Returns everything!
    const items = await ctx.db.item.findMany();

    // N+1 query problem!
    for (const item of items) {
      item.user = await ctx.db.user.findUnique({
        where: { id: item.userId }
      });
    }

    return items;
  }),
```

### 5. Type Safety

✅ **DO**:
- Define proper TypeScript types
- Use Zod for runtime validation
- Export types for client use
- Leverage type inference

```typescript
// Good
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "~/server/api/root";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CountryOutput = RouterOutputs['countries']['getById'];

// Types are automatically inferred
const { data } = api.countries.getById.useQuery({ id: '123' });
// data is properly typed as CountryOutput
```

❌ **DON'T**:
- Use `any` types
- Skip validation
- Manually type outputs

```typescript
// Bad
const { data } = api.countries.getById.useQuery({ id: '123' });
const country = data as any;  // Lost type safety!
```

---

## Related Documentation

- [API Reference](../../../docs/API_REFERENCE.md) - Complete endpoint documentation
- [Code Standards](../../../docs/CODE_STANDARDS.md) - TypeScript and coding conventions
- [Database Schema](../../../prisma/schema.prisma) - Prisma database models
- [Testing Guide](../../../docs/TESTING_GUIDE.md) - Testing strategies and examples
- [Authentication Guide](../../../docs/AUTHENTICATION.md) - Clerk authentication setup

---

## Support & Resources

- **tRPC Documentation**: https://trpc.io/docs
- **Zod Documentation**: https://zod.dev
- **Prisma Documentation**: https://www.prisma.io/docs
- **Next.js App Router**: https://nextjs.org/docs/app

---

**Last Updated:** October 16, 2025
**Version:** 1.1.0
**Maintained By:** IxStats Development Team
