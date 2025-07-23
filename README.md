# IxStats - Economic Statistics Platform

A comprehensive web application for managing, analyzing, and visualizing economic data for fictional nations and real-world countries. Built for tabletop RPG campaigns, world-building, and economic simulation.

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
   - Runs on port 3002 (port 3000 is used by time bot)
   - Access at: http://localhost:3003/

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
npm run dev              # Start development server (port 3002)
npm run dev:simple       # Start without validation checks
npm run dev:auth         # Start with Clerk authentication emphasis
npm run dev:db           # Setup database and start development
```

### Production
```bash
npm run build            # Build for production
npm run start:prod       # Start production server (port 3550)
npm run deploy:prod      # Build and start production server
npm run preview          # Build and preview locally
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
npm run db:seed          # Seed database with sample data
npm run db:backup        # Backup database
npm run db:restore       # Restore database from backup
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
npm run clean:all        # Clean everything (including node_modules)
npm run fresh            # Fresh install and setup
npm run validate:servers # Validate server configurations
```

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: SQLite (development) / PostgreSQL (production) with Prisma ORM
- **API**: tRPC for type-safe API layer
- **Authentication**: Clerk (optional)
- **UI**: Tailwind CSS with Radix UI components
- **Time System**: Custom IxTime for game world simulation
- **Charts**: Recharts for data visualization

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

## 🎯 Core Features

### Dashboard & Analytics
- Global statistics overview with real-time metrics
- Interactive charts for population and GDP analysis
- Country leaderboards and tier classifications
- Activity feed with live economic milestone updates

### Country Management
- Browse and search 180+ countries with advanced filtering
- Detailed country pages with comprehensive economic profiles
- Historical data tracking with interactive charts
- Comparative analysis across multiple economic metrics

### Economic Modeling
- **IxTime System**: Custom time flow with configurable multipliers (0x to 10x)
- **Tier-Based Growth**: 7 economic tiers with different growth rate caps
- **Real-time Calculations**: Automatic updates based on elapsed time
- **DM Controls**: Economic modifiers for special events and policies

### Data Management
- Excel roster import with validation and preview
- MediaWiki integration for country information and flags
- Historical data projection and forecasting
- Automated calculation logging and performance tracking

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
NEXT_PUBLIC_MEDIAWIKI_URL="https://ixwiki.com/"
IXTIME_BOT_URL="http://localhost:3001"
DISCORD_BOT_TOKEN="..."
DISCORD_CLIENT_ID="..."
DISCORD_GUILD_ID="..."
```

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

### Development (Port 3002)
- **URL**: http://localhost:3003/
- **Base Path**: `/` (root)
- **Database**: `dev.db`
- **Hot Reload**: Enabled with Turbopack
- **Authentication**: Clerk test keys or demo mode

### Production (Port 3550)
- **URL**: http://localhost:3550/projects/ixstats
- **Base Path**: `/projects/ixstats`
- **Database**: `prisma/prod.db`
- **Authentication**: Clerk production keys or disabled
- **Reverse Proxy**: Required for external access

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
- **Problem**: Port 3000 already in use (time bot)
- **Solution**: Development server uses port 3002 automatically

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
# Development server (port 3002)
netstat -tlnp | grep :3003

# Production server (port 3550)
netstat -tlnp | grep :3550

# Time bot (port 3000)
netstat -tlnp | grep :3000
```

#### Stop Servers
```bash
# Stop development server
kill $(lsof -ti:3003)

# Stop production server
kill $(lsof -ti:3550)
```

#### Background Server
```bash
# Start production server in background
nohup npm run start:prod > server.log 2>&1 &

# View logs
tail -f server.log
```

## 🎮 System Features

### Admin Panel
- System configuration and global growth factors
- User management and role assignments
- Data import with Excel file validation
- Calculation logs and performance monitoring

### DM Dashboard
- Economic policy modifications with duration
- Special event creation (disasters, trade agreements)
- Population and GDP adjustments
- Time-based effect management

### Country Builder
- Start with real-world country data
- Complete economic profile customization
- Real-time validation and sustainability metrics
- Economic health scoring and recommendations

### Strategic Defense Initiative (SDI)
- Intelligence feed management
- Crisis event tracking
- Diplomatic relation monitoring
- Economic indicator analysis

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