# World Roster Integration

## Overview

The World Roster (`public/World-Roster.xlsx`) is the **canonical source of truth** for country data in IxStats. It contains comprehensive data for **82 IxEarth countries** including:

- Country names and basic information
- **Canonical land areas** (in both sq mi and sq km)
- Population and demographics
- Economic data (GDP, GDP per capita, growth rates)
- 2041 projections

## Integration Architecture

### Data Flow

```
World-Roster.xlsx (82 IxEarth countries)
        ↓
unify-world-roster-and-map-data.ts
        ↓
    ┌───┴───┐
    ↓       ↓
Canonical   Geographic Boundaries
   Data     (PostGIS map_layer_political)
    ↓       ↓
    └───┬───┘
        ↓
  Country Table
  (PostgreSQL)
```

### Master Import Script

**Location:** `scripts/unify-world-roster-and-map-data.ts`

This is the **primary data import script** for IxStats. It:

1. **Reads World Roster** - Parses `World-Roster.xlsx` to load canonical country data
2. **Loads Geographic Boundaries** - Fetches geometry from PostGIS `map_layer_political` table
3. **Calculates IxEarth Scale Factor** - Dynamically calculates the scale factor by comparing:
   - Total canonical area (from World Roster)
   - Total calculated area (from PostGIS geography using Earth's ellipsoid)
4. **Fuzzy Matches Countries** - Links World Roster entries to geographic boundaries
5. **Creates/Updates Countries** - Writes unified data to the `Country` table

### Usage

```bash
# Run the unified import
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/unify-world-roster-and-map-data.ts
```

### Output Example

```
🌍 Starting Unified Data Import

📊 Reading World Roster...
   ✓ Loaded 82 countries from World Roster

🗺️  Loading geographic boundaries from PostGIS...
   ✓ Loaded 185 geographic boundaries (includes non-political features)

📐 Calculating IxEarth Scale Factor
   Matched countries: 65
   Total canonical area: 39,283,631.906 sq mi
   Total calculated area (Earth scale): 26,584,599.68 sq mi
   IxEarth Scale Factor: 1.4777x

💾 Importing Countries
✓ Caphiria    → 2,335,110 sq mi (with map)
✓ Urcea       → 2,127,930 sq mi (with map)
...
```

## IxEarth Scale Factor

### What Is It?

The IxEarth Scale Factor represents the ratio between:
- **Numerator:** Sum of canonical areas from World Roster (for matched countries)
- **Denominator:** Sum of calculated areas using PostGIS geography (Earth's WGS84 ellipsoid)

### Current Value

**IxEarth Scale Factor: 1.4777x**

This means that countries on IxEarth are, on average, **1.48 times larger** than their geographic boundaries would suggest if measured using Earth's coordinate system.

### Why Is There a Scale Factor?

IxMaps uses a custom coordinate reference system (CRS) that was designed independently of Earth's geography. When we import these coordinates into WGS84 (Earth's standard), the resulting geographic calculations don't match the canonical areas. The scale factor reconciles this difference.

### How Is It Calculated?

The script automatically calculates the scale factor by:

1. For each country that has **both**:
   - A canonical area in World Roster
   - A geographic boundary in PostGIS
2. Sum the canonical areas: `totalCanonicalArea`
3. Calculate PostGIS geography areas using Earth's ellipsoid: `totalCalculatedArea`
4. Divide: `scaleFactor = totalCanonicalArea / totalCalculatedArea`

This is **not arbitrary** - it's derived from the actual data relationship between IxMaps coordinates and World Roster canonical sizes.

## Data Priority

When conflicts arise, the system follows this priority:

1. **World Roster** - Canonical areas, population, economic data
2. **Geographic Boundaries** - Visualization, spatial relationships
3. **Calculated Values** - Only used for countries missing canonical data

## Current Statistics (As of Integration)

- **Total IxEarth Countries:** 82
- **Countries Successfully Imported:** 82 (100%) ✅
- **Countries with Geographic Boundaries:** 68 (82.9%)
- **Countries without Geographic Boundaries:** 14 (17.1%)
- **Claimed Land Area (82 countries):** 44,440,107 sq mi
- **Total IxEarth Land Area:** 127,724,236 sq mi (from complete map data)
- **Unclaimed Territories:** 83,284,129 sq mi (65.2% of total land)
- **IxEarth Scale Factor:** 1.4777x

**Data Quality:** ✅ Database correctly reflects World Roster (44.6M vs 44.4M sq mi, 0.4% difference). The 82 countries represent only 34.8% of total IxEarth land - the remaining 65.2% is unclaimed wilderness/territories.

## Troubleshooting

### Countries Not Importing

Some countries fail to import due to:

1. **Invalid GeoJSON** - Geographic data from PostGIS is malformed
2. **Duplicate Slugs** - Country names that create identical slugs
3. **Empty Rows** - Blank entries in the Excel spreadsheet
4. **Missing Data** - Required fields (name, area, population) are empty

The script will log errors for these countries and continue processing the rest.

### Refreshing Data

To re-import after updating World Roster:

```bash
# 1. Update World-Roster.xlsx
# 2. Re-run the unified import script
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/unify-world-roster-and-map-data.ts
```

The script will **update existing countries** and **create new ones**.

## Related Scripts

### `calculate-ixearth-metrics.ts`

Analyzes imported countries to calculate global IxEarth statistics:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" \
  npx tsx scripts/calculate-ixearth-metrics.ts
```

Output includes:
- Total IxEarth surface area
- Comparison to Earth's size
- Top 10 largest countries
- Top 10 most populous countries
- Top 10 largest economies

### `import-geographic-boundaries.ts` (DEPRECATED)

**⚠️ DO NOT USE** - This script is deprecated. Use `unify-world-roster-and-map-data.ts` instead.

## Database Schema

### Country Model (Relevant Fields)

```prisma
model Country {
  // World Roster Canonical Data
  name                String
  areaSqMi            Float   // Canonical from World Roster
  landArea            Float   // Same as areaSqMi
  currentPopulation   Float
  currentGdpPerCapita Float
  currentTotalGdp     Float

  // Geographic Boundaries (if available)
  geometry     Json?   // GeoJSON geometry
  centroid     Json?   // Center point
  boundingBox  Float[] // [minX, minY, maxX, maxY]
  coastlineKm  Float?  // Calculated with scale factor
}
```

## Key Insights

1. **World Roster is the source of truth** - All area data comes from here
2. **Geographic boundaries are supplementary** - They provide visualization, not canonical areas
3. **Scale factor is derived, not arbitrary** - It's the ratio needed to match canonical areas
4. **IxEarth size is known** - Sum all World Roster countries = total IxEarth land area
5. **System is fully unified** - One import script, one source of truth, one database

## Future Improvements

1. **Add Unclaimed Territories** - Import the 65.2% unclaimed land (83.3M sq mi) as distinct regions in the database
2. **Complete Geographic Coverage** - Add map boundaries for the 14 countries without visualization
3. **Ocean/Water Bodies** - Add names and boundaries for oceans, seas, and major water bodies (227M sq mi total water)
4. **Automated Sync** - Trigger re-import when World Roster changes
5. **Territory Claims** - Allow countries to expand into unclaimed territories over time

> **Note:** All IxEarth metrics are centralized in `src/lib/ixearth-constants.ts` for easy reference and updates.
