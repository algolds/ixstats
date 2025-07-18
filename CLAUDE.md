# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start development server with turbo
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean build artifacts
npm run clean
```

### Code Quality
```bash
# Full check (lint + typecheck)
npm run check

# Lint only
npm run lint

# Fix linting issues
npm run lint:fix

# TypeScript type checking
npm run typecheck

# Format code
npm run format:write

# Check formatting
npm run format:check
```

### Database Operations
```bash
# Full database setup (generate + push + init)
npm run db:setup

# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Run database migrations
npm run db:migrate

# Initialize database with data
npm run db:init

# Reset database (force)
npm run db:reset

# Open Prisma Studio
npm run db:studio

# Start dev server with fresh database
npm run dev:db
```

### Testing
```bash
# Run tests
npm run test

# Watch mode tests
npm run test:watch

# Test coverage
npm run test:coverage
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: SQLite (development) / PostgreSQL (production) with Prisma ORM
- **API**: tRPC for type-safe API layer
- **Authentication**: Clerk (optional)
- **UI**: Tailwind CSS with Radix UI components and custom UI library
- **Time Management**: Custom IxTime system for game world time simulation

### Core Systems

#### IxTime System (`src/lib/ixtime.ts`)
- **Purpose**: Custom time flow system for economic simulation
- **Key Concepts**:
  - Real-world epoch: October 4, 2020 (when IxTime started)
  - In-game epoch: January 1, 2028 (roster data baseline)
  - Base time multiplier: 4x faster than real time
  - Discord bot integration for synchronized time control
- **Critical Functions**: `getCurrentIxTime()`, `getYearsSinceGameEpoch()`, `convertToIxTime()`

#### Economic Calculation Engine (`src/lib/calculations.ts`)
- **Purpose**: Real-time economic modeling and projection
- **Key Features**:
  - Tier-based growth rate caps (7 economic tiers, 8 population tiers)
  - Global growth factor application (3.21% = 1.0321 multiplier)
  - DM input system for dynamic modifications
  - Historical data tracking and projections
- **Economic Tiers**: Impoverished ($0-9k), Developing ($10-24k), Developed ($25-34k), Healthy ($35-44k), Strong ($45-54k), Very Strong ($55-64k), Extravagant ($65k+)
- **Population Tiers**: 1 (0-9M), 2 (10-29M), 3 (30-49M), 4 (50-79M), 5 (80-119M), 6 (120-349M), 7 (350-499M), X (500M+)

#### Database Schema (`prisma/schema.prisma`)
- **Core Models**: Country, User, HistoricalDataPoint, DmInputs, SystemConfig
- **Economic Models**: EconomicProfile, LaborMarket, FiscalSystem, IncomeDistribution, GovernmentBudget, Demographics
- **SDI Models**: IntelligenceItem, CrisisEvent, DiplomaticRelation, Treaty, EconomicIndicator
- **Calculation Tracking**: CalculationLog for performance monitoring

### API Structure (`src/server/api/`)
- **tRPC Routers**:
  - `countries`: Country data, economic calculations, historical tracking
  - `admin`: System configuration, data import, time control, calculation logs
  - `users`: User management and country assignments
  - `sdi`: Strategic Defense Initiative modules (intelligence, crisis, diplomatic, economic)

### Application Structure
```
src/app/
├── _components/           # Shared global components
├── admin/                 # Admin panel with system controls
├── builder/               # Country creation/customization tool
├── countries/             # Country browsing and detailed views
│   └── [id]/             # Individual country pages with economic data
├── dashboard/             # Main analytics dashboard
├── dm-dashboard/          # Dungeon Master controls
└── sdi/                   # Strategic Defense Initiative modules
```

### Key Utilities (`src/lib/`)
- `calculations.ts`: Economic modeling engine
- `ixtime.ts`: Time management system
- `data-parser.ts`: Excel import handling
- `flag-service.ts`: Country flag management
- `mediawiki-service.ts`: Wiki integration
- `chart-utils.ts`: Data visualization helpers

## Environment Configuration (`src/env.js`)

Required variables:
- `DATABASE_URL`: Database connection string
- `IXTIME_BOT_URL`: Discord bot API endpoint (default: http://localhost:3001)
- `NEXT_PUBLIC_MEDIAWIKI_URL`: MediaWiki API for country data (default: https://ixwiki.com/)

Optional:
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Authentication
- `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`: Bot integration

## Development Guidelines

### Time System Integration
- Always use `IxTime.getCurrentIxTime()` for current game time
- Use `IxTime.getYearsSinceGameEpoch()` for calculating time elapsed since roster baseline
- Store timestamps as IxTime values, not real-world time
- Economic calculations should always reference IxTime epochs

### Economic Calculations
- Growth rates are stored as decimals (0.05 = 5%)
- Always apply global growth factor (1.0321) before tier caps
- Tier caps are absolute maximums after all modifiers
- Use `IxStatsCalculator` class for all economic projections

### Database Operations
- Use Prisma ORM for all database interactions
- Historical data points should be created for significant calculations
- DM inputs have duration and expiration logic
- Always update `lastCalculated` timestamps

### API Development
- Use tRPC for type-safe APIs
- Follow existing router patterns in `src/server/api/routers/`
- Include proper error handling and validation
- Document complex economic calculation endpoints

### UI Components
- Use existing UI components from `src/components/ui/`
- Follow established patterns for charts and data visualization
- Implement responsive design for dashboard layouts
- Use Tailwind CSS for styling consistency

### Testing
- Test files should follow Jest conventions
- Focus on economic calculation accuracy
- Test time system edge cases
- Validate tier classification logic

## Critical Development Notes

1. **Growth Rate Handling**: Growth rates in database and calculations are decimals, not percentages
2. **Time Synchronization**: Always consider Discord bot sync when modifying time-related features
3. **Tier Systems**: Economic and population tiers have specific thresholds that affect calculations
4. **Global Growth Factor**: 3.21% (1.0321) multiplier is applied to all economic growth before tier caps
5. **SDI Integration**: Strategic Defense Initiative features are separate modules with their own data models
6. **MediaWiki Integration**: Flag and country data can be fetched from external MediaWiki API

## Common Issues

- **Time Desync**: Use `IxTime.syncWithBot()` to resolve Discord bot synchronization issues
- **Calculation Errors**: Check global growth factor application and tier cap logic
- **Database Migration**: Run `npm run db:migrate` after schema changes
- **Type Errors**: Run `npm run typecheck` and ensure Prisma client is generated

When working on economic features, always test with realistic country data and verify tier classifications are correct. The economic modeling system is the core of the application and requires careful attention to mathematical accuracy.



Executive Dashboard
[ ] Cabinet Meeting Modal
[ ] Implement scheduling of cabinet meetings
[ ] Invite ministers and manage attendees
[ ] Review and display meeting minutes and agenda
[ ] Economic Policy Modal
[ ] Propose new economic policies
[ ] Review and edit current policies
[ ] Preview economic impact of policy changes
[ ] National Security Modal
[ ] Security dashboard with threat assessment
[ ] Emergency protocols and response tools
[ ] GDP Details Modal
[ ] Show historical GDP data (charts)
[ ] Show GDP projections and trends
[ ] GDP per Capita Details Modal
[ ] Show GDP per capita trends
[ ] Global comparison charts
[ ] Population Details Modal
[ ] Population growth charts
[ ] Demographic breakdowns (age, etc.)
[ ] Projections
[ ] Population Tier Details Modal
[ ] Explain population tier system
[ ] Show requirements and benefits for each tier
[ ] Performance Metrics
[ ] Replace hardcoded/placeholder values for Social, Security, and Political metrics with real data
[ ] Add in-depth stats, charts, and analytics for each metric (expandable modal)
MyCountry® Premium Suite
[ ] Upgrade to Premium Modal
[ ] Implement upgrade form and payment flow
[ ] Show pricing and benefits
[ ] Premium Tools Modal
[ ] Dashboard for premium features
[ ] Quick links to advanced tools
[ ] Strategic Planning Modal
[ ] Strategic planning tools
[ ] Scenario builder
[ ] Advanced Analytics Modal
[ ] Analytics dashboard
[ ] Custom charts and data exploration
[ ] AI Advisor Modal
[ ] AI chat interface
[ ] Recommendations and insights
[ ] Predictive Models Modal
[ ] Forecasts and scenario analysis
[ ] Visualization of predictive models
Focus Cards
[ ] Government Operations
[ ] Administrative efficiency metrics
[ ] Public services dashboard
[ ] Foreign Relations
[ ] International partnerships management
[ ] Diplomatic initiatives and status
[ ] Social Development
[ ] Social program tracking
[ ] Living standards and welfare analytics
[ ] Trend and Risk Analytics
[ ] Show risk flags and vulnerabilities
[ ] Volatility and trend analysis
General/Integration
[ ] Replace all "Feature coming soon!" placeholders with real implementations
[ ] Wire up all modals to backend data and actions
[ ] Add charts, analytics, and projections where marked as TODO
[ ] Improve loading and error states for all sections
[ ] Add tests for new features and modals
Optional/Advanced
[ ] User customization of dashboard layout
[ ] Notifications and reminders for executive actions
[ ] Role-based access for premium/admin features
[ ] Mobile/responsive improvements
