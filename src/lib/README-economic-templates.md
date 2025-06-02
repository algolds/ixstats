# Economic Data Templates

This module provides standardized default economic data templates for countries in the IxStats application. Instead of hardcoding dummy data throughout the application, this system generates realistic economic data based on a country's basic profile.

## Purpose

- **Consistency**: All economic data follows realistic patterns based on economic tier and country characteristics
- **Maintainability**: Easy to update economic assumptions in one place
- **Flexibility**: Simple to replace template data with live data as it becomes available
- **Realism**: Data correlates appropriately with economic development levels

## Usage

### Basic Usage

```typescript
import { generateCountryEconomicData, type CountryProfile } from "~/lib/economic-data-templates";

// Create a country profile
const profile: CountryProfile = {
  population: 50_000_000,
  gdpPerCapita: 45_000,
  totalGdp: 2_250_000_000_000,
  economicTier: "Developed",
  landArea: 500_000,
  continent: "North America",
  region: "Northern America"
};

// Generate all economic data
const economicData = generateCountryEconomicData(profile);

// Now you have:
// - economicData.core (GDP, population, inflation, etc.)
// - economicData.labor (employment, wages, workforce)
// - economicData.fiscal (taxes, debt, government revenue)
// - economicData.income (wealth distribution, inequality)
// - economicData.spending (government spending by category)
// - economicData.demographics (age, education, urban/rural)
```

### Individual Components

You can also generate specific economic data components:

```typescript
import { 
  generateCoreEconomicIndicators,
  generateLaborEmploymentData,
  generateFiscalSystemData 
} from "~/lib/economic-data-templates";

const coreData = generateCoreEconomicIndicators(profile);
const laborData = generateLaborEmploymentData(profile);
const fiscalData = generateFiscalSystemData(profile);
```

## Economic Tiers

The system recognizes these economic tiers and adjusts data accordingly:

- **Extravagant**: Ultra-high development (e.g., Monaco, Luxembourg)
- **Very Strong**: Very high development (e.g., Switzerland, Norway)
- **Strong**: High development (e.g., Germany, Japan)
- **Healthy**: Upper-middle development (e.g., Poland, Chile)
- **Developed**: Middle development (e.g., Turkey, Mexico)
- **Emerging**: Lower-middle development (e.g., India, Brazil)
- **Developing**: Low development (e.g., Bangladesh, Nigeria)

## Data Correlations

The template system creates realistic correlations:

- **Economic Tier** influences tax rates, unemployment, inflation, and social indicators
- **GDP per Capita** affects wages, income distribution, and living standards
- **Population** scales workforce and regional distribution
- **Land Area** affects population density calculations

## Replacing with Live Data

When live data becomes available, you can easily override template values:

```typescript
// Generate template data
const economicData = generateCountryEconomicData(profile);

// Override with live data
if (country.realGDPGrowthRate !== undefined) {
  economicData.core.realGDPGrowthRate = country.realGDPGrowthRate;
}
if (country.unemploymentRate !== undefined) {
  economicData.labor.unemploymentRate = country.unemploymentRate;
}

// Template data provides realistic fallbacks for missing values
```

## Key Features

### Realistic Defaults
- Growth rates appropriate for economic development level
- Tax structures that reflect government capacity
- Income distributions based on Gini coefficients
- Demographics that correlate with development

### Easy Customization
- All calculations based on helper functions
- Economic assumptions centralized and adjustable
- Clear mapping between economic tiers and values

### Type Safety
- Full TypeScript support
- Matches existing `~/types/economics` interfaces
- Compile-time validation of data structures

## Examples

### Developed Country (Germany-like)
```typescript
const profile = {
  population: 83_000_000,
  gdpPerCapita: 48_000,
  totalGdp: 4_000_000_000_000,
  economicTier: "Strong"
};
// Results in: 5% unemployment, 21% tax revenue, moderate inequality
```

### Emerging Market (Brazil-like)
```typescript
const profile = {
  population: 215_000_000,
  gdpPerCapita: 15_000,
  totalGdp: 3_200_000_000_000,
  economicTier: "Emerging"
};
// Results in: 8% unemployment, 17% tax revenue, higher inequality
```

### Small Wealthy Nation (Luxembourg-like)
```typescript
const profile = {
  population: 630_000,
  gdpPerCapita: 115_000,
  totalGdp: 72_000_000_000,
  economicTier: "Extravagant"
};
// Results in: 3% unemployment, 25% tax revenue, low inequality
```

## Future Enhancements

When integrating live data:

1. **Add data source flags** to track which values are live vs. template
2. **Implement data validation** to ensure live data is reasonable
3. **Create data quality metrics** to measure template vs. live data coverage
4. **Add historical data support** for tracking changes over time

## Contributing

When updating economic assumptions:

1. Modify the helper functions (e.g., `getUnemploymentRate()`)
2. Ensure changes are realistic and well-documented
3. Test with various economic tiers and country sizes
4. Update this README if adding new features

The goal is to maintain realistic, consistent economic data that can seamlessly transition from template to live data as the application evolves. 