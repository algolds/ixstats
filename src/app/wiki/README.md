# Wiki Integration System

**Status:** 85% Complete (Production Ready)
**Location:** `/src/app/wiki/`, `/src/app/builder/import/`
**API Router:** `/src/server/api/routers/wikiImporter.ts`

## Overview

The Wiki Integration System automatically imports and synchronizes country data from MediaWiki-based wikis (primarily IxWiki and AltHistoryWiki). It parses infobox templates, fetches flags, and maintains real-time data synchronization between wiki sources and the IxStats platform.

## Architecture

### Core Components

#### 1. **Wiki Importer API Router** (`/src/server/api/routers/wikiImporter.ts`)
- MediaWiki API integration
- Infobox template parsing
- Data validation and transformation
- Batch import processing

#### 2. **Import UI** (`/src/app/builder/import/page.tsx`)
- Country search interface
- Import preview and validation
- Batch processing controls
- Real-time import progress

#### 3. **Wiki Proxy Endpoints** (`/src/app/api/`)
- `/api/iiwiki-proxy/`: IxWiki MediaWiki proxy
- `/api/althistory-wiki-proxy/`: AltHistoryWiki proxy
- `/api/ixwiki-proxy/`: Legacy IxWiki proxy
- `/api/mediawiki/`: Generic MediaWiki handler

#### 4. **Flag Management System**
- `/api/flags/`: Flag image fetching
- `/api/flag-cache/`: Intelligent caching system
- `/api/debug-flags/`: Debug and troubleshooting

### Data Flow

```
User Request
    ↓
Search Wiki (MediaWiki API)
    ↓
Fetch Infobox Template
    ↓
Parse Template Data
    ↓
Validate & Transform
    ↓
Preview Import
    ↓
User Confirms
    ↓
Create/Update Country
    ↓
Fetch & Cache Flag
    ↓
Complete Import
```

## Supported Wiki Platforms

### IxWiki (Primary)
- **URL**: https://ixwiki.com/
- **Template**: `{{Infobox country}}`
- **Status**: Full support with real-time sync
- **Features**: Complete infobox parsing, flag integration, automatic updates

### AltHistoryWiki (Secondary)
- **URL**: https://althistory.fandom.com/
- **Template**: `{{Infobox country}}`
- **Status**: Full support via proxy
- **Features**: Infobox parsing, flag fetching, manual sync

### Future Support (Planned)
- Custom MediaWiki instances
- Non-MediaWiki data sources (JSON, CSV)

## Infobox Parsing

### Supported Fields

#### Basic Information
- `country_name` / `conventional_long_name`
- `common_name`
- `native_name`
- `motto`
- `anthem`

#### Geographic Data
- `capital`
- `largest_city`
- `area_km2` / `area_sq_mi`
- `percent_water`

#### Demographic Data
- `population_estimate`
- `population_census`
- `population_density_km2`
- `GDP_nominal`
- `GDP_PPP`
- `GDP_nominal_per_capita`
- `GDP_PPP_per_capita`

#### Government Data
- `government_type`
- `leader_title1`, `leader_name1`
- `leader_title2`, `leader_name2`
- `legislature`
- `sovereignty_type`
- `established_event1`, `established_date1`

#### Other Fields
- `currency`
- `time_zone`
- `calling_code`
- `cctld`
- `drives_on`

### Template Parsing Algorithm

```typescript
// Parse MediaWiki template syntax
function parseInfobox(wikitext: string): Record<string, string> {
  // 1. Extract {{Infobox country}} template
  // 2. Parse pipe-delimited fields
  // 3. Handle nested templates
  // 4. Clean HTML entities
  // 5. Extract plain text values
  // 6. Return structured data object
}
```

## Flag Management

### Flag Fetching Strategy

1. **WikiCommons Direct**: Fetch from Wikimedia Commons
2. **Wiki Page Image**: Extract from country's wiki page
3. **Template Field**: Use `image_flag` field from infobox
4. **Fallback URLs**: Try multiple URL patterns
5. **Default Flag**: Use placeholder if all fail

### Flag Caching System

```typescript
// Intelligent caching with CDN support
interface FlagCache {
  countryId: string;
  flagUrl: string;
  cachedAt: DateTime;
  expiresAt: DateTime;
  source: "wikimedia" | "wiki" | "template" | "fallback";
}

// Cache strategy
- Cache flags for 30 days
- Refresh on manual sync
- Fallback chain if cache expires
- CDN-backed for performance
```

### Debug Tools

**Flag Debug Endpoint:** `/api/debug-flags?country=[name]`
- Tests all flag fetching strategies
- Shows which URLs work/fail
- Provides fallback recommendations
- Displays cache status

## API Endpoints

### Search & Import

```typescript
// Search for country on wiki
wikiImporter.searchCountry({
  query: string,
  wiki: "iiwiki" | "althistory"
})

// Get country details from wiki
wikiImporter.getCountryData({
  countryName: string,
  wiki: "iiwiki" | "althistory"
})

// Import country from wiki
wikiImporter.importCountry({
  wikiTitle: string,
  wiki: "iiwiki" | "althistory",
  overwrite?: boolean
})

// Batch import multiple countries
wikiImporter.batchImport({
  countries: Array<{
    wikiTitle: string,
    wiki: "iiwiki" | "althistory"
  }>
})
```

### Synchronization

```typescript
// Sync existing country with wiki
wikiImporter.syncCountry({
  countryId: string,
  wiki: "iiwiki" | "althistory"
})

// Check for wiki updates
wikiImporter.checkUpdates({
  countryId: string
})
```

## Import UI Features

### Search & Preview
- **Wiki Search**: Find countries by name
- **Preview Data**: Review imported fields before saving
- **Validation**: Check for missing/invalid data
- **Conflict Resolution**: Handle existing countries

### Batch Processing
- **Multi-Select**: Import multiple countries at once
- **Progress Tracking**: Real-time import status
- **Error Handling**: Graceful failure with logs
- **Rollback**: Undo failed imports

### Manual Override
- **Field Editing**: Modify imported data before saving
- **Skip Fields**: Exclude specific fields from import
- **Custom Mapping**: Map wiki fields to custom fields

## Data Transformation

### GDP Conversion
```typescript
// Convert wiki GDP to IxStats format
function convertGDP(wikiGDP: string): number {
  // Parse "1.5 trillion" → 1,500,000,000,000
  // Handle billion/trillion suffixes
  // Remove currency symbols
  // Convert to numeric
}
```

### Population Normalization
```typescript
// Standardize population formats
function normalizePopulation(pop: string): number {
  // Parse "15.2 million" → 15,200,000
  // Handle million/billion suffixes
  // Remove commas and formatting
  // Validate reasonable range
}
```

### Date Parsing
```typescript
// Convert wiki dates to DateTime
function parseEstablishedDate(date: string): DateTime {
  // Handle various date formats
  // Extract year/month/day
  // Convert to IxTime epoch if needed
}
```

## Implementation Status

### ✅ Complete (85%)
- MediaWiki API integration
- Infobox template parsing
- IxWiki proxy with CORS handling
- AltHistoryWiki support
- Flag fetching and caching
- Batch import system
- Import preview UI
- Data validation
- Error handling and logging

### 📋 Remaining (v1.1)
- Automatic sync scheduling (daily/weekly)
- Change detection and notifications
- Historical data tracking (wiki revisions)
- Custom field mapping UI
- Multi-wiki aggregation
- Image gallery import (beyond flags)

## Usage Examples

### Importing a Country

```typescript
// Search for country
const { data: searchResults } = api.wikiImporter.searchCountry.useQuery({
  query: "Caphiria",
  wiki: "iiwiki"
});

// Get full data
const { data: countryData } = api.wikiImporter.getCountryData.useQuery({
  countryName: "Caphiria",
  wiki: "iiwiki"
});

// Import
const importMutation = api.wikiImporter.importCountry.useMutation();
await importMutation.mutateAsync({
  wikiTitle: "Caphiria",
  wiki: "iiwiki",
  overwrite: false
});
```

### Syncing Existing Country

```typescript
// Check for updates
const { data: hasUpdates } = api.wikiImporter.checkUpdates.useQuery({
  countryId: country.id
});

// Sync if updated
if (hasUpdates) {
  const syncMutation = api.wikiImporter.syncCountry.useMutation();
  await syncMutation.mutateAsync({
    countryId: country.id,
    wiki: "iiwiki"
  });
}
```

## Error Handling

### Common Issues & Solutions

**Issue:** Country not found on wiki
- **Solution**: Verify exact wiki page title, try alternative names

**Issue:** Infobox parsing fails
- **Solution**: Check template format, use manual entry for edge cases

**Issue:** Flag fetch fails
- **Solution**: Check WikiCommons availability, use manual flag upload

**Issue:** Data validation errors
- **Solution**: Review imported data, manually correct invalid fields

### Debug Mode

Enable debug logging for troubleshooting:
```typescript
// Set environment variable
WIKI_DEBUG=true

// Verbose logging of:
- API requests/responses
- Template parsing steps
- Data transformation
- Error stack traces
```

## Performance Considerations

### Caching Strategy
- **MediaWiki Responses**: 1-hour cache for page content
- **Search Results**: 5-minute cache
- **Flag Images**: 30-day CDN cache
- **Infobox Data**: Database-backed cache

### Rate Limiting
- **MediaWiki API**: Respect rate limits (default: 50 req/sec)
- **Batch Imports**: Process 5 countries at a time
- **Retry Logic**: Exponential backoff on failures

## Security Considerations

- **CORS Proxies**: Secure proxy endpoints with rate limiting
- **Input Validation**: Sanitize wiki data before database insert
- **XSS Prevention**: Strip dangerous HTML/scripts from wiki content
- **SQL Injection**: Use parameterized queries (Prisma ORM)

## Future Enhancements (v1.1+)

### Automatic Sync
- Daily/weekly background sync jobs
- Change detection via wiki revision API
- Notification on significant updates

### Enhanced Parsing
- Parse additional infobox types (Leaders, Cities, etc.)
- Extract history sections
- Import related pages (Geography, Economy, etc.)

### Multi-Source Aggregation
- Combine data from multiple wikis
- Conflict resolution UI
- Source attribution

### Visual Enhancements
- Import wiki images (coat of arms, maps, photos)
- Display wiki revision history
- Side-by-side comparison (wiki vs IxStats)

## Related Systems

- **Country Builder** (`/src/app/builder/`): Manual country creation
- **Country Profile** (`/src/app/countries/[slug]/`): Display imported data
- **Admin Dashboard** (`/src/app/admin/`): Bulk import management
- **Flag Service** (`/src/app/api/flags/`): Flag image delivery

## Technical Documentation

- **MediaWiki API**: https://www.mediawiki.org/wiki/API
- **IxWiki Templates**: https://ixwiki.com/wiki/Template:Infobox_country
- **Prisma Schema**: `/prisma/schema.prisma` (Country model)
- **Wiki Integration Architecture**: `/docs/technical/WIKI_INTEGRATION_ARCHITECTURE.md`

---

*The Wiki Integration System bridges IxStats with the broader wiki community, enabling seamless data import and synchronization for worldbuilding projects.*
