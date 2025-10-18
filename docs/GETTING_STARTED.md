# Getting Started with IxStats Development
**Version 1.1.0**

Welcome to IxStats! This guide will help you set up your development environment and understand the project structure in about 5 minutes.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Environment Configuration](#environment-configuration)
- [First Run](#first-run)
- [Project Structure](#project-structure)
- [Common First Tasks](#common-first-tasks)
- [Development Workflow](#development-workflow)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js**: Version 18.17.0 or higher
  ```bash
  node --version  # Should be v18.17.0+
  ```
- **npm**: Version 9.0.0 or higher
  ```bash
  npm --version  # Should be 9.0.0+
  ```

### Optional but Recommended
- **Git**: For version control
- **VS Code**: Recommended IDE with TypeScript support
- **PostgreSQL**: For production-like development (SQLite works for dev)

### External Services (Optional for Full Features)
- **Clerk Account**: For authentication (free tier available)
  - Sign up at [clerk.com](https://clerk.com)
  - Get development API keys from dashboard
- **Discord Bot** (Optional): For IxTime synchronization
  - Create app at [discord.com/developers](https://discord.com/developers/applications)
- **Redis** (Optional): For production-grade rate limiting
  - Can use in-memory fallback for development

## Quick Setup

### 1. Clone and Install

```bash
# Clone the repository (if not already done)
cd /ixwiki/public/projects/ixstats

# Install dependencies (takes 2-3 minutes)
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

**Minimal Configuration** for quick start:

```bash
# .env.local - Minimal setup for local development
NODE_ENV="development"
DATABASE_URL="file:./dev.db"
PORT=3000

# Application URLs
IXSTATS_WEB_URL="http://localhost:3000"
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="http://localhost:3001"

# Optional: Clerk Authentication (can skip initially)
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
# CLERK_SECRET_KEY="sk_test_..."
```

**Note**: The app will run without Clerk keys, but authentication features will be disabled.

### 3. Database Initialization

Set up the SQLite database:

```bash
# Initialize database with schema and seed data
npm run db:setup
```

This command will:
- Generate Prisma client
- Apply database migrations
- Create initial tables (131 models)
- Seed with sample data (optional)

### 4. Start Development Server

```bash
# Start with full validation (recommended)
npm run dev

# OR start without validation (faster startup)
npm run dev:simple
```

The application will be available at: **http://localhost:3000**

## Environment Configuration

### Full Environment Variables Reference

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete documentation.

### Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `DATABASE_URL` | Yes | `file:./dev.db` | Database connection string |
| `PORT` | No | `3000` | Development server port |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | - | Clerk public key |
| `CLERK_SECRET_KEY` | No | - | Clerk secret key |
| `IXTIME_BOT_URL` | No | `http://localhost:3001` | Discord bot API endpoint |

### Setting Up Clerk Authentication

1. Create account at [clerk.com](https://clerk.com)
2. Create new application in Clerk Dashboard
3. Go to **API Keys** section (Development tab)
4. Copy keys to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxx"
CLERK_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxx"
```

5. Restart development server

## First Run

### Accessing the Application

1. Open browser to **http://localhost:3000**
2. You should see the IxStats splash page
3. Navigate to different sections:
   - **Dashboard**: `/dashboard`
   - **Builder**: `/builder`
   - **Countries**: `/countries`
   - **Admin** (requires auth): `/admin`

### Testing Database Connection

```bash
# Open Prisma Studio to explore database
npm run db:studio
```

Prisma Studio will open at **http://localhost:5555** showing all database tables.

### Verifying Installation

```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run all checks
npm run check
```

## Project Structure

### Root Directory Layout

```
/ixwiki/public/projects/ixstats/
├── src/                    # Application source code
│   ├── app/               # Next.js 15 App Router pages
│   ├── components/        # React components
│   ├── lib/              # Utility libraries and services
│   ├── server/           # Server-side code (tRPC routers)
│   ├── hooks/            # React custom hooks
│   ├── types/            # TypeScript type definitions
│   └── styles/           # Global styles (Tailwind CSS)
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database models (110 models)
│   ├── migrations/       # Database migration files
│   └── dev.db           # SQLite database (development)
├── scripts/              # Utility scripts
│   ├── setup/           # Setup and initialization scripts
│   └── audit/           # Audit and testing scripts
├── docs/                 # Documentation
├── public/              # Static assets
└── tests/               # Test files
```

### Key Directories Explained

#### `/src/app/` - Application Pages
Next.js 15 App Router structure with:
- **`/dashboard`**: Main user dashboard
- **`/builder`**: Country builder interface
- **`/mycountry`**: User's country management
- **`/countries`**: Country directory and profiles
- **`/admin`**: Administrative interfaces
- **`/api`**: API routes and endpoints

#### `/src/components/` - React Components
Organized by feature and type:
- **`/ui`**: Reusable UI components (Radix UI wrappers)
- **`/shared`**: Shared components across features
- **`/economy`**: Economic system components
- **`/government`**: Government builder components
- **`/diplomatic`**: Diplomatic system components
- **`/tax-system`**: Tax system components

#### `/src/lib/` - Utility Libraries
Core business logic and utilities:
- **`ixtime.ts`**: Custom time system (2x speed)
- **`calculations.ts`**: Economic calculation engine
- **`unified-atomic-state.ts`**: Atomic government system
- **`trpc.ts`**: tRPC client configuration
- **`utils.ts`**: General utility functions

#### `/src/server/` - Server-Side Code
Backend logic and APIs:
- **`/api/routers/`**: 22 tRPC routers with 304 endpoints
- **`/api/trpc.ts`**: tRPC server configuration
- **`/services/`**: Business logic services
- **`db.ts`**: Prisma client singleton

#### `/prisma/` - Database
- **`schema.prisma`**: 110 database models
- **`migrations/`**: Version-controlled schema changes
- **`dev.db`**: SQLite development database
- **`prod.db`**: SQLite production database (when using SQLite)

### Configuration Files

```
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS v4 configuration
├── tsconfig.json          # TypeScript compiler options
├── prettier.config.js     # Code formatting rules
├── package.json           # Dependencies and scripts
└── .env.local            # Environment variables (not committed)
```

## Common First Tasks

### 1. Explore the Database Schema

```bash
# Open Prisma Studio
npm run db:studio
```

Browse tables to understand data structure:
- **Country**: Nation profiles and economic data
- **User**: User accounts and authentication
- **GovernmentStructure**: Government configurations
- **EconomicData**: Economic metrics and calculations
- **Achievement**: Achievement tracking system

### 2. Run the Builder

1. Navigate to **http://localhost:3000/builder**
2. Click "Start Building" to create a country
3. Explore the step-by-step wizard:
   - Foundation settings
   - Economic configuration
   - Government structure
   - Tax system
   - Preview and save

### 3. Examine a tRPC Router

Open `/src/server/api/routers/countries.ts`:

```typescript
// Example router structure
export const countriesRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.country.findMany();
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.country.findUnique({
        where: { slug: input.slug },
      });
    }),
});
```

### 4. Create a Simple Component

Create a new component in `/src/components/shared/`:

```typescript
// src/components/shared/WelcomeMessage.tsx
import React from 'react';

export function WelcomeMessage({ name }: { name: string }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6">
      <h2 className="text-2xl font-bold">Welcome, {name}!</h2>
      <p className="mt-2 text-muted-foreground">
        Ready to build your nation?
      </p>
    </div>
  );
}
```

Use it in a page:

```typescript
// src/app/page.tsx
import { WelcomeMessage } from "~/components/shared/WelcomeMessage";

export default function HomePage() {
  return <WelcomeMessage name="Developer" />;
}
```

### 5. Make a tRPC API Call

```typescript
// In a component
import { api } from "~/lib/trpc";

export function CountryList() {
  const { data: countries, isLoading } = api.countries.getAll.useQuery();

  if (isLoading) return <div>Loading countries...</div>;

  return (
    <ul>
      {countries?.map((country) => (
        <li key={country.id}>{country.name}</li>
      ))}
    </ul>
  );
}
```

### 6. Add a Database Model

1. Edit `/prisma/schema.prisma`:

```prisma
model ExampleModel {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

2. Apply changes:

```bash
npm run db:push
npm run db:generate
```

## Development Workflow

### Daily Development Loop

1. **Start development server**:
   ```bash
   npm run dev
   ```

2. **Make code changes**:
   - Edit files in `/src/`
   - Changes hot-reload automatically

3. **Check for errors**:
   ```bash
   npm run check
   ```

4. **Format code**:
   ```bash
   npm run format:write
   ```

5. **Test changes**:
   - Manual testing in browser
   - Run audit scripts: `npm run test:health`

### Database Changes Workflow

1. **Modify schema**: Edit `prisma/schema.prisma`
2. **Generate migration**:
   ```bash
   npm run db:migrate
   ```
3. **Regenerate Prisma client**:
   ```bash
   npm run db:generate
   ```
4. **Restart dev server**

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add feature: description"

# Push to remote
git push origin feature/your-feature-name
```

## Next Steps

### Essential Reading

1. **[CODE_STANDARDS.md](./CODE_STANDARDS.md)** - Coding conventions and best practices
2. **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute to the project
3. **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Complete environment variable reference
4. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions

### Explore Core Systems

1. **Economic System**: `/src/lib/calculations.ts`
2. **IxTime System**: `/src/lib/ixtime.ts`
3. **Atomic Government**: `/src/lib/unified-atomic-state.ts`
4. **Authentication**: `/src/server/api/trpc.ts`

### Learn the Tech Stack

- **Next.js 15 App Router**: [nextjs.org/docs](https://nextjs.org/docs)
- **tRPC**: [trpc.io/docs](https://trpc.io/docs)
- **Prisma ORM**: [prisma.io/docs](https://prisma.io/docs)
- **Tailwind CSS v4**: [tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Clerk Auth**: [clerk.com/docs](https://clerk.com/docs)

### Join the Community

- **Documentation**: `/docs` directory
- **Issue Tracker**: Report bugs and request features
- **Code Reviews**: Submit pull requests for review

## Getting Help

### Resources

1. **Documentation**: Check `/docs` directory
2. **Code Comments**: Most complex code includes inline documentation
3. **TypeScript Types**: Hover over types in VS Code for inline docs
4. **Prisma Studio**: Explore database structure visually

### Common Questions

**Q: Where do I add new pages?**
A: Create files in `/src/app/[page-name]/page.tsx`

**Q: How do I add new API endpoints?**
A: Add procedures to existing routers in `/src/server/api/routers/` or create a new router

**Q: What's the difference between `~` and `@` imports?**
A: Both resolve to `/src`, use either consistently (we prefer `~`)

**Q: Why is my build slow?**
A: Use `npm run build:fast` for faster builds without validation

**Q: How do I reset my database?**
A: Run `npm run db:reset && npm run db:setup`

## Quick Command Reference

```bash
# Development
npm run dev              # Start development server
npm run dev:simple       # Start without validation

# Build & Production
npm run build:fast       # Fast optimized build
npm run start:prod       # Start production server

# Code Quality
npm run check            # Run all checks
npm run lint             # Run ESLint
npm run typecheck        # TypeScript validation
npm run format:write     # Format code

# Database
npm run db:setup         # Full database setup
npm run db:studio        # Open Prisma Studio
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Create migration

# Testing
npm run test:health      # API health check
npm run test:db          # Database integrity check
```

---

**Welcome to IxStats development!** You're now ready to start building. Happy coding!

For detailed code standards and best practices, continue to [CODE_STANDARDS.md](./CODE_STANDARDS.md).
