# IxStats - Interactive Economic Statistics Platform

A comprehensive web application for managing, analyzing, and visualizing economic data for fictional nations and real-world countries. Built for tabletop RPG campaigns, world-building, and economic simulation.

## 🌟 Features

### 📊 **Dashboard & Analytics**
- **Global Statistics Overview**: Real-time population, GDP, and economic metrics
- **Interactive Charts**: Population density, GDP density, and economic tier distributions
- **Country Leaderboards**: Top performers across various economic indicators
- **Activity Feed**: Live updates on economic milestones and tier changes
- **Tier Visualizations**: Economic and population tier breakdowns

### 🌍 **Country Management**
- **Browse Countries**: Search, filter, and sort 180+ countries by various criteria
- **Detailed Country Pages**: Comprehensive economic profiles with historical data
- **Economic Data Display**: Core indicators, labor markets, fiscal systems, demographics
- **Comparative Analysis**: Compare countries across multiple economic metrics
- **Historical Tracking**: View economic changes over time with interactive charts

### 🏗️ **Country Builder**
- **Real-World Foundation**: Start with data from 180+ real countries
- **Complete Customization**: Modify every economic aspect of your nation
- **Economic Health Scoring**: Real-time analysis and recommendations
- **Interactive Preview**: Comprehensive country preview before finalization
- **Validation System**: Error checking and economic sustainability metrics

### 🎮 **DM Controls**
- **Economic Modifiers**: Adjust population, GDP, and growth rates
- **Special Events**: Natural disasters, trade agreements, economic policies
- **Time-Based Effects**: Duration-based modifications with automatic expiration
- **Global vs Local**: Apply changes to specific countries or globally
- **Quick Actions**: Preset modifications for common scenarios

### ⚙️ **Admin Panel**
- **System Configuration**: Global growth factors, time multipliers, auto-updates
- **Bot Integration**: Discord bot synchronization for time management
- **Data Import**: Excel roster import with validation and preview
- **Time Control**: Custom time settings and IxTime management
- **Calculation Logs**: Track system performance and updates

### 🕐 **IxTime System**
- **Custom Time Flow**: Configurable time multipliers (0x to 10x speed)
- **Discord Bot Sync**: Real-time synchronization with Discord bot
- **Historical Projections**: Forecast economic changes over time
- **Time-Based Calculations**: Automatic updates based on elapsed time

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- PostgreSQL database (for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ixstats
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
src/
├── app/                          # Next.js app directory
│   ├── _components/              # Shared components
│   │   ├── ActivityFeed.tsx      # Live activity updates
│   │   ├── CommandCenter.tsx     # Main dashboard layout
│   │   ├── FeaturedArticle.tsx   # Wiki article integration
│   │   ├── GlobalStatsOverview.tsx # Global statistics display
│   │   ├── LeaderboardsSection.tsx # Country rankings
│   │   ├── LiveGameBanner.tsx    # Time and status banner
│   │   ├── TierVisualization.tsx # Economic tier charts
│   │   └── navigation.tsx        # Main navigation
│   ├── admin/                    # Admin panel
│   │   ├── _components/          # Admin-specific components
│   │   └── page.tsx              # Admin dashboard
│   ├── builder/                  # Country creation tool
│   │   ├── components/           # Builder components
│   │   └── page.tsx              # Builder interface
│   ├── countries/                # Country management
│   │   ├── _components/          # Country components
│   │   ├── [id]/                 # Individual country pages
│   │   └── page.tsx              # Countries listing
│   ├── dashboard/                # Main dashboard
│   │   ├── _components/          # Dashboard components
│   │   └── page.tsx              # Dashboard interface
│   └── dm-dashboard/             # DM controls
│       └── page.tsx              # DM interface
├── components/                   # UI components
│   └── ui/                       # Shadcn/ui components
├── lib/                          # Utility libraries
│   ├── calculations.ts           # Economic calculations
│   ├── chart-utils.ts            # Chart formatting utilities
│   ├── config-service.ts         # Configuration management
│   ├── data-parser.ts            # Excel data parsing
│   ├── ixtime.ts                 # Time management system
│   └── mediawiki-service.ts      # Wiki integration
├── server/                       # Backend API
│   ├── api/                      # tRPC API routes
│   └── db/                       # Database schema
├── types/                        # TypeScript type definitions
└── trpc/                         # tRPC configuration
```

## 🎯 Core Systems

### Economic Calculation Engine
- **Tier-Based Growth**: Economic tiers with different growth rate caps
- **Population Dynamics**: Realistic population growth modeling
- **GDP Calculations**: Per-capita and total GDP projections
- **Density Metrics**: Population and GDP density calculations
- **Historical Tracking**: Time-series data for analysis

### Time Management (IxTime)
- **Custom Time Flow**: Configurable time multipliers
- **Discord Bot Integration**: Real-time synchronization
- **Historical Projections**: Future economic forecasting
- **Time-Based Events**: Automatic calculation updates

### Data Import System
- **Excel Support**: Import country rosters from Excel files
- **Validation**: Data validation and error checking
- **Preview System**: Review changes before import
- **Batch Processing**: Handle large datasets efficiently

### Wiki Integration
- **MediaWiki API**: Fetch country information and flags
- **Infobox Parsing**: Extract structured data from wiki pages
- **Template Processing**: Handle complex wiki templates
- **Caching System**: Optimize API calls and performance

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run preview          # Preview production build

# Database
npm run db:setup         # Set up database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
npm run db:backup        # Backup database
npm run db:restore       # Restore database

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run typecheck        # TypeScript type checking
npm run format:check     # Check code formatting
npm run format:write     # Format code

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode tests
npm run test:coverage    # Test coverage

# Utilities
npm run clean            # Clean build artifacts
npm run fresh            # Fresh install and setup
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Authentication (if using Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# MediaWiki Integration
MEDIAWIKI_API_URL="https://ixwiki.com/api.php"
MEDIAWIKI_BASE_URL="https://ixwiki.com"

# Discord Bot Integration
DISCORD_BOT_API_URL="http://localhost:3001"
```

## 📊 Economic Tiers

### Economic Tiers (GDP per Capita)
- **Impoverished**: $0-$9,999 (10% max growth)
- **Developing**: $10,000-$24,999 (7.50% max growth)
- **Developed**: $25,000-$34,999 (5% max growth)
- **Healthy**: $35,000-$44,999 (3.50% max growth)
- **Strong**: $45,000-$54,999 (2.75% max growth)
- **Very Strong**: $55,000-$64,999 (1.50% max growth)
- **Extravagant**: $65,000+ (0.50% max growth)

### Population Tiers
- **Tier 1**: 0-9,999,999
- **Tier 2**: 10,000,000-29,999,999
- **Tier 3**: 30,000,000-49,999,999
- **Tier 4**: 50,000,000-79,999,999
- **Tier 5**: 80,000,000-119,999,999
- **Tier 6**: 120,000,000-349,999,999
- **Tier 7**: 350,000,000-499,999,999
- **Tier X**: 500,000,000+

## 🔧 Configuration

### System Configuration
- **Global Growth Factor**: Adjust overall economic growth (0.5x to 2.0x)
- **Time Multiplier**: Control time flow speed (0x to 10x)
- **Auto Updates**: Enable automatic calculations
- **Bot Sync**: Discord bot time synchronization

### Economic Settings
- **Base Inflation Rate**: Default inflation for calculations
- **Tier Growth Modifiers**: Custom growth rates per tier
- **Calculation Intervals**: Frequency of automatic updates

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Docker Deployment
```bash
docker build -t ixstats .
docker run -p 3000:3000 ixstats
```

### Environment Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Import initial country data
5. Configure Discord bot integration (optional)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in `/docs`
- Review existing issues on GitHub
- Create a new issue for bugs or feature requests

## 🔗 Related Projects

- **IxWiki**: MediaWiki integration for country information
- **Discord Bot**: Time synchronization and server management
- **IxMaps**: Interactive mapping system for countries

---

**IxStats** - Empowering world-builders and game masters with comprehensive economic simulation tools.
