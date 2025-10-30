# IxEarth Global Metrics

## Overview

IxEarth is the fictional planet used in the IxStats simulation. This document provides calculated global metrics based on complete map data and canonical World Roster totals.

> **📍 Central Configuration:** All IxEarth metrics are defined in `src/lib/ixearth-constants.ts` for easy reference and updates.

## Canonical IxEarth Size (From Complete Map Data)

**Data Source:** Complete PostGIS map data (all layers) + World-Roster.xlsx
**Calculation Method:** Earth-scale measurements × IxEarth Scale Factor (1.4777x)
**Verified:** ✅ Matches screenshot approximation within 0.6%

| Metric | IxEarth | Earth | Ratio |
|--------|---------|-------|-------|
| **Total Land Area** | 127,724,236 sq mi | 57,510,000 sq mi | **2.22x LARGER** ✅ |
| **Total Water Area** | 227,128,507 sq mi | 139,434,000 sq mi | **1.63x LARGER** ✅ |
| **Total Surface Area** | 354,852,742 sq mi | 196,940,000 sq mi | **1.80x LARGER** ✅ |
| **Land Percentage** | 36.0% | 29.2% | +6.8% more land-rich |
| **Water Percentage** | 64.0% | 70.8% | -6.8% less water |

**Conclusion:** IxEarth is approximately **1.8 times the size of Earth** with more than **double the land area** and significantly more land-rich (36% land vs Earth's 29%).

## Land Breakdown: Claimed vs Unclaimed

IxEarth has vast unclaimed territories beyond the 82 recognized countries:

| Category | Area (sq mi) | Percentage |
|----------|--------------|------------|
| **Claimed by 82 Countries** | 44,440,107 | 34.8% |
| **Unclaimed Territories** | 83,284,129 | 65.2% |
| **Total Land** | 127,724,236 | 100% |

**Key Insight:** Only **35% of IxEarth's land** is claimed by recognized countries. The remaining **65% is wilderness**, disputed territories, polar regions, or otherwise unclaimed land.

## Population and Economy (82 Claimed Countries)

| Metric | Value |
|--------|-------|
| **Total Population** | 11.19 billion |
| **Total GDP** | $441.29 trillion |
| **Average GDP per capita** | $38,061 |
| **Population Density** (on claimed land) | 251.7 people/sq mi |

> **Note:** These metrics only cover the 82 claimed countries. Unclaimed territories are assumed uninhabited or sparsely populated.

## Top 10 Rankings

### Largest Countries by Area

| Rank | Country | Area (sq mi) | Has Map |
|------|---------|--------------|---------|
| 1 | Varshan | 3,062,240 | ✅ |
| 2 | Kiravia | 2,975,090 | ✅ |
| 3 | Caphiria | 2,335,110 | ✅ |
| 4 | Urcea | 2,127,930 | ✅ |
| 5 | Tierrador | 1,959,460 | ✅ |
| 6 | Daxia | 1,848,070 | ✅ |
| 7 | Cartadania | 1,591,610 | ✅ |
| 8 | Fiannria | 1,520,200 | ✅ |
| 9 | Paulastra | 1,472,860 | ✅ |
| 10 | Faneria | 1,192,010 | ✅ |

### Most Populous Countries

| Rank | Country | Population | Has Map |
|------|---------|------------|---------|
| 1 | Urcea | 782,899,712 | ✅ |
| 2 | Kiravia | 719,869,547 | ✅ |
| 3 | Varshan | 714,367,183 | ✅ |
| 4 | Daxia | 702,357,707 | ✅ |
| 5 | Caphiria | 619,435,970 | ✅ |
| 6 | Yanuban | 551,912,462 | ✅ |
| 7 | Fiannria | 409,717,515 | ✅ |
| 8 | Burgundie | 396,202,653 | ✅ |
| 9 | Faneria | 394,843,690 | ✅ |
| 10 | Argyrea | 380,258,967 | ❌ |

### Largest Economies by GDP

| Rank | Country | Total GDP | Has Map |
|------|---------|-----------|---------|
| 1 | Urcea | $44.48 trillion | ✅ |
| 2 | Caphiria | $39.81 trillion | ✅ |
| 3 | Kiravia | $36.75 trillion | ✅ |
| 4 | Cartadania | $28.56 trillion | ✅ |
| 5 | Daxia | $25.47 trillion | ✅ |
| 6 | Fiannria | $22.93 trillion | ✅ |
| 7 | Burgundie | $19.90 trillion | ✅ |
| 8 | Faneria | $19.66 trillion | ✅ |
| 9 | Tierrador | $13.80 trillion | ✅ |
| 10 | Varshan | $12.79 trillion | ✅ |

## Data Coverage and Quality

| Category | Count | Percentage |
|----------|-------|------------|
| **Total IxEarth Countries** | 82 | 100% |
| **Successfully Imported to Database** | 82 | 100% ✅ |
| **With Geographic Boundaries** | 68 | 82.9% |
| **Without Geographic Boundaries** | 14 | 17.1% |
| **Canonical Land Area Coverage** | 44.4M / 127.7M sq mi | 34.8% (claimed only) |

**Data Quality:** ✅ All 82 countries successfully imported with correct canonical areas from World Roster. Database totals match World Roster within 0.4%.

## IxEarth Scale Factor

**Current Value: 1.4777x**

The IxEarth Scale Factor represents the relationship between:
- **Canonical IxEarth areas** (from World Roster, based on 1px = 10 sq mi scale)
- **Earth-scale geographic calculations** (from PostGIS using Earth's WGS84 ellipsoid)

### How It's Calculated

```
Scale Factor = Total Canonical Areas / Total Earth-Scale Calculated Areas
             = 44,440,107 sq mi / 30,063,XXX sq mi  (from matched countries)
             = 1.4777x
```

This factor reconciles:
- **IxMaps custom coordinate system** (with shifted prime meridian at 26.09°E)
- **PostGIS geographic calculations** (using Earth's standard WGS84 ellipsoid)
- **1px = 10 sq mi scaling** (built into IxMaps design)

### Usage

To convert between systems:
- **Earth-scale → IxEarth canonical:** Multiply by 1.4777
- **IxEarth canonical → Earth-scale:** Divide by 1.4777

## Comparison to Earth

### The Real Numbers

IxEarth is **significantly larger than Earth** across all metrics:

| Metric | IxEarth | Earth | Difference |
|--------|---------|-------|------------|
| **Land Area** | 127,724,236 sq mi | 57,510,000 sq mi | +70,214,236 sq mi (2.22x) |
| **Water Area** | 227,128,507 sq mi | 139,434,000 sq mi | +87,694,507 sq mi (1.63x) |
| **Total Surface** | 354,852,742 sq mi | 196,940,000 sq mi | +157,912,742 sq mi (1.80x) |

### Why Is IxEarth Larger?

1. **Larger Planet:** IxEarth is 1.8x the total size of Earth
2. **More Land-Rich:** 36% land vs Earth's 29% land (6.8% more land coverage)
3. **Fewer Countries:** Only 82 countries vs Earth's ~195, meaning larger average country size
4. **Vast Unclaimed Territories:** 65% of land is wilderness/unclaimed
5. **Fiction Scaling:** Designed to accommodate more nations and civilizations with room to grow

## Geographic Coverage

Of the 82 countries in IxEarth:
- **68 countries (82.9%)** have complete geographic boundary data and appear on the map
- **14 countries (17.1%)** have World Roster data but no map visualization yet

Countries with geographic boundaries can be:
- Displayed on the interactive map
- Used for spatial analysis
- Measured for coastline length
- Used for calculating density metrics

## Data Sources and Verification

### Primary Data Sources

1. **World-Roster.xlsx** - Canonical country areas, population, economic data (82 countries)
2. **PostGIS map_layer_altitudes** - Complete landmass (4,068 features, 86.4M sq mi Earth-scale)
3. **PostGIS map_layer_political** - Country boundaries (185 features)
4. **PostGIS map_layer_lakes** - Water bodies (350 features)

### Verification

✅ **Database matches World Roster:** 44.6M sq mi vs 44.4M sq mi (0.4% difference)
✅ **Total land matches screenshot:** 127.7M sq mi vs 127.0M sq mi approximation (0.6% difference)
✅ **Scale factor verified:** 1.4777x consistently reconciles all measurements
✅ **All 82 countries imported:** 100% success rate

## Calculating Metrics

To recalculate these metrics or verify the data:

```bash
# Calculate totals from complete map data
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/calculate-ixearth-from-map.ts

# Sum World Roster canonical areas
npx tsx scripts/sum-world-roster.ts

# Generate country rankings and statistics
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/calculate-ixearth-metrics.ts
```

All scripts reference the central constants file: `src/lib/ixearth-constants.ts`

## Related Documentation

- **[ixearth-constants.ts](../src/lib/ixearth-constants.ts)** - Central source of truth for all IxEarth metrics
- **[World Roster Integration](./WORLD_ROSTER_INTEGRATION.md)** - How World Roster data is imported
- **[Coordinate Transformation Guide](./COORDINATE_TRANSFORMATION_GUIDE.md)** - IxMaps CRS details
- **[Map Projection Guide](./MAP_PROJECTION_GUIDE.md)** - How map display works

## Data Update Log

| Date | Countries | Scale Factor | Total Land | Claimed Land | Notes |
|------|-----------|--------------|------------|--------------|-------|
| 2025-10-29 | 82/82 (100%) | 1.4777x | 127.7M sq mi | 44.4M sq mi (34.8%) | Complete map data integration verified ✅ |

## Future Enhancements

1. **Add Unclaimed Territories:** Import the 65.2% unclaimed land as distinct regions (wilderness zones, disputed territories, polar regions)
2. **Complete Geographic Coverage:** Add map boundaries for the 14 countries without visualization
3. **Ocean/Sea Naming:** Add names and boundaries for major oceans, seas, and water bodies
4. **Historical Data:** Track how claimed vs unclaimed territories change over time
5. **Territory Claims:** Allow countries to expand into unclaimed territories
