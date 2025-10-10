# MediaWiki Country Infobox → IxStats Database Mapping

This document describes how Wikipedia/IxWiki `Template:Infobox_country` fields map to the IxStats database schema.

## Overview

The wiki importer automatically extracts data from MediaWiki country infobox templates and maps them to the IxStats database structure, which consists of two main models:
- **Country** - Basic country data and economic indicators
- **NationalIdentity** - Detailed national identity information

## Field Mapping Reference

### National Identity Fields

| Wiki Parameter | IxStats Field | Model | Transform | Notes |
|---------------|---------------|-------|-----------|-------|
| `conventional_long_name` | `nationalIdentity.officialName` | NationalIdentity | - | Full official name |
| `native_name` | `nationalIdentity.officialName` | NationalIdentity | - | Fallback if conventional_long_name absent |
| `national_motto` | `nationalIdentity.motto` | NationalIdentity | - | National motto (original language) |
| `englishmotto` | `nationalIdentity.motto` | NationalIdentity | - | English translation (takes precedence) |
| `national_anthem` | `nationalIdentity.nationalAnthem` | NationalIdentity | - | Name of national anthem |
| `capital` | `nationalIdentity.capitalCity` | NationalIdentity | - | Capital city name |
| `largest_city` | `nationalIdentity.largestCity` | NationalIdentity | - | Largest city name |
| `official_languages` | `nationalIdentity.officialLanguages` | NationalIdentity | - | Comma-separated list |
| `national_languages` | `nationalIdentity.nationalLanguage` | NationalIdentity | - | Primary national language |
| `demonym` | `nationalIdentity.demonym` | NationalIdentity | - | Citizen demonym (e.g., "American") |
| `government_type` | `nationalIdentity.governmentType` | NationalIdentity | Normalized | Mapped to standard types |

### Country Basic Fields

| Wiki Parameter | IxStats Field | Model | Transform | Notes |
|---------------|---------------|-------|-----------|-------|
| `common_name` | `name` | Country | - | Short country name |
| `religion` | `religion` | Country | - | Primary religion(s) |
| `leader_name1` | `leader` | Country | - | Head of state/government |
| `area_km2` | `landArea` | Country | Parse number | Remove commas, convert to float |
| `area_sq_mi` | `areaSqMi` | Country | Parse number | Remove commas, convert to float |
| `population_estimate` | `currentPopulation` | Country | Parse integer | Remove commas |
| `population_census` | `currentPopulation` | Country | Parse integer | Fallback if estimate absent |
| `population_density_km2` | `populationDensity` | Country | Parse number | People per km² |

### Media/Images

| Wiki Parameter | IxStats Field | Model | Transform | Notes |
|---------------|---------------|-------|-----------|-------|
| `image_flag` | `flag` | Country | URL conversion | Converts File: reference to full URL |
| `image_coat` | `coatOfArms` | Country | URL conversion | Converts File: reference to full URL |

## Government Type Normalization

The importer normalizes government types to IxStats standard values:

| Wiki Values (contains) | IxStats Value |
|------------------------|---------------|
| "republic" | `republic` |
| "kingdom", "monarchy" | `kingdom` |
| "federation" | `federation` |
| "empire" | `empire` |
| "sultanate" | `sultanate` |
| "emirate" | `emirate` |
| Other | `republic` (default) |

## Usage

### 1. Parse Wiki Infobox

```typescript
import { parseInfoboxTemplate, mapInfoboxToIxStats } from '~/lib/wiki-infobox-mapper';

const wikitext = `{{Infobox country
| conventional_long_name = Republic of Example
| common_name = Example
| capital = Example City
| population_estimate = 25000000
}}`;

const parsed = parseInfoboxTemplate(wikitext);
const mapped = mapInfoboxToIxStats(parsed);
```

### 2. Preview Import via API

```typescript
const { data } = api.wikiImporter.previewImport.useQuery({
  wikitext: wikitext
});

console.log(data.mapped); // See mapped data structure
console.log(data.fieldCount); // Number of fields extracted
```

### 3. Import Country Data

```typescript
const result = await api.wikiImporter.importCountry.mutate({
  wikitext: wikitext,
  createNew: true // or countryId: 'existing-id' to update
});

console.log(result.countryId); // New/updated country ID
```

### 4. Fetch Directly from IxWiki

```typescript
const { data } = api.wikiImporter.fetchFromWiki.useQuery({
  pageName: 'Caphiria'
});

console.log(data.wikitext); // Full page content
console.log(data.hasInfobox); // Boolean - has country infobox
```

## Example Infobox

```wiki
{{Infobox country
| conventional_long_name = Imperium Caphirium
| common_name = Caphiria
| native_name = Imperium Caphirium
| image_flag = Flag_of_Caphiria.svg
| image_coat = Coat_of_arms_of_Caphiria.svg
| national_motto = "Strength Through Unity"
| englishmotto = "Strength Through Unity"
| national_anthem = "Gloria Caphiria"
| capital = Venceia
| largest_city = capital
| official_languages = Latin, Caphiric
| national_languages = Caphiric
| demonym = Caphirian
| government_type = Imperial Republic
| leader_title1 = Imperator
| leader_name1 = Marcus Aurelius
| area_km2 = 2,500,000
| area_sq_mi = 965,000
| population_estimate = 180,000,000
| population_estimate_year = 2024
| population_density_km2 = 72
| religion = Imperial Catholicism (official)
}}
```

## Mapped Output Structure

```typescript
{
  name: "Caphiria",
  slug: "caphiria",
  nationalIdentity: {
    officialName: "Imperium Caphirium",
    countryName: "Caphiria",
    governmentType: "empire",
    motto: "Strength Through Unity",
    nationalAnthem: "Gloria Caphiria",
    capitalCity: "Venceia",
    largestCity: "capital",
    officialLanguages: "Latin, Caphiric",
    nationalLanguage: "Caphiric",
    demonym: "Caphirian"
  },
  landArea: 2500000,
  areaSqMi: 965000,
  currentPopulation: 180000000,
  baselinePopulation: 180000000,
  populationDensity: 72,
  religion: "Imperial Catholicism (official)",
  leader: "Marcus Aurelius",
  flag: "https://upload.wikimedia.org/wikipedia/commons/Flag_of_Caphiria.svg",
  coatOfArms: "https://upload.wikimedia.org/wikipedia/commons/Coat_of_arms_of_Caphiria.svg"
}
```

## Advanced Features

### Coordinate Parsing

The mapper includes coordinate parsing for formats like:
- DMS: `51°30′N 0°7′W`
- Decimal: `40.7128°N, 74.0060°W`

```typescript
import { parseCoordinates } from '~/lib/wiki-infobox-mapper';

const coords = parseCoordinates("51°30′N 0°7′W");
// { latitude: "51.500000", longitude: "-0.116667" }
```

### Custom Field Extensions

To add new field mappings, edit `/ixwiki/public/projects/ixstats/src/lib/wiki-infobox-mapper.ts`:

```typescript
export const INFOBOX_FIELD_MAPPING = {
  // Add your custom mapping
  'calling_code': {
    ixStatsField: 'nationalIdentity.callingCode',
    model: 'NationalIdentity'
  },
  // ...
};
```

## API Endpoints

### `wikiImporter.previewImport`
- **Type**: Query
- **Input**: `{ wikitext: string }`
- **Output**: `{ parsed, mapped, fieldCount, mappedFieldCount }`
- **Description**: Preview mapped data without saving

### `wikiImporter.importCountry`
- **Type**: Mutation (Protected)
- **Input**: `{ wikitext: string, countryId?: string, createNew: boolean }`
- **Output**: `{ success, countryId, countryName, action }`
- **Description**: Import/update country from infobox

### `wikiImporter.fetchFromWiki`
- **Type**: Query
- **Input**: `{ pageName: string }`
- **Output**: `{ pageName, wikitext, hasInfobox }`
- **Description**: Fetch page directly from IxWiki API

## Database Models

### Country Model (Partial)
```prisma
model Country {
  id                String    @id @default(cuid())
  name              String
  slug              String    @unique
  continent         String?
  region            String?
  landArea          Float?
  areaSqMi          Float?
  currentPopulation Int
  populationDensity Float?
  religion          String?
  leader            String?
  flag              String?
  coatOfArms        String?

  nationalIdentity  NationalIdentity?
}
```

### NationalIdentity Model (Partial)
```prisma
model NationalIdentity {
  id                String   @id @default(cuid())
  countryId         String   @unique
  countryName       String?
  officialName      String?
  governmentType    String?
  motto             String?
  capitalCity       String?
  largestCity       String?
  demonym           String?
  officialLanguages String?
  nationalLanguage  String?
  nationalAnthem    String?

  country           Country  @relation(fields: [countryId], references: [id])
}
```

## Limitations & Future Enhancements

### Current Limitations
1. Currency extraction not yet implemented (requires parsing economy sections)
2. Geography (continent/region) not auto-detected from infobox
3. Coordinate parsing available but not yet integrated
4. Economic data (GDP, etc.) not extracted from infobox

### Planned Enhancements
1. Parse currency from economy infobox sections
2. Auto-detect continent/region from location data
3. Extract founding dates and historical events
4. Parse ethnic group demographics
5. Extract government structure details (legislature, upper/lower houses)

## Testing

Run the example to test the mapper:

```typescript
import { EXAMPLE_WIKI_INFOBOX, parseInfoboxTemplate, mapInfoboxToIxStats } from '~/lib/wiki-infobox-mapper';

const parsed = parseInfoboxTemplate(EXAMPLE_WIKI_INFOBOX);
const mapped = mapInfoboxToIxStats(parsed);

console.log(JSON.stringify(mapped, null, 2));
```
