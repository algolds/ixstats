# Create a Country Builder

## Overview

The Create a Country Builder is a comprehensive tool for creating custom nations for tabletop RPG campaigns. It allows users to build detailed economic frameworks using real-world country data as foundations, then customize every aspect to create unique fictional countries with realistic economic systems.

## Purpose

This tool is specifically designed for:

- **Campaign Creators**: DMs and GMs who want to create detailed nations for their campaigns
- **World Builders**: Anyone creating detailed fictional worlds with realistic economies
- **Educational Use**: Teaching economic concepts through interactive nation building
- **Simulation**: Creating countries for economic modeling and simulation

## Key Features

### 🌍 Real-World Foundation
- Start with data from 180+ real countries
- Use actual GDP, population, and economic data as baselines
- Understand economic tiers and classifications

### 🎛️ Complete Customization
- **Core Economic Indicators**: GDP, population, growth rates, inflation
- **Labor Markets**: Employment rates, wages, workforce demographics
- **Fiscal Systems**: Taxation, government spending, debt management
- **Income Distribution**: Economic classes, inequality metrics, social mobility
- **Demographics**: Population breakdown, age distribution, urbanization
- **Government Spending**: Budget allocation across sectors

### 📊 Real-Time Analysis
- Economic health scoring
- Cross-country comparisons
- Tier classification (Developing → Emerging → Developed → Advanced)
- Budget balance analysis
- Economic sustainability metrics

### 🔍 Interactive Preview
- Comprehensive country preview before finalization
- Comparison with similar real-world countries
- Economic analysis and recommendations
- Validation and error checking

## How It Works

### Phase 1: Choose Foundation Country
1. Browse 180+ real countries by economic tier
2. Filter by region, population, or economic characteristics
3. View key metrics and economic tier for each country
4. Select a country to use as your starting foundation

### Phase 2: Customize Your Country
Navigate through six comprehensive sections:

#### Core Economic Indicators
- Set population and GDP targets
- Configure growth and inflation rates
- Determine currency exchange rates
- Auto-calculating relationships between metrics

#### Labor & Employment
- Define unemployment and participation rates
- Set minimum wage and average incomes
- Configure work week hours
- Calculate total workforce

#### Fiscal System
- Design tax structure (income, corporate, sales, property, etc.)
- Set government revenue targets
- Configure debt levels (internal and external)
- Manage budget allocation

#### Income & Wealth Distribution
- Define economic classes and wealth distribution
- Set poverty rates and inequality metrics
- Configure social mobility indices
- Balance population across economic strata

#### Government Spending
- Allocate budget across sectors (Defense, Education, Healthcare, etc.)
- Set spending priorities
- Calculate per-capita spending
- Analyze budget efficiency

#### Demographics
- Configure age distribution and life expectancy
- Set urban/rural population split
- Define regional population distribution
- Configure education levels and literacy rates

### Phase 3: Preview & Finalize
- Review complete economic profile
- Compare with similar real-world countries
- Analyze economic health and sustainability
- Finalize and save your custom country

## Technical Architecture

### Component Structure
```
src/app/builder/
├── page.tsx                           # Main builder page
├── components/
│   ├── CountrySelector.tsx            # Country selection interface
│   ├── EconomicInputForm.tsx          # Main customization form
│   ├── EconomicPreview.tsx            # Final preview and confirmation
│   ├── CoreEconomicIndicators.tsx     # Core metrics configuration
│   ├── LaborEmployment.tsx            # Labor market settings
│   ├── FiscalSystem.tsx               # Government finances
│   ├── IncomeWealthDistribution.tsx   # Inequality and classes
│   ├── GovernmentSpending.tsx         # Budget allocation
│   └── Demographics.tsx               # Population demographics
└── lib/
    └── economy-data-service.ts        # Data processing and utilities
```

### Data Flow
1. **Country Selection**: Load real-world economic data from API
2. **Foundation Creation**: Generate default economic inputs based on selected country
3. **Customization**: User modifies economic parameters with real-time validation
4. **Preview**: Generate comprehensive analysis and comparisons
5. **Finalization**: Save completed country to storage/database

### Key Technologies
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Full type safety for complex economic data structures
- **Recharts**: Interactive data visualization
- **Real-time Validation**: Immediate feedback on economic relationships
- **Local Storage**: Persistent draft saving

## Economic Data Sources

The tool uses comprehensive real-world economic data including:

- **World Bank Data**: GDP, population, economic indicators
- **IMF Statistics**: Fiscal data, debt levels, economic classifications
- **OECD Data**: Advanced economy metrics
- **Regional Development Banks**: Emerging market data

Data is processed and normalized to ensure consistency and comparability across all countries.

## Validation & Business Rules

### Automatic Calculations
- GDP per capita automatically calculated from total GDP and population
- Tax revenue calculated as percentage of GDP
- Labor force derived from population and participation rates
- Budget calculations ensure mathematical consistency

### Validation Rules
- **Population**: Must be > 0
- **GDP**: Must be > 0
- **Unemployment**: 0-100%
- **Tax Rates**: Reasonable ranges for each tax type
- **Debt Levels**: Warnings for unsustainable levels
- **Economic Relationships**: Ensures metrics align logically

### Business Logic
- Economic tier classification based on GDP per capita
- Health scoring based on multiple economic factors
- Budget balance calculations and warnings
- Economic sustainability analysis

## Usage Examples

### Creating a Fantasy Kingdom
```typescript
// Start with medieval-economy equivalent (low GDP per capita)
// Base: Chad or Afghanistan (developing economy)
// Customize:
// - Lower tech level reduces GDP per capita
// - Agricultural focus affects employment distribution
// - Feudal system impacts income distribution
// - Lower literacy rates
```

### Sci-Fi Advanced Civilization
```typescript
// Start with advanced economy (high GDP per capita)
// Base: Luxembourg or Switzerland
// Customize:
// - Higher automation reduces unemployment
// - Advanced tech increases productivity
// - Post-scarcity affects wealth distribution
// - Higher education levels
```

### Post-Apocalyptic Settlement
```typescript
// Start with crisis economy
// Base: Venezuela or war-torn country
// Customize:
// - Resource scarcity increases inequality
// - Survival economy reduces GDP
// - Population loss from catastrophe
// - Barter systems affect currency
```

## Integration with Campaign Tools

### Export Options
- **JSON Export**: Full economic data for other tools
- **PDF Summary**: Printable country profile
- **Campaign Integration**: Direct import to DM dashboard

### Compatibility
- Works with existing country management systems
- Compatible with economic tracking tools
- Integrates with campaign timeline systems

## Advanced Features

### Economic Modeling
- Scenario analysis ("What if" simulations)
- Growth projection models
- Policy impact assessment
- Economic shock simulation

### Comparative Analysis
- Side-by-side country comparison
- Economic tier benchmarking
- Regional analysis tools
- Trade relationship modeling

### Historical Context
- Economic development trajectories
- Real-world economic parallels
- Historical economic event simulation

## Best Practices

### Starting Your Country
1. **Choose Appropriate Foundation**: Select a real country with similar characteristics to your desired nation
2. **Start Conservative**: Begin with realistic values, then adjust gradually
3. **Maintain Relationships**: Ensure economic metrics support each other logically
4. **Consider Geography**: Population distribution should match terrain and resources

### Economic Design
1. **Population First**: Set population based on available land and resources
2. **GDP Alignment**: Ensure GDP per capita matches intended development level
3. **Employment Logic**: Unemployment should reflect economic conditions
4. **Fiscal Balance**: Government revenue should support intended spending

### Validation Tips
1. **Green Health Score**: Aim for economic health score above 70
2. **Balanced Budget**: Keep deficit under 5% of GDP for sustainability
3. **Reasonable Inequality**: Gini coefficient between 0.25-0.45 for stability
4. **Logical Demographics**: Age distribution should support labor force

## Troubleshooting

### Common Issues

**High Unemployment + High GDP**: Indicates automation or resource curse
**Low Tax Revenue + High Spending**: Unsustainable fiscal policy
**High Inequality + High Social Mobility**: Contradictory social conditions
**Low Population + High GDP**: Either city-state or resource-rich economy

### Performance Tips
- Save drafts frequently using browser storage
- Use validation warnings to improve economic realism
- Preview regularly to catch issues early
- Start with template then customize incrementally

## Future Enhancements

- **AI Assistance**: Smart suggestions for economic parameters
- **Template Library**: Pre-built country archetypes
- **Advanced Modeling**: Multi-generational economic simulation
- **Collaborative Editing**: Team-based country building
- **Integration APIs**: Connect with other worldbuilding tools

## Support and Documentation

For additional help:
- **In-App Help**: Hover tooltips and contextual guidance
- **Validation Messages**: Real-time feedback on economic parameters
- **Comparison Tools**: Learn from real-world examples
- **Community Examples**: Shared country templates and examples 