# IxCards Lore-First Rebuild — Design Document

## The Problem

The current IxCards system was built NS-import-first. The `Card` model has `nsCardId`/`nsSeason` as a unique constraint, `CardDisplay` pipes every image through `proxyNSImage()`, the stat system assumes numeric nation-data (Force/Wealth/Influence/Legacy), and the visual fallback for cards without artwork is a procedural holographic pattern — a bandaid, not a design. Lore cards exist but as a second-class citizen: a request queue where users pay 50 IxC and wait for admin approval to turn a wiki article into a card that still uses the NS-era visual template.

**The vision:** Lore cards — cards born from the wiki, from worldbuilding, from the collective creative output of the community — become the *primary* product. NS import cards become a cool compatibility layer, not the foundation.

---

## Design Decisions (from brainstorming)

| Decision | Answer |
|---|---|
| Card visual identity | Category-dependent: flags for nations, category art for everything else |
| Visual language for lore | **Hybrid**: procedural background + typographic hero + per-category art treatment |
| Category granularity | **Medium**: 8–12 super-categories |
| Rebuild aggressiveness | **Full rebuild** — NS becomes compatibility layer |
| Stat/rarity determination | **Hybrid**: wiki signals suggest, admins override |
| Artwork source | **Three-tier**: procedural base → curated SVG icon → optional uploaded/fetched art |
| Base stats for lore | **Dropped** — lore cards have no numeric stats. Focus on rarity, category, visual quality, wiki content |

---

## Part I: Category Icon System

### Design Direction

Each category gets a geometric icon — constructed from the same rules so the set feels cohesive. The icons should feel institutional and heraldic, not like UI chrome.

**The test:** could this be stamped into a coin, engraved into metal, or embossed into a card?

- ✅ Heraldry, numismatics, cartographic symbols, institutional seals, engraving, modernist geometry
- ❌ Emoji, generic UI icons, illustrations, fantasy glyphs, thin "line icon" systems

### Construction Rules

1. **Geometric** — circles, arcs, lines, triangles, diamonds, shields, crosses, rings, rays. No arbitrary curves.
2. **Medium-weight strokes + fills** — not Lucide-thin. Like an engraved emblem. Readable at 24px, substantial at 128px.
3. **Bilaterally balanced** — strong central axis. Must *feel* balanced. Creates institutional quality.
4. **One dominant idea** — each icon communicates one concept. Colors and patterns carry the rest.
5. **Icon before illustration** — recognizable silhouette first, detail third. If it looks better at 256px than 32px, it's too detailed.

### Construction Grid

All icons designed on a **12 × 12 grid** inside a `96 × 96` SVG viewBox (each cell = 8 units).

### Stroke Vocabulary

| Weight | Size | Use |
|---|---|---|
| **Primary** | 6px | Structural elements (outlines, main forms) |
| **Secondary** | 4px | Internal details (decorative lines, secondary forms) |
| **Hairline** | 2px | Fine detail (strings, tick marks) |
| **Fill** | solid | Central emblems, shields, coins, silhouettes |

### Visual Families

Icons share visual primitives across families — this creates internal relationships without making them identical:

| Family | Categories | Shared Vocabulary |
|---|---|---|
| **Heraldic** | Military, Government, Nation | Shield, crown, banner, crossed elements |
| **Celestial** | Religion, Science, Geography | Circle, rays, orbit, compass |
| **Civic** | Diplomacy, Economy | Rings, scales, columns, balance |
| **Humanistic** | People, Culture, History | Profile, book, lyre, temporal symbols |

### The Twelve Category Icons

![Category Icons Reference](/home/jxsig/.gemini/antigravity-ide/brain/8d71cc9d-99f5-4038-9379-1c8a64191e6a/ix_sigils_reference_1786641748266.jpg)

| Category | Icon Form | Why |
|---|---|---|
| **Military** | Shield with crossed blades behind, chevron on face | Shield = military institution + defense + sovereignty, not just "combat" |
| **Diplomacy** | Two interlocking rings with laurel sprigs | Rings = agreement/treaty. No handshake — avoids corporate UI feel |
| **Geography** | Compass rose with meridian arc | Naturally circular, instantly recognizable, beautiful at all sizes |
| **Religion** | Central disc with eight rays | Non-denominational — faith/divinity/transcendence without privileging any religion |
| **Culture** | Simplified lyre with strings | Incredible silhouette, communicates music + art + civilization |
| **Government** | Classical pediment atop columns, crown at apex | Abstract enough to work as emblem, not a building illustration |
| **People** | Profile silhouette in circular medallion | Coin portrait — connects people → portraiture → collectible artifact → card |
| **Economy** | Central pillar with scales and disc pans | Exchange/balance/value, not just "law" |
| **Science** | Astrolabe (outer ring, tilted rete, pointer arm) | Distinctive, fits the historical/civilizational character. Not a generic atom/flask |
| **Geography** | Outer ring with three era divisions, arrow | Time → continuity → record. Visually related to Geography/Science without being identical |
| **Nation** | Staff with heraldic banner | Institutional banner. Only category where actual national flag becomes Tier 3 artwork |
| **Special** | Eight-point star (two overlapping diamonds) | The IxCards master mark. Appears on special cards, packs, card backs, authentication |

### Three Rendering Treatments

The same SVG at three scales with different purposes:

![Treatment Variants](/home/jxsig/.gemini/antigravity-ide/brain/8d71cc9d-99f5-4038-9379-1c8a64191e6a/sigil_treatments_1786641836580.jpg)

| Treatment | Scale | Opacity | Context |
|---|---|---|---|
| **Watermark** | Large (~50% of card) | 30–40% | Card face background — behind the title |
| **Emblem** | Medium (64–96px) | 100% | Category marker: sidebar nav, filter buttons, collection headers |
| **Seal** | Tiny (16–24px) | 100% | Inline metadata: filter chips, marketplace rows, card detail views |

```tsx
<CategoryIcon category="MILITARY" treatment="watermark" />
<CategoryIcon category="GEOGRAPHY" treatment="emblem" />
<CategoryIcon category="SCIENCE" treatment="seal" />
```

### Color Rules

Every icon uses `currentColor` — never baked into the SVG. The category system sets color at runtime. This enables category theming, rarity material treatments, and dark/light mode.

### Rarity Modifies the Material, Not the Icon

The same Military shield exists at every rarity. Only the *rendering quality* changes:

![Rarity Material Progression](/home/jxsig/.gemini/antigravity-ide/brain/8d71cc9d-99f5-4038-9379-1c8a64191e6a/rarity_progression_1786641810197.jpg)

| Rarity | Icon Rendering | Card Material |
|---|---|---|
| **Common** | Matte category-color | Clean, quiet, printed card stock |
| **Uncommon** | Subtle sheen | Gentle brightness sweep |
| **Rare** | Metallic silver | Silver catch-light, metallic stock |
| **Ultra Rare** | Prismatic chrome | Rainbow refraction across surface |
| **Epic** | Glowing aurora | Particle field, atmospheric depth |
| **Legendary** | Gold foil | Full holographic, light rays, rainbow foil |

---

## Part II: The Card Face

### Design Philosophy (Apple-informed)

The card should feel like a **physical artifact**.

1. **Materials & Depth**: Distinct layers — background, pattern, icon watermark, text — each at different depth.
2. **Typography as Hero**: The article title *is* the artwork. Optical sizing, negative tracking, tight leading.
3. **Category as Color System**: Each category owns a color band. Crimson-to-black = Military before reading anything.
4. **Rarity as Craftsmanship**: Common = matte. Legendary = gold foil. Material quality increases.
5. **Restraint**: No stats bars. A lore card shows: **title, category, rarity.** Details live elsewhere.

### Card Face Layout

![Lore Cards Mockup](/home/jxsig/.gemini/antigravity-ide/brain/8d71cc9d-99f5-4038-9379-1c8a64191e6a/lore_cards_mockup_1786641777932.jpg)

#### Tier 1-2: Procedural (most cards)

```
┌─────────────────────────────┐
│  ┌─ rarity border ────────┐ │
│  │                         │ │
│  │   [ICON WATERMARK]      │ │  ← Category icon, 30-40% opacity
│  │   at ~50% card height   │ │
│  │                         │ │
│  │  ┌─ pattern overlay ─┐  │ │  ← Category-specific CSS pattern
│  │  │                   │  │ │
│  │  └───────────────────┘  │ │
│  │                         │ │
│  │  ╔═══════════════════╗  │ │
│  │  ║  ARTICLE TITLE    ║  │ │  ← Hero typography, white
│  │  ║  (1-2 lines max)  ║  │ │     Large, bold, optically sized
│  │  ╚═══════════════════╝  │ │
│  │                         │ │
│  │  ┌─ category pill ───┐  │ │  ← "● Military" with dot color
│  │  └───────────────────┘  │ │
│  └─────────────────────────┘ │
└─────────────────────────────┘
```

#### Tier 3: Custom Art (nations, wiki images, admin uploads)

```
┌─────────────────────────────┐
│  ┌─ rarity border ────────┐ │
│  │                         │ │
│  │   [CUSTOM ARTWORK]      │ │  ← Flag / wiki image / uploaded
│  │   fills top 60-70%      │ │
│  │                         │ │
│  │  ━━━ gradient fade ━━━  │ │  ← Fade to category gradient
│  │                         │ │
│  │  ╔═══════════════════╗  │ │
│  │  ║  ARTICLE TITLE    ║  │ │
│  │  ╚═══════════════════╝  │ │
│  │                         │ │
│  │  [● Category]  [icon]   │ │  ← Icon as seal in corner
│  └─────────────────────────┘ │
└─────────────────────────────┘
```

### Category Color & Pattern System

| Category | Gradient | Pattern | Icon Form |
|---|---|---|---|
| **Military** | Crimson → black | Diagonal hash marks | Shield + blades |
| **Diplomacy** | Navy → indigo | Interlocking circles | Linked rings + laurel |
| **Geography** | Forest → sandstone | Topographic contour lines | Compass rose |
| **Religion** | Deep purple → gold | Geometric mandala | Radiant disc + rays |
| **Culture** | Warm amber → burgundy | Woven textile pattern | Lyre |
| **Government** | Steel blue → charcoal | Architectural grid | Pediment + columns |
| **People** | Warm neutral → sepia | Portrait frame border | Coin portrait |
| **Economy** | Gold → dark green | Currency guilloche | Scales |
| **Science** | Teal → dark blue | Blueprint grid | Astrolabe |
| **History** | Parchment → aged brown | Aged paper texture | Ring + era divisions |
| **Nation** | Amber → black | (uses flag as artwork) | Heraldic banner |
| **Special** | Varies per card | Custom per event | Eight-point star |

### Three-Tier Artwork System

```
Tier 1: PROCEDURAL (every card, always)
├── Category-themed gradient background
├── Category-specific pattern overlay (subtle, animated)
├── Icon watermark (large, 30-40% opacity)
├── Article title as hero typography
└── Rarity material treatment (border, glow, holographic)

Tier 2: ICON EMBLEM (default for most cards)
├── Everything from Tier 1
└── + Icon rendered prominently (not just watermark)

Tier 3: CUSTOM ART (optional, fetched or uploaded)
├── Custom image fills artwork area
├── Category gradient overlays bottom for text readability
├── Icon moves to small corner seal
└── Full rarity effects still layer on top
```

> [!IMPORTANT]
> **Tier 1 must look so good that Tier 3 is a nice bonus, not a necessity.** If a card without an image looks incomplete, we've failed.

---

## Part III: Data Model

### New Card Model

```prisma
model Card {
  id                String          @id @default(cuid())
  
  // === IDENTITY (lore-first) ===
  title             String
  slug              String          @unique
  description       String?         // Flavor text
  category          LoreCategory
  subcategory       String?         // Freeform sub-classification
  
  // === VISUAL ===
  artworkUrl        String?         // Tier 3: custom image
  artworkSource     ArtworkSource   @default(PROCEDURAL)
  artworkCredit     String?
  
  // === COLLECTIBILITY ===
  rarity            CardRarity
  season            Int             @default(1)
  totalSupply       Int?
  marketValue       Float           @default(0.0)
  
  // === WIKI CONNECTION ===
  wikiArticleTitle  String?
  wikiSource        String?         // "ixwiki" | "iiwiki"
  wikiPageId        Int?
  wikiExcerpt       String?         // Cached for card back / detail
  wikiImageUrl      String?
  
  // === NATION CONNECTION ===
  countryId         String?
  
  // === NS COMPATIBILITY ===
  nsCardId          Int?
  nsSeason          Int?
  nsData            Json?
  
  // === METADATA ===
  metadata          Json?
  isRetired         Boolean         @default(false)
  retiredAt         DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @default(now()) @updatedAt
  
  // === RELATIONS ===
  ownership         CardOwnership[]
  valueHistory      CardValueHistory[]
  watchlist         CardWatchlist[]

  @@unique([nsCardId, nsSeason])
  @@unique([wikiArticleTitle, wikiSource])
  @@index([category, rarity, season])
  @@index([marketValue])
  @@index([countryId])
  @@index([slug])
  @@map("cards")
}

enum LoreCategory {
  MILITARY
  DIPLOMACY
  GEOGRAPHY
  RELIGION
  CULTURE
  GOVERNMENT
  PEOPLE
  ECONOMY
  SCIENCE
  HISTORY
  NATION
  SPECIAL
  NS_IMPORT
}

enum ArtworkSource {
  PROCEDURAL
  WIKI_FETCHED
  UPLOADED
  FLAG
}
```

**Key changes from current:**
- `cardType` → `category` (13-value `LoreCategory` enum)
- `artwork` → `artworkUrl` + `artworkSource` + `artworkCredit`
- `stats` / `attributes` / `enhancements` / `level` → removed for lore cards
- Added `slug`, `wikiPageId`, `wikiExcerpt`, `wikiImageUrl`, `subcategory`
- NS fields preserved for backwards compatibility

---

## Part IV: Generation Pipeline

### Current flow
```
User pays 50 IxC → Request created → Admin reviews → Card created (manual)
```

### New flow
```
Wiki article exists
  → Auto-discover (bulk scan) OR user request (IxC / token)
  → Wiki API fetches: title, excerpt, categories, images, word count, links, edits
  → Algorithm suggests: category, rarity, artwork tier
  → Procedural card preview generated (immediate)
  → Admin review queue:
      - See auto-generated card with suggestions
      - Override category, rarity, artwork as needed
      - Approve → card minted
      - Batch-approve for bulk discovery
```

### Wiki Signal → Rarity Algorithm

| Signal | Weight | Notes |
|---|---|---|
| Word count | 25% | Longer articles → higher rarity |
| Internal links (to/from) | 25% | More connected → more significant |
| Edit count / contributors | 15% | Well-maintained → higher quality |
| Category breadth | 15% | Multi-domain articles → rarer |
| Has images | 10% | Visual richness |
| Age (first edit) | 10% | Established articles → legacy |

Distribution: Common (40%) → Uncommon (25%) → Rare (20%) → Ultra Rare (10%) → Epic (4%) → Legendary (1%)

---

## Part V: NS Compatibility Layer

- `category: NS_IMPORT` preserves all NS cards
- `nsCardId`/`nsSeason` fields maintained
- NS artwork uses `proxyNSImage()` (Tier 3)
- NS cards **keep stats** (shown only for NS_IMPORT/NATION categories)
- NS import wizard stays functional but secondary in nav
- NS library becomes "NationStates Collection"

---

## Part VI: What Stays vs. Rebuilds

### ✅ Keeps
| System | Why |
|---|---|
| IxCredits / Vault economy | Currency is card-type-agnostic |
| Marketplace (Auctions + Trading) | P2P economy is agnostic |
| Card Packs | Pack opening works — needs new themes |
| Collections | User collections work as-is |
| Crafting | Recipe system works — needs lore recipes |
| Ownership / transfers | Tracking is type-agnostic |
| Watchlist | Works as-is |

### 🔨 Rebuilds
| System | What changes |
|---|---|
| **Card model** | `LoreCategory`, `ArtworkSource`, drop stats for lore |
| **CardDisplay** | Typography-first, category-themed, three-tier artwork |
| **Category icons** | 12 SVGs, construction grid, three treatments |
| **CardHolographicCover** | Becomes primary visual (not fallback), per-category |
| **Generation pipeline** | Wiki-signal auto-discovery + admin queue |
| **Enums** | `CardType` (5) → `LoreCategory` (13) |
| **Card detail modal** | Wiki excerpt, category info, no stats for lore |
| **Vault nav** | Lore Gallery primary, NS secondary |
| **Filtering** | Category-based (not just type/rarity) |
| **Pack theming** | Category-themed packs |

---

## Open Questions

> [!IMPORTANT]
> ### Card Back
> Should lore cards have a card-flip interaction revealing wiki excerpt, related articles, ownership history? An Apple-style spring animation card flip would be very premium.

> [!IMPORTANT]
> ### Seasons
> - **Option A**: Time-based (Season 1 = launch batch, Season 2 = next quarter)
> - **Option B**: Thematic ("Age of Empires", "Dawn of Faith")
> - **Option C**: No seasons for lore — continuous collection

> [!IMPORTANT]
> ### Bulk Discovery
> Should the system auto-scan the wiki and pre-generate a catalog, or should every card require a user request? Auto-scan bootstraps instantly but needs quality control.

> [!IMPORTANT]
> ### Pack Composition
> Category packs (Military Pack), mixed packs, season packs, realm-specific packs?

---

## Phase Breakdown

| Phase | Scope | Dependency |
|---|---|---|
| **1. Category Icons** | SVG icon design, `<CategoryIcon>` component, construction grid | None |
| **2. Data Model** | `LoreCategory`, `ArtworkSource`, schema migration | None |
| **3. Card Face** | `CardDisplay` rebuild, procedural backgrounds, category themes | Phase 1 |
| **4. Generation Pipeline** | Wiki API, rarity algorithm, admin review queue | Phase 2 |
| **5. Admin Suite & Studio** | Lore-First dashboard tab reordering, Live Card Studio modal, category filters | Phase 3-4 |
| **6. Vault Reordering** | Sidebar, nav, gallery, category filtering | Phase 3 |
| **7. Pack & Economy** | Category-themed packs, crafting, marketplace updates | Phase 2-4 |

---

## Part VII: Lore-First Card Admin Suite Re-Architecture

### Design Principles for Card Admin Suite

1. **Lore-First Navigation & Metrics**:
   - The primary entry point and stats in `/admin/cards` highlight **Lore Cards**, active **Lore Categories**, and **User Wiki Requests**, with NS import compatibility metrics as a secondary section.
   - Tabs re-ordered to elevate **Wiki Lore Studio** and **Live Card Studio & Explorer** to the top navigation.

2. **Server-Side Filter Alignment (`inventory.ts`)**:
   - `getNSCards` procedure accepts `categoryFilter: z.nativeEnum(LoreCategory).optional()`.
   - `cardTypeFilter` handles `LORE` (matching `cardType: { in: ["LORE", "LORE_BATCH"] }` or `category != null`), `NS_IMPORT`, `COMMONS_IMPORT`, `USER_CUSTOM`, and `all`.
   - `search` parameter matches `title`, `slug`, `wikiExcerpt`, and `category`.

3. **Live Card Studio & Inspector Modal**:
   - Every card row in the Admin Explorer includes an **"Edit Studio"** trigger.
   - Interactive 2-column modal:
     - Left: Real-time `<CardDisplay card={livePreviewCard} size="medium" enable3D={true} />` rendering exact card face, theme colors, pattern overlay, category seal, and rarity glow.
     - Right: Live controls for Title, Lore Category, Rarity Tier, Artwork Source Tier, Artwork URL, Est. Market Value, and Retired Visibility toggle.

