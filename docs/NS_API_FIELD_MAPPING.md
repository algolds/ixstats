# NationStates API to Database Field Mapping

This document maps all fields captured by the NS API client to their storage locations in the database.

## NS API Fields Captured

### From Deck API (`?q=cards+deck`)
- `CARDID` - Card ID number
- `CATEGORY` - Rarity (common, uncommon, rare, ultra-rare, epic, legendary)
- `MARKET_VALUE` - Current market value in bank
- `SEASON` - Card season number

### From Card Info API (`?q=card+info`)
- `NAME` - Nation name
- `FLAG` - Nation flag image URL
- `REGION` - Nation's region
- `TYPE` / `CATEGORY` - Government category
- `GOVT` - Government type
- `CARDCATEGORY` - Card classification
- `SLOGAN` - Nation slogan
- `MOTTO` - Nation motto
- `DESCRIPTION` - Card description
- `BADGE` - Nation badge/achievement
- `TROPHIES` - Nation trophies/awards

## Database Schema Mapping

### Direct Column Mappings

| NS API Field | Database Column | Type | Notes |
|--------------|----------------|------|-------|
| `NAME` | `title` | TEXT | Primary card title |
| `NAME` (alt) | `name` | TEXT | Alternate name field |
| `DESCRIPTION` / `SLOGAN` / `MOTTO` | `description` | TEXT | Priority: description > slogan > motto |
| `FLAG` | `artwork` | TEXT | Nation flag as card artwork |
| `CATEGORY` (rarity) | `rarity` | TEXT | Normalized rarity value |
| `SEASON` | `season` | INTEGER | Card season |
| - | `cardType` | TEXT | Always "NATION" for NS imports |
| `MARKET_VALUE` | `marketValue` | FLOAT | Numeric market value |
| `CARDID` | `nsCardId` | INTEGER | Original NS card ID |
| `SEASON` | `nsSeason` | INTEGER | Original NS season |
| `NAME` | `wikiArticleTitle` | TEXT | Link to potential wiki article |

### JSON Field Mappings

#### `artworkVariants` (JSONB)
Stores multiple versions of the flag/artwork:
```json
{
  "original": "https://www.nationstates.net/images/flags/...",
  "thumbnail": "https://www.nationstates.net/images/flags/...",
  "large": "https://www.nationstates.net/images/flags/...",
  "flagUrl": "https://www.nationstates.net/images/flags/..."
}
```

#### `stats` (JSONB)
Game-related statistics and attributes:
```json
{
  "region": "Greater Ixnay",
  "category": "Imperium",
  "govt": "Constitutional Monarchy",
  "cardcategory": "Nation",
  "marketValue": "0.10",
  "badge": "Achievement Badge Name",
  "trophies": "Trophy List"
}
```

#### `metadata` (JSONB)
Complete NS API data for reference and future use:
```json
{
  "nsData": {
    "id": "15066",
    "season": "3",
    "rarity": "rare",
    "name": "Heku",
    "region": "Greater Ixnay",
    "category": "Imperium",
    "govt": "Constitutional Monarchy",
    "type": "Imperium",
    "cardcategory": "Nation",
    "slogan": "For Glory and Honor",
    "motto": "United We Stand",
    "description": "A proud nation...",
    "badge": "Veteran Badge",
    "trophies": "5 Trophies",
    "market_value": "0.10",
    "flag": "https://www.nationstates.net/..."
  },
  "importedFrom": "heku",
  "importedAt": "2025-11-11T21:12:57.000Z"
}
```

## Field Storage Strategy

### Core Fields (Direct Columns)
Fields that need to be queried, filtered, or sorted are stored as direct columns:
- `title` - Searchable card name
- `rarity` - Filterable rarity tier
- `season` - Filterable season
- `marketValue` - Sortable market value
- `nsCardId`, `nsSeason` - Unique identification for NS cards

### Extended Data (JSON Columns)
Fields used for display or complex data structures are stored in JSON:
- `artworkVariants` - Multiple image URLs and variants
- `stats` - Game statistics and attributes
- `metadata` - Complete raw API response data

## Migration Requirements

To support NS card imports, the following columns must exist:

```sql
-- Required columns (most already exist)
id TEXT PRIMARY KEY
title TEXT NOT NULL
description TEXT
artwork TEXT
rarity TEXT NOT NULL
season INTEGER DEFAULT 1
cardType TEXT NOT NULL
marketValue FLOAT DEFAULT 0.0
nsCardId INTEGER
nsSeason INTEGER

-- JSON columns for extended data
artworkVariants JSONB
stats JSONB
metadata JSONB

-- Optional/alternate fields
name TEXT
wikiArticleTitle TEXT
level INTEGER DEFAULT 1
enhancements JSONB

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS cards_ns_unique ON cards(nsCardId, nsSeason);
CREATE INDEX IF NOT EXISTS cards_metadata_idx ON cards USING GIN (metadata);
```

## Data Flow

```
NS API (XML)
    ↓
NSApiClient.fetchDeck() + fetchCardInfo()
    ↓
NSCard Interface (TypeScript)
    ↓
nsImport.importDeck() Router
    ↓
Prisma Card Model
    ↓
PostgreSQL cards table
```

## Example Complete Card Record

```typescript
{
  id: "card_ns_15066_s3",
  title: "Heku",
  name: "Heku",
  description: "For Glory and Honor",
  artwork: "https://www.nationstates.net/images/flags/uploads/heku__123456.png",
  artworkVariants: {
    original: "https://www.nationstates.net/.../heku__123456.png",
    thumbnail: "https://www.nationstates.net/.../heku__123456.png",
    large: "https://www.nationstates.net/.../heku__123456.png",
    flagUrl: "https://www.nationstates.net/.../heku__123456.png"
  },
  cardType: "NATION",
  rarity: "RARE",
  season: 3,
  nsCardId: 15066,
  nsSeason: 3,
  wikiSource: null,
  wikiArticleTitle: "Heku",
  countryId: null,
  stats: {
    region: "Greater Ixnay",
    category: "Imperium",
    govt: "Constitutional Monarchy",
    cardcategory: "Nation",
    marketValue: "0.10",
    badge: "Veteran Badge",
    trophies: "5 Trophies"
  },
  metadata: {
    nsData: {
      id: "15066",
      season: "3",
      rarity: "rare",
      name: "Heku",
      region: "Greater Ixnay",
      category: "Imperium",
      govt: "Constitutional Monarchy",
      type: "Imperium",
      cardcategory: "Nation",
      slogan: "For Glory and Honor",
      motto: "United We Stand",
      description: "A proud nation of honor",
      badge: "Veteran Badge",
      trophies: "5 Trophies",
      market_value: "0.10",
      flag: "https://www.nationstates.net/images/flags/uploads/heku__123456.png"
    },
    importedFrom: "heku",
    importedAt: "2025-11-11T21:12:57.925Z"
  },
  marketValue: 0.10,
  totalSupply: 1,
  level: 1,
  enhancements: null,
  createdAt: "2025-11-11T21:12:57.925Z",
  updatedAt: "2025-11-11T21:12:57.925Z"
}
```

## Verification Checklist

✅ All NS API fields have storage location  
✅ Core queryable fields are direct columns  
✅ Extended data stored in JSON for flexibility  
✅ Complete raw data preserved in metadata  
✅ Image URLs stored in artworkVariants  
✅ Proper indexes for performance  
✅ Unique constraints prevent duplicates  

## Next Steps

1. Apply the migration: `./scripts/apply-cards-migration.sh`
2. Restart the dev server to pick up schema changes
3. Test NS card import with the fixed parser
4. Verify all fields are properly saved and retrieved



