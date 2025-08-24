# IxStats - Advanced Economic Simulation Platform
*65% Complete - Production-Ready Core with Advanced Features in Development*

A comprehensive Next.js 15 application for real-time economic modeling, strategic intelligence, and executive nation management. Features sophisticated tier-based economic modeling, glass physics UI framework, comprehensive intelligence systems, and IxTime synchronization with Discord bot integration. Built for tabletop RPG campaigns, world-building, and advanced economic simulation.

## 📊 **Current Status (January 2025)**
- ✅ **Core Infrastructure** (95%): Next.js 15, Prisma, tRPC APIs, IxTime system fully operational
- ✅ **Design System** (90%): Glass physics framework, 100+ UI components, responsive design
- 🔄 **Intelligence System** (75%): Components built, live data integration in progress
- ⏳ **Advanced Features** (40%): SDI/ECI modules documented, implementation underway

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
│   ├── mycountry/new/     # Executive Intelligence Suite
│   │   ├── components/    # Intelligence system components
│   │   │   ├── ExecutiveCommandCenter.tsx
│   │   │   ├── NationalPerformanceCommandCenter.tsx
│   │   │   ├── IntelligenceBriefings.tsx
│   │   │   └── ForwardLookingIntelligence.tsx
│   │   ├── types/         # Intelligence type definitions
│   │   │   └── intelligence.ts
│   │   └── utils/         # Intelligence utilities
│   │       ├── dataTransformers.ts
│   │       ├── intelligence.ts
│   │       └── keyValidation.ts
│   └── sdi/               # Strategic Defense Initiative modules
├── components/            # Reusable UI components
│   ├── notifications/     # Notification system components
│   │   └── UnifiedNotificationCenter.tsx
│   └── ui/                # Shadcn/ui components
├── lib/                   # Core utilities and services
│   ├── calculations.ts    # Economic modeling engine
│   ├── ixtime.ts         # Time management system
│   ├── data-parser.ts    # Excel import handling
│   └── mediawiki-service.ts # Wiki integration
├── server/               # Backend API (tRPC)
│   └── api/routers/      # API route definitions
├── services/             # Advanced service layer
│   ├── EnhancedNotificationPriority.ts
│   ├── NotificationCategorization.ts
│   ├── NotificationGrouping.ts
│   └── NotificationDeliveryOptimization.ts
├── stores/               # State management
│   └── notificationStore.ts # Notification state store
├── types/                # TypeScript type definitions
│   └── unified-notifications.ts # Notification system types
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

#### MyCountry Intelligence System (`src/app/mycountry/new/`)
Advanced executive intelligence platform with predictive analytics and decision support:
- **Component Architecture**: 4 main intelligence components with TypeScript type safety
- **Data Transformation**: Converts country data to actionable intelligence with forecasting
- **Smart Notifications**: Multi-dimensional priority scoring with contextual intelligence
- **Performance Optimization**: React.memo, useMemo, and defensive programming patterns
- **Key Components**: ExecutiveCommandCenter, NationalPerformanceCommandCenter, IntelligenceBriefings, ForwardLookingIntelligence
- **Technical Foundation**: 20+ TypeScript interfaces, comprehensive error handling, React key validation

## 🎯 Core Features

### 🏛️ MyCountry® Executive Intelligence Suite
Advanced executive command interface with AI-powered intelligence and strategic decision support:

#### 🧠 Intelligence System Architecture
- **Executive Command Center**: Enhanced country card with contextual alerts, trending insights, and smart content switching (overview/detailed modes)
- **National Performance Command Center**: Advanced vitality analytics with forecasting capabilities, peer comparisons, and critical threshold monitoring
- **Intelligence Briefings**: Categorized actionable intelligence with confidence scoring across four strategic areas:
  - Hot Issues (immediate attention required)
  - Opportunities (growth and development chances)
  - Risk Mitigation (threat assessment and prevention)
  - Strategic Initiatives (long-term planning recommendations)
- **Forward-Looking Intelligence**: Predictive analytics sidebar with competitive intelligence, milestone tracking, and scenario planning

#### 🔔 Advanced Notification System
- **Enhanced Priority Calculation**: Multi-dimensional priority scoring with contextual intelligence and user engagement history
- **Smart Notification Clustering**: Context-aware grouping with adaptive batching strategies and load balancing
- **Delivery Optimization**: Real-time user attention monitoring with behavioral learning and optimal timing calculation
- **Unified Notification Center**: Main notification hub with filtering, categorization, and engagement tracking

#### 📊 Executive Analytics & Performance
- **Real-time Health Indicators**: Overall country status with confidence levels and trend analysis
- **Vitality Intelligence**: Enhanced activity ring system with forecasting, peer rankings, and actionable recommendations
- **Performance Optimization**: React-optimized rendering with intelligent caching and efficient data transformation
- **Type-Safe Architecture**: Comprehensive TypeScript coverage with defensive programming patterns

### 🛡️ Strategic Defense Initiative (SDI)
Comprehensive intelligence and crisis management system:
- **Intelligence Operations**: Real-time intelligence feed with advanced analysis tools
- **Crisis Management**: Event tracking with impact assessment and response protocols
- **Diplomatic Relations**: Bilateral relationship monitoring with historical context tracking
- **Economic Intelligence**: Advanced economic indicator tracking and trend analysis
- **Treaty Management**: International agreement compliance and monitoring systems
- **Secure Communications**: Diplomatic channels and encrypted correspondence

### 📊 Advanced Economic Modeling Engine
Sophisticated real-time economic simulation:
- **IxTime Synchronization**: Custom time flow (4x speed) with Discord bot integration
- **Tier-Based Growth System**: 7 economic tiers with sophisticated growth caps and 3.21% global factor
- **Population Scaling**: 8-tier population system affecting economic dynamics
- **Historical Projection**: Automated calculation of past and future economic trends
- **DM Input System**: Time-bound economic modifiers for special events and policies
- **Performance Monitoring**: Built-in calculation logging and optimization tracking

### 🌍 Country Management & Analytics
Comprehensive nation database and analysis tools:
- **Country Browser**: 180+ countries with advanced filtering, search, and comparison tools
- **Detailed Country Profiles**: Interactive economic data with sophisticated visualization
- **Comparative Analysis**: Multi-country economic metric comparisons and benchmarking
- **Flag Management**: Intelligent flag caching with MediaWiki integration and fallback systems
- **Historical Data Tracking**: Time-series analysis with projection capabilities
- **Economic Builder**: Interactive country creation with real-world data foundations

### 🎛️ Administrative & Management Systems
- **Admin Panel**: System configuration, user management, global settings, and system health
- **DM Dashboard**: Economic policy controls, special event creation, and time management
- **Data Import System**: Excel roster import with comprehensive validation and preview
- **Calculation Logging**: Performance monitoring, debugging tools, and system optimization
- **Unified Notification System**: Intelligent notification routing with context awareness

### 🎨 Advanced UI/UX Framework
- **Unified Design Framework**: Hierarchical glass physics system with contextual intelligence
- **MyCountry Design System**: Tab-specific color theming and sophisticated iconography
- **Responsive Architecture**: Mobile-first design with desktop enhancements
- **IxTime-Synchronized Animations**: Smooth transitions and real-time visual feedback

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

## 📊 Current Implementation Status (January 2025)

### 🎯 **Project Maturity: 65% Complete**
**Overall Grade: A-** - Exceptional architecture with strong foundational implementation

#### ✅ **Production Ready Systems (85-95%)**
- **Core Infrastructure**: Next.js 15, Prisma database, tRPC APIs, IxTime system
- **Economic Engine**: Advanced tier-based modeling, historical tracking, calculations  
- **Design Framework**: Glass physics system, 100+ UI components, responsive design
- **Live Data Integration**: Real tRPC data integration (Phase 1 complete)

#### 🔄 **Partially Implemented Systems (40-75%)**
- **Intelligence System**: Foundation complete, advanced features need integration (75%)
- **WebSocket Infrastructure**: Code exists but needs integration testing (40%)
- **Achievement System**: Components built but not fully activated (50%)
- **Diplomatic Features**: Advanced components exist but limited integration (30%)

#### ⏳ **Planning/Architecture Phase (10-30%)**
- **Real-time Notifications**: Backend services complete, UI integration needed (25%)
- **SDI/ECI Modules**: Comprehensive planning done, minimal implementation (15%)
- **AI/ML Analytics**: Architecture documented, no implementation (10%)
- **Mobile Optimization**: Responsive design exists, needs testing (30%)

#### 🚀 **Future Development (0-10%)**
- **VR/3D Visualizations**: Roadmap planning only (5%)
- **Multi-user Collaboration**: Architecture supports, features not built (5%)  
- **Advanced Crisis Simulation**: Framework documented, no implementation (10%)

> **📋 For realistic assessment vs documentation claims, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)**  
> **📋 For future planning, see [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md)**

## 🚀 Upcoming & Planned Features

### ✅ Recently Completed (January 2025)
#### Phase 1: Live Data Integration (Verified Complete)
- **Live Data Transformers**: ✅ Real tRPC API data replacing mock transformers
- **Intelligence Components**: ✅ Executive Command Center, National Performance, Intelligence Briefings using live data
- **Data Pipeline**: ✅ Database → tRPC → Live transformers → Intelligence components
- **TypeScript Foundation**: ✅ Comprehensive type safety with 20+ interfaces and defensive programming
- **Performance Optimization**: ✅ React.memo patterns and error boundaries implemented

### 🔄 Current Development (Immediate Priorities)
#### Phase 2: Integration & Real-Time Infrastructure
- **WebSocket Integration**: Activate existing diplomatic-websocket.ts code and test functionality
- **Achievement System**: Integrate existing AchievementConstellation.tsx into main application
- **Diplomatic Components**: Test and integrate existing diplomatic feed and social components
- **Notification Pipeline**: Connect advanced backend notification services to frontend UI
- **Git Integration**: Review, test, and commit untracked advanced feature components
- **Mobile Testing**: Verify intelligence system responsive design on actual devices

### 🎯 Phase 2: Advanced Features (Next 2-4 months)
#### Collaborative Management Systems
- **Multi-User Executive Teams**: Collaborative nation management with role delegation
- **Real-Time Diplomatic Negotiations**: Live treaty creation and bilateral agreement tools
- **Cross-Platform Integration**: Enhanced MediaWiki and Discord synchronization
- **Advanced Crisis Simulation**: Dynamic event generation with AI-driven scenario creation

#### Visualization & Interface Enhancements
- **WebGL-Based 3D Visualizations**: Interactive economic data representation
- **Progressive Web App**: Offline capability and mobile app-like experience
- **Natural Language Query Interface**: Voice and text-based data exploration
- **Enhanced Accessibility**: WCAG 2.1 AA compliance with screen reader optimization

### 🌟 Phase 3: Platform Evolution (6-12 months)
#### Intelligence & Automation
- **Machine Learning Economic Predictions**: AI-driven growth and trend forecasting
- **Automated Threat Detection**: Smart security monitoring with proactive alerts
- **Intelligent Resource Allocation**: AI-assisted budget optimization and policy recommendations
- **Cross-System Data Synchronization**: Real-time integration with external platforms

#### Advanced Economic Modeling
- **Resource-Based Growth Systems**: Natural resource impact on economic development
- **Climate & Environmental Factors**: Weather and environmental impact modeling
- **Trade Network Visualization**: Interactive global trade relationship mapping
- **Generational Economic Modeling**: Long-term demographic and economic planning

### 🔮 Long-term Vision (12+ months)
#### Next-Generation Features
- **Virtual Reality Dashboard**: Immersive 3D executive command center
- **Blockchain Integration**: Secure diplomatic agreements and economic transactions
- **Global Economic Simulation**: Multi-server synchronized world economy
- **AI Executive Assistant**: Personalized AI advisor with learning capabilities

#### Platform Expansion
- **API Marketplace**: Third-party integration and custom module support
- **Educational Mode**: Simplified interface for academic and learning environments
- **Historical Simulation**: Time-travel capabilities for alternative history scenarios
- **Community Marketplace**: User-generated content and scenario sharing

## 🎮 Advanced System Features

### Real-Time Economic Simulation
- **IxTime Synchronization**: Discord bot integration for coordinated time control across platforms
- **Dynamic Growth Modeling**: Tier-based economic growth with sophisticated global factor application
- **Historical Projection**: Automatic calculation of past trends and future economic forecasting
- **Performance Monitoring**: Built-in calculation logging, optimization tracking, and system health metrics

### Intelligence & Flag Services
- **Intelligent Flag Caching**: Bulk flag loading with advanced fallback mechanisms and MediaWiki integration
- **Smart Media Management**: Automated country data fetching with error handling and cache optimization
- **Visual Asset Pipeline**: Lightweight flag rendering with responsive image optimization
- **External API Integration**: Real-time country data synchronization from multiple sources

### Executive Analytics & Visualization
- **Activity Ring System**: Apple Health-inspired vitality monitoring with real-time metrics
- **Executive Modals**: Cabinet meetings, economic policies, and national security dashboards
- **Premium Analytics Suite**: Strategic planning tools, AI advisor integration, and predictive modeling
- **Focus Card Intelligence**: Government operations, foreign relations, and social development tracking

### Data Management & Processing
- **Excel Roster Import**: Comprehensive validation, preview systems, and data transformation
- **Robust Data Parser**: Advanced handling of economic, demographic, and diplomatic data
- **Real-Time Calculation Engine**: Economic projections with tier-based constraints and optimization
- **Historical Tracking**: Automated data point creation, trend analysis, and projection capabilities

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