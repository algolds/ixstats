# Countries Economy Component

## Overview

The Countries Economy Component is a comprehensive system for displaying, analyzing, and managing economic data for individual countries within the IxStats platform. This component is specifically designed for viewing and interacting with existing country economic profiles and is completely separate from the country creation/builder tools.

## Purpose

This component serves as the economic dashboard for countries that have already been created and populated in the system. It provides:

- **Economic Data Visualization**: Interactive charts and displays of key economic indicators
- **Comparative Analysis**: Tools to compare countries against each other
- **Historical Tracking**: View economic changes over time
- **DM Tools**: Special features for Dungeon Masters to modify economic parameters during campaigns
- **Economic Modeling**: Predictive modeling and scenario analysis

## Architecture

### Component Structure

```
src/app/countries/_components/economy/
├── README.md                           # This file
├── utils.ts                           # Utility functions for economic calculations
├── index.ts                           # Export barrel
├── EconomicDataDisplay.tsx            # Main container component
├── CoreEconomicIndicators.tsx         # Core economic metrics
├── LaborEmployment.tsx                # Employment and labor statistics
├── FiscalSystemComponent.tsx          # Government finances and taxation
├── IncomeWealthDistribution.tsx       # Income inequality and wealth distribution
├── GovernmentSpending.tsx             # Government budget allocation
├── Demographics.tsx                   # Population demographics
├── HistoricalEconomicTracker.tsx      # Historical data and trends
├── ComparativeAnalysis.tsx            # Country comparison tools
├── EconomicSummaryWidget.tsx          # Summary dashboard widget
├── CountryEconomicDataSection.tsx     # Section for country detail pages
└── EconomicModelingEngine.tsx         # Advanced economic modeling
```

### Data Flow

1. **Data Source**: Fetches economic data from the tRPC API (`api.countries.getByIdWithEconomicData`)
2. **Data Processing**: Converts raw database data into typed structures defined in `~/types/economics.ts`
3. **Component Rendering**: Distributes data to specialized sub-components
4. **User Interaction**: Handles editing, validation, and saving of economic parameters
5. **Real-time Updates**: Automatically refetches data when changes are made

## Key Features

### 1. Economic Data Display (`EconomicDataDisplay.tsx`)

The main container component that orchestrates all economic data display and interaction.

**Props:**
- `countryId`: Database ID of the country
- `countryName`: Display name of the country
- `isEditable`: Whether the data can be modified (typically for DMs)
- `mode`: Display mode (`"full"` | `"compact"` | `"overview"`)
- `showTabs`: Whether to show tabbed interface
- `defaultTab`: Which tab to show initially
- `onDataChange`: Callback when data is modified

**Features:**
- Tabbed interface for different economic aspects
- Edit mode for authorized users
- Automatic data validation
- Unsaved changes tracking
- Real-time data synchronization

### 2. Core Economic Indicators (`CoreEconomicIndicators.tsx`)

Displays fundamental economic metrics including GDP, population, growth rates, and inflation.

**Key Metrics:**
- Total Population
- Nominal GDP
- GDP per Capita
- Real GDP Growth Rate
- Inflation Rate
- Currency Exchange Rate

### 3. Labor & Employment (`LaborEmployment.tsx`)

Shows workforce statistics and employment data.

**Key Metrics:**
- Labor Force Participation Rate
- Employment/Unemployment Rates
- Total Workforce
- Average Work Hours
- Minimum Wage
- Average Annual Income

### 4. Fiscal System (`FiscalSystemComponent.tsx`)

Government financial data including taxation and debt.

**Key Metrics:**
- Tax Revenue as % of GDP
- Government Budget
- Debt Levels (Internal/External)
- Tax Rates by Category
- Budget Deficit/Surplus

### 5. Income & Wealth Distribution (`IncomeWealthDistribution.tsx`)

Economic inequality and social mobility metrics.

**Key Metrics:**
- Economic Classes Distribution
- Gini Coefficient
- Poverty Rate
- Social Mobility Index

### 6. Government Spending (`GovernmentSpending.tsx`)

Breakdown of government budget allocation.

**Key Features:**
- Spending by Category (Defense, Education, Healthcare, etc.)
- Per Capita Spending Analysis
- Budget Priority Rankings

### 7. Demographics (`Demographics.tsx`)

Population statistics and demographic breakdown.

**Key Features:**
- Age Distribution
- Urban/Rural Split
- Regional Population Distribution
- Education Levels
- Citizenship Status

## Advanced Features

### Historical Tracking (`HistoricalEconomicTracker.tsx`)

Tracks economic changes over time with features including:
- Time-series charts for key indicators
- Trend analysis
- Event correlation (linking economic changes to campaign events)
- Projection modeling

### Comparative Analysis (`ComparativeAnalysis.tsx`)

Tools for comparing countries including:
- Side-by-side metric comparison
- Economic tier analysis
- Regional comparison tools
- Trade relationship impact analysis

### Economic Modeling (`EconomicModelingEngine.tsx`)

Advanced economic simulation features:
- Scenario planning ("What if" analysis)
- Policy impact modeling
- Economic shock simulation
- Growth projection models

## Data Types

The component uses strongly-typed data structures defined in `~/types/economics.ts`:

- `EconomyData`: Top-level container for all economic data
- `CoreEconomicIndicatorsData`: Basic economic metrics
- `LaborEmploymentData`: Employment statistics
- `FiscalSystemData`: Government finances
- `IncomeWealthDistributionData`: Inequality metrics
- `GovernmentSpendingData`: Budget allocation
- `DemographicsData`: Population statistics

## Usage Examples

### Basic Display

```tsx
import { EconomicDataDisplay } from "~/app/countries/_components/economy";

// Read-only economic overview
<EconomicDataDisplay 
  countryId="123"
  countryName="Aethermoor"
  mode="overview"
/>
```

### Editable DM Interface

```tsx
// Full economic management interface for DMs
<EconomicDataDisplay 
  countryId="123"
  countryName="Aethermoor"
  isEditable={true}
  mode="full"
  defaultTab="core"
  onDataChange={handleEconomicUpdate}
/>
```

### Compact Widget

```tsx
// Compact display for dashboards
<EconomicDataDisplay 
  countryId="123"
  countryName="Aethermoor"
  mode="compact"
  showTabs={false}
/>
```

## Integration Points

### With Country Detail Pages

The component integrates seamlessly with country detail pages (`src/app/countries/[id]/page.tsx`) providing comprehensive economic information.

### With DM Dashboard

DMs can access enhanced editing capabilities through the DM dashboard, allowing real-time economic adjustments during campaigns.

### With Comparative Tools

The component works with comparative analysis tools to enable cross-country economic analysis.

## Data Validation

The component includes comprehensive data validation:

- **Real-time Validation**: Checks data validity as users type
- **Business Rule Validation**: Ensures economic relationships make sense
- **Range Validation**: Prevents unrealistic values
- **Consistency Checks**: Ensures related metrics align properly

## Performance Considerations

- **Lazy Loading**: Charts and complex visualizations load on demand
- **Data Caching**: Economic data is cached to reduce API calls
- **Optimistic Updates**: UI updates immediately while saving in background
- **Error Boundaries**: Graceful handling of data loading failures

## Accessibility

- Full keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Semantic HTML structure

## Dependencies

### External Libraries
- `recharts`: For data visualization
- `lucide-react`: For icons
- `@trpc/react`: For API communication

### Internal Dependencies
- `~/components/ui/*`: Shared UI components
- `~/types/economics.ts`: Type definitions
- `~/lib/chart-utils`: Chart formatting utilities
- `~/trpc/react`: tRPC client

## Separation from Builder Tools

**Important**: This component is completely independent of the country builder tools located in `src/app/builder/`. It does not import any builder-specific functionality and uses its own utility functions and data processing logic. This ensures that:

1. Countries can be viewed and analyzed without the builder tools
2. The component focuses purely on display and analysis, not creation
3. DM editing capabilities are separate from the initial country creation process
4. The codebase remains modular and maintainable

## Future Enhancements

- **Real-time Multiplayer**: Multiple DMs editing simultaneously
- **Advanced Analytics**: Machine learning-based economic predictions
- **Export Tools**: PDF and Excel export capabilities
- **Mobile Optimization**: Enhanced mobile interface
- **Plugin System**: Extensible architecture for custom economic models 