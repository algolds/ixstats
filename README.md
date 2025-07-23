# IxStats - Advanced Economic Simulation Platform

A comprehensive Next.js 15 application for real-time economic modeling, strategic analysis, and nation management. Features custom time flow systems, tier-based economic modeling, and advanced analytics dashboards. Built for tabletop RPG campaigns, world-building, and complex economic simulation with Discord bot integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- SQLite (development) / PostgreSQL (production)

### Development Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd ixstats
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Initialize database**
   ```bash
   npm run db:setup
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   - Runs on port 3000 with comprehensive validation
   - Access at: http://localhost:3000/
   - For simple mode without validation: `npm run dev:simple`

### Production Deployment

1. **Build application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm run start:prod
   ```
   - Runs on port 3550 with `/projects/ixstats` base path
   - Access at: http://localhost:3550/projects/ixstats

3. **One-command deployment**
   ```bash
   npm run deploy:prod
   ```

## 📋 Essential Commands

### Development
```bash
npm run dev              # Start development server with comprehensive validation
npm run dev:simple       # Start without validation checks
npm run dev:auth         # Start with Clerk authentication emphasis
npm run dev:db           # Setup database and start development
npm run start:dev        # Start development server (port 3000, root path)
```

### Production
```bash
npm run build            # Build for production
npm run start:prod       # Start production server (port 3550, /projects/ixstats basePath)
npm run deploy:prod      # Build and start production server
npm run preview          # Build and preview locally
npm run validate:servers # Validate server configurations
```

### Code Quality
```bash
npm run check            # Full check (lint + typecheck)
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run typecheck        # TypeScript type checking
npm run format:write     # Format code with Prettier
npm run format:check     # Check code formatting
```

### Database
```bash
npm run db:setup         # Full database setup (generate + push + init)
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run database migrations
npm run db:init          # Initialize database with data
npm run db:reset         # Reset database (force)
npm run db:studio        # Open Prisma Studio
```

### Authentication
```bash
npm run auth:check       # Check authentication configuration
npm run auth:check:dev   # Check development auth config
npm run auth:check:prod  # Check production auth config
npm run clerk:setup      # Interactive Clerk setup for development
```

### Testing & Utilities
```bash
npm run test             # Run tests
npm run test:watch       # Watch mode tests
npm run test:coverage    # Test coverage
npm run clean            # Clean build artifacts
```

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Database**: SQLite (development) / PostgreSQL (production) with Prisma ORM
- **API**: tRPC for type-safe API layer with input validation
- **Authentication**: Clerk (optional, supports demo mode)
- **UI**: Tailwind CSS with Radix UI components and Shadcn/ui
- **Time System**: Custom IxTime system with Discord bot synchronization
- **Charts**: Recharts and custom visualization components
- **Validation**: Zod for runtime type checking
- **Styling**: CSS-in-JS with responsive design patterns

### Project Structure
```
src/
├── app/                    # Next.js app directory
│   ├── _components/        # Shared global components
│   ├── admin/             # Admin panel with system controls
│   ├── builder/           # Country creation/customization tool
│   ├── countries/         # Country browsing and detailed views
│   ├── dashboard/         # Main analytics dashboard
│   ├── dm-dashboard/      # Dungeon Master controls
│   └── sdi/               # Strategic Defense Initiative modules
├── components/            # Reusable UI components
│   └── ui/                # Shadcn/ui components
├── lib/                   # Core utilities and services
│   ├── calculations.ts    # Economic modeling engine
│   ├── ixtime.ts         # Time management system
│   ├── data-parser.ts    # Excel import handling
│   └── mediawiki-service.ts # Wiki integration
├── server/               # Backend API (tRPC)
│   └── api/routers/      # API route definitions
├── types/                # TypeScript type definitions
└── prisma/              # Database schema and migrations
```

### Core Systems

#### IxTime System (`src/lib/ixtime.ts`)
The heart of the economic simulation, providing synchronized time flow:
- **Real-world epoch**: October 4, 2020 (when IxTime started)
- **In-game epoch**: January 1, 2028 (roster data baseline)
- **Base time multiplier**: 4x faster than real time (configurable 0x-10x)
- **Discord bot integration**: Synchronized time control across services
- **Key functions**: `getCurrentIxTime()`, `getYearsSinceGameEpoch()`, `convertToIxTime()`

#### Economic Calculation Engine (`src/lib/calculations.ts`)
Real-time economic modeling with sophisticated tier-based growth:
- **Tier-based growth caps**: 7 economic tiers with different maximum growth rates
- **Global growth factor**: 3.21% (1.0321) multiplier applied before tier caps
- **Population scaling**: 8 population tiers affecting economic dynamics
- **DM input system**: Dynamic modifications for special events and policies
- **Historical tracking**: Automatic data point creation and projection calculations

#### Strategic Defense Initiative (SDI) (`src/app/sdi/`)
Comprehensive intelligence and crisis management system:
- **Intelligence Feed**: Real-time intelligence item management and analysis
- **Crisis Events**: Event tracking with impact assessment and response planning
- **Diplomatic Relations**: Bilateral relationship tracking with historical context
- **Economic Indicators**: Advanced economic monitoring and trend analysis
- **Treaty Management**: International agreement tracking and compliance monitoring

## 🎯 Core Features

### Executive Dashboard
Complete nation management interface with:
- **Cabinet Meeting Scheduler**: Minister invitations and meeting management
- **Economic Policy Proposals**: Real-time policy impact preview and implementation
- **National Security Dashboard**: Threat assessment and emergency protocols
- **Performance Metrics**: Social, Security, and Political analytics with deep-dive modals
- **GDP and Population Analytics**: Historical trends, projections, and tier analysis

### MyCountry® Premium Suite
Advanced analytics and planning tools:
- **Strategic Planning Module**: Scenario builder with advanced planning tools
- **Advanced Analytics Dashboard**: Custom charts and data exploration
- **AI Advisor System**: Intelligent recommendations and insights
- **Predictive Models**: Economic forecasting and scenario analysis
- **Premium Tools Access**: Exclusive features for enhanced nation management

### Country Management & Analytics
- **Country Browser**: 180+ countries with advanced filtering and search
- **Detailed Country Profiles**: Comprehensive economic data with interactive charts
- **Comparative Analysis**: Multi-country economic metric comparisons
- **Historical Data Tracking**: Time-series analysis with projection capabilities
- **Flag Management**: Automated flag fetching with caching and fallback systems

### Economic Modeling Engine
- **Real-time Calculations**: IxTime-synchronized economic updates
- **Tier-Based Growth System**: 7 economic tiers with sophisticated growth caps
- **Population Scaling**: 8-tier population system affecting economic dynamics
- **Global Growth Factor**: 3.21% base multiplier with tier-specific limitations
- **DM Input System**: Time-bound economic modifiers for events and policies

### Strategic Defense Initiative (SDI)
Comprehensive intelligence and crisis management:
- **Intelligence Operations**: Real-time intelligence feed with analysis tools
- **Crisis Management**: Event tracking with impact assessment and response protocols
- **Diplomatic Relations**: Bilateral relationship monitoring with historical context
- **Economic Intelligence**: Advanced economic indicator tracking and analysis
- **Treaty Management**: International agreement compliance and monitoring

### Administrative Systems
- **Admin Panel**: System configuration, user management, and global settings
- **DM Dashboard**: Economic policy controls, special event creation, and time management
- **Country Builder**: Interactive country creation with economic profile customization
- **Data Import System**: Excel roster import with validation and preview
- **Calculation Logging**: Performance monitoring and debugging tools

## 🔧 Configuration

### Environment Variables

#### Required (All Environments)
```bash
DATABASE_URL="file:./dev.db"  # Development
DATABASE_URL="file:./prisma/prod.db"  # Production

NODE_ENV="development"  # or "production"
```

#### Optional - Authentication (Clerk)
```bash
# Development Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Production Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
```

#### Optional - External Services
```bash
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"  # MediaWiki API for country data
IXTIME_BOT_URL="http://localhost:3001"           # Discord bot API endpoint
DISCORD_BOT_TOKEN="..."                          # Discord bot integration
DISCORD_CLIENT_ID="..."                          # Discord application ID
DISCORD_GUILD_ID="..."                           # Discord server ID
```

### API Structure (`src/server/api/routers/`)

#### tRPC Routers
- **`countries`**: Country data management, economic calculations, historical tracking
- **`admin`**: System configuration, data import, time control, calculation logs
- **`users`**: User management, authentication, and country assignments
- **`sdi`**: Strategic Defense Initiative modules (intelligence, crisis, diplomatic, economic)

#### Database Models (`prisma/schema.prisma`)
- **Core Models**: Country, User, HistoricalDataPoint, DmInputs, SystemConfig
- **Economic Models**: EconomicProfile, LaborMarket, FiscalSystem, IncomeDistribution, GovernmentBudget, Demographics
- **SDI Models**: IntelligenceItem, CrisisEvent, DiplomaticRelation, Treaty, EconomicIndicator
- **Monitoring**: CalculationLog for performance tracking and debugging

### Economic Tiers

#### Economic Tiers (GDP per Capita)
- **Impoverished**: $0-$9,999 (10% max growth)
- **Developing**: $10,000-$24,999 (7.50% max growth)
- **Developed**: $25,000-$34,999 (5% max growth)
- **Healthy**: $35,000-$44,999 (3.50% max growth)
- **Strong**: $45,000-$54,999 (2.75% max growth)
- **Very Strong**: $55,000-$64,999 (1.50% max growth)
- **Extravagant**: $65,000+ (0.50% max growth)

#### Population Tiers
- **Tier 1**: 0-9.9M people
- **Tier 2**: 10-29.9M people
- **Tier 3**: 30-49.9M people
- **Tier 4**: 50-79.9M people
- **Tier 5**: 80-119.9M people
- **Tier 6**: 120-349.9M people
- **Tier 7**: 350-499.9M people
- **Tier X**: 500M+ people

## 🚦 Environment-Specific Settings

### Development (Port 3000)
- **URL**: http://localhost:3000/
- **Base Path**: `/` (root)
- **Database**: `dev.db`
- **Hot Reload**: Enabled with Turbopack
- **Authentication**: Clerk test keys or demo mode
- **Time Bot**: Usually runs on port 3001 for integration testing

### Production (Port 3550)
- **URL**: https://ixwiki.com/projects/ixstats
- **Base Path**: `/projects/ixstats`
- **Database**: Environment-specific (SQLite or PostgreSQL)
- **Authentication**: Clerk production keys or disabled
- **Reverse Proxy**: Nginx configuration for external access

## 🛠️ Development Guidelines

### Time System Integration
- Always use `IxTime.getCurrentIxTime()` for current game time
- Use `IxTime.getYearsSinceGameEpoch()` for time elapsed calculations
- Store timestamps as IxTime values, not real-world time
- Economic calculations should reference IxTime epochs

### Database Operations
- Use Prisma ORM for all database interactions
- Historical data points created for significant calculations
- DM inputs have duration and expiration logic
- Always update `lastCalculated` timestamps

### API Development
- Use tRPC for type-safe APIs
- Follow existing router patterns in `src/server/api/routers/`
- Include proper error handling and validation
- Document complex economic calculation endpoints

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts
- **Problem**: Port conflicts between services
- **Solution**: Default ports are 3000 (dev), 3550 (prod), 3001 (time bot)

#### Authentication Issues
- **Problem**: Clerk "Invalid host" errors
- **Solution**: Run `npm run clerk:setup` or check keys in `.env.local`
- **Check Config**: Run `npm run auth:check:dev`

#### Database Problems
- **Problem**: Database not found
- **Solution**: Run `npm run db:setup` to initialize
- **Reset**: Use `npm run db:reset` to start fresh

#### Build Errors
- **Problem**: TypeScript errors preventing build
- **Solution**: Run `npm run typecheck` to identify issues
- **Quick Fix**: Use `npm run build:no-check` temporarily

### Server Management

#### Check Running Servers
```bash
# Development server (port 3000)
netstat -tlnp | grep :3000

# Production server (port 3550)
netstat -tlnp | grep :3550

# Time bot (port 3001)
netstat -tlnp | grep :3001
```

#### Stop Servers
```bash
# Stop development server
kill $(lsof -ti:3000)

# Stop production server
kill $(lsof -ti:3550)

# Stop time bot
kill $(lsof -ti:3001)
```

#### Background Server
```bash
# Start production server in background
nohup npm run start:prod > server.log 2>&1 &

# View logs
tail -f server.log
```

## 🎮 Advanced System Features

### Real-Time Economic Simulation
- **IxTime Synchronization**: Discord bot integration for coordinated time control
- **Dynamic Growth Modeling**: Tier-based economic growth with global factor application
- **Historical Projection**: Automatic calculation of past and future economic trends
- **Performance Monitoring**: Built-in calculation logging and optimization tracking

### Flag Service & Media Integration
- **Intelligent Flag Caching**: Bulk flag loading with fallback mechanisms
- **MediaWiki Integration**: Real-time country data fetching from external wiki APIs
- **Simple Flag Components**: Lightweight flag rendering with error handling
- **Cache Management**: Efficient flag storage and retrieval systems

### Advanced Dashboard Analytics
- **Executive Modals**: Cabinet meetings, economic policies, national security dashboards
- **Premium Analytics**: Strategic planning tools, AI advisor, predictive modeling
- **Performance Metrics**: Deep-dive analytics for social, security, and political indicators
- **Focus Cards**: Government operations, foreign relations, social development tracking

### Data Import & Management
- **Excel Roster Import**: Comprehensive validation and preview systems
- **Data Parser**: Robust handling of economic and demographic data
- **Calculation Engine**: Real-time economic projections with tier-based constraints
- **Historical Tracking**: Automated data point creation and trend analysis

## 📊 Performance & Monitoring

### Built-in Monitoring
- Page load timing tracking
- API response time measurement
- Database query performance logging
- Component render optimization

### Calculation Logging
- Economic calculation execution tracking
- Performance benchmarking
- Error logging and debugging
- System health indicators

## 🔗 Related Systems

- **IxWiki**: MediaWiki integration for country information
- **Discord Time Bot**: Synchronization for time management
- **IxMaps**: Interactive mapping system integration
- **IxTime API**: Game world time coordination

---

**IxStats** - Comprehensive economic simulation and analysis platform for world-builders and game masters.