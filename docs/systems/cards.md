# Cards System

**Last updated:** May 2026 (Phase 1)
**Status:** Development - Phase 1 Implementation

**Hierarchy:** Part of IxVault integrated product (wallet, economy, trading cards).

The IxCards system provides collectible trading cards that integrate deeply with IxStats gameplay. Cards feature nations, historical lore, NationStates imports, and special editions, creating a rich collecting experience with real-time stat tracking and market dynamics.

## Overview

IxCards features:
- **Multi-Source Card Types** - Nation cards, lore cards, NS imports, special editions
- **Dynamic Rarity System** - Performance-based rarity calculation
- **Stat Tracking** - Cards display economic, diplomatic, military, social metrics
- **Ownership System** - Full ownership tracking with enhancements
- **Market Integration** - Trading, auctions, peer-to-peer exchanges
- **Collection Building** - Themed collections with completion tracking

## Card Types

### NATION Cards (IxStats Integration)

Automatically generated from IxStats nations with dynamic stats:

**Card Data:**
```typescript
interface NationCard {
  // Identity
  title: string; // Nation name
  artwork: string; // Nation flag URL
  description: string; // Nation motto/tagline

  // Stats (0-100 scale)
  stats: {
    economicPower: number; // GDP-based
    diplomaticInfluence: number; // Embassy count + relationships
    militaryStrength: number; // Defense metrics
    socialVitality: number; // ThinkPages engagement
  };

  // IxStats integration
  countryId: string;
  country: Country; // Full nation data

  // Dynamic properties
  rarity: CardRarity; // Calculated from nation performance
  season: number; // Current season
  level: number; // Enhancement level
}
```

**Stat Calculations:**
```typescript
// Economic Power (0-100)
const economicPower = Math.min(100,
  (gdpPerCapita / 1000) + // Max 100 from GDP
  (economicTier * 10) + // Tier bonus
  (growthRate * 5) // Growth factor
);

// Diplomatic Influence (0-100)
const diplomaticInfluence = Math.min(100,
  (embassyCount * 3) + // Embassy network
  (averageRelationship / 10) + // Relationship quality
  (activeMissions * 2) // Active diplomacy
);

// Military Strength (0-100)
const militaryStrength = Math.min(100,
  (defenseBudget / 10000000) + // Budget scale
  (readinessScore * 0.5) + // Operational readiness
  (branchCount * 10) // Force diversity
);

// Social Vitality (0-100)
const socialVitality = Math.min(100,
  (thinkpagesFollowers / 100) + // Social reach
  (postsCount / 10) + // Content creation
  (engagementRate * 20) // Interaction quality
);
```

**Rarity Calculation:**
```typescript
function calculateNationCardRarity(nation: Country): CardRarity {
  let rarityScore = 0;

  // Economic tier (0-20 points)
  rarityScore += nation.economicTier * 5;

  // Leaderboard position (0-100 points)
  if (nation.leaderboardRank) {
    rarityScore += (1000 - nation.leaderboardRank) / 10;
  }

  // Achievement count (0-50 points)
  rarityScore += nation.achievementCount * 2;

  // Embassy network (0-75 points)
  rarityScore += nation.embassyCount * 3;

  // Veteran bonus (0-15 points)
  if (nation.accountAge > 365) {
    rarityScore += 15;
  }

  // Map to rarity tiers
  if (rarityScore >= 90) return CardRarity.LEGENDARY;
  if (rarityScore >= 70) return CardRarity.EPIC;
  if (rarityScore >= 50) return CardRarity.ULTRA_RARE;
  if (rarityScore >= 30) return CardRarity.RARE;
  if (rarityScore >= 15) return CardRarity.UNCOMMON;
  return CardRarity.COMMON;
}
```

**Dynamic Variants:**
Special variants created at milestones:
- "GDP Titan" - $100K+ per capita
- "Diplomatic Master" - 25+ embassies
- "Social Icon" - 10K+ followers
- "Veteran" - 2+ years active

### LORE Cards (Wiki Integration)

Generated from IxWiki/IIWiki articles:

**Card Categories:**
- Historical Figures (leaders, scientists, artists)
- Geographical Locations (cities, landmarks, regions)
- Historical Events (wars, treaties, discoveries)
- Cultural Artifacts (art, literature, traditions)
- Legendary Items (mythical objects, symbols)

**Generation Process:**
```typescript
async function generateLoreCard(article: WikiArticle): Promise<Card> {
  return {
    title: article.title,
    description: await summarizeArticle(article.text, 200),
    artwork: selectBestImage(article.images),
    cardType: CardType.LORE,

    stats: {
      historicalSignificance: calculateSignificance(article),
      culturalImpact: calculateImpact(article),
      rarity: calculateLoreRarity(article),
      preserved: 100 // All lore cards are "preserved"
    },

    metadata: {
      wikiSource: 'ixwiki',
      wikiArticleTitle: article.title,
      wikiUrl: article.url,
      category: determineCategory(article),
      era: extractEra(article)
    }
  };
}
```

**Rarity Calculation:**
```typescript
function calculateLoreRarity(article: WikiArticle): CardRarity {
  let rarityScore = 0;

  // Article length (0-30 points)
  rarityScore += article.text.length / 100;

  // Reference count (0-50 points)
  rarityScore += article.references.length * 5;

  // Featured article bonus (50 points)
  if (article.isFeatured) {
    rarityScore += 50;
  }

  // Cross-references (0-20 points)
  rarityScore += article.inboundLinks.length * 2;

  return mapScoreToRarity(rarityScore);
}
```

### NS_IMPORT Cards (NationStates Integration)

Imported from NationStates card dump:

**Import Process:**
```typescript
async function syncNSCards() {
  // Fetch daily card dump
  const dumpUrl = `https://www.nationstates.net/pages/cardlist_S${season}.xml.gz`;
  const cardData = await fetchAndDecompress(dumpUrl);

  for (const nsCard of cardData) {
    await db.card.upsert({
      where: {
        nsCardId: nsCard.id,
        season: nsCard.season
      },
      update: {
        // Track IxStats enhancements
        ixstatsEnhancements: {
          pullCount: { increment: 1 },
          lastPulled: new Date()
        }
      },
      create: {
        nsCardId: nsCard.id,
        season: nsCard.season,
        title: nsCard.nation,
        rarity: mapNSRarity(nsCard.rarity),
        artwork: nsCard.flag,
        cardType: CardType.NS_IMPORT,
        metadata: nsCard
      }
    });
  }
}
```

**Collection Import:**
```typescript
async function importNSCollection(userId: string, nsNation: string) {
  // Verify ownership
  const verified = await verifyNSOwnership(nsNation);
  if (!verified) throw new Error("Cannot verify NS nation ownership");

  // Fetch NS deck
  const nsDeck = await fetchNSDeck(nsNation);

  // Create IxCards equivalents
  for (const card of nsDeck.cards) {
    await createCardOwnership({
      userId,
      cardId: await findOrCreateNSCard(card),
      quantity: card.count,
      acquiredMethod: AcquireMethod.NS_IMPORT,
      metadata: { originalNS: true }
    });
  }

  // Award import bonus
  await awardIxCredits(userId, 100, 'NS_COLLECTION_IMPORT');
}
```

**Copyright & Asset Storage Compliance:**
- **URL-Only Storage:** IxCards stores URL strings (`artwork: "https://www.nationstates.net/images/cards/s..."`) rather than persistent image bytes. No flag binary files are written to S3, PostgreSQL, or local disk storage.
- **Streaming Proxy:** The `/api/proxy-ns-image` endpoint acts as an in-memory streaming proxy with standard browser caching headers (`max-age=86400`). It does not persist file bytes to storage.
- **First-Party Grant:** Verified imports require explicit confirmation from the nation owner: *"I am the owner or authorized operator of this nation on NationStates, and I grant permission to display my nation's flag and card representation on IxCards."*
- **Attribution Footer:** All NS_IMPORT cards display a pinned `NationStatesAttribution` footer bar in `CardDetailsModal` with legally-sound attribution copy and a **"Verify & Request Takedown"** trigger. See [NationStates Integration → Attribution Footer](./ns-integration.md#attribution-footer).
- **Self-Service Flag-Owner Takedown:** Nation owners can request removal directly via the **Content Removal Request** dialog (no admin required). They verify ownership using a NationStates one-time checksum token bound to IxStats via a site-specific HMAC-MD5 token (`NS_VERIFICATION_SECRET`). On success, the card is retired and all artwork cleared. See [NationStates Integration → Self-Service Flag Artwork Takedown](./ns-integration.md#self-service-flag-artwork-takedown) for the full flow.
- **Admin Takedown** (unchanged): Admins can still retire any NS card via the Cards admin panel or `nsImport.hideNSCard`; retired cards are excluded from future syncs.

### SPECIAL Cards (Event/Limited Editions)

**Event Cards:**
- Platform milestones ("IxStates 1.0 Ogma Launch")
- User milestones ("100K Users")
- Seasonal holidays (limited time)
- Anniversary editions

**Community Cards:**
- Top contributors/moderators
- Contest winners
- User-submitted designs (moderated)

**Collaborative Cards:**
- ThinkTank group achievements
- Diplomatic alliance commemoratives
- Economic bloc special editions

## Card Rarity System

### Rarity Tiers

```typescript
enum CardRarity {
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  ULTRA_RARE = "ULTRA_RARE",
  EPIC = "EPIC",
  LEGENDARY = "LEGENDARY"
}
```

**Rarity Distribution (Standard Pack):**
| Rarity | Drop Rate | Average per Pack |
|--------|-----------|------------------|
| Common | 65% | 3-4 cards |
| Uncommon | 25% | 1-2 cards |
| Rare | 7% | 0-1 cards |
| Ultra Rare | 2% | Occasional |
| Epic | 0.9% | Rare |
| Legendary | 0.1% | Very rare |

**Visual Indicators:**
```typescript
const RARITY_COLORS = {
  COMMON: '#94a3b8', // Slate
  UNCOMMON: '#22c55e', // Green
  RARE: '#3b82f6', // Blue
  ULTRA_RARE: '#a855f7', // Purple
  EPIC: '#f59e0b', // Amber
  LEGENDARY: '#eab308', // Gold
};

const RARITY_EFFECTS = {
  COMMON: 'none',
  UNCOMMON: 'subtle-glow',
  RARE: 'medium-glow',
  ULTRA_RARE: 'strong-glow',
  EPIC: 'holographic',
  LEGENDARY: 'animated-holographic'
};
```

## Card Ownership

### Ownership Tracking

```typescript
interface CardOwnership {
  id: string;
  userId: string;
  cardId: string;

  // Quantity
  quantity: number; // Multiple copies

  // Acquisition
  acquiredDate: DateTime;
  acquiredMethod: AcquireMethod; // PACK, TRADE, AUCTION, etc.

  // Enhancement
  isLeveledUp: boolean;
  hasAlternateArt: boolean;
  customizations: Json;

  // Protection
  isInsured: boolean;
  insuranceExpiry: DateTime;
  isLocked: boolean; // Prevent accidental junk/trade
}
```

### Acquisition Methods

```typescript
enum AcquireMethod {
  PACK = "PACK", // Opened from pack
  TRADE = "TRADE", // P2P trade
  AUCTION = "AUCTION", // Won auction
  CRAFT = "CRAFT", // Crafted from other cards
  GIFT = "GIFT", // Received as gift
  NS_IMPORT = "NS_IMPORT", // Imported from NS
  ACHIEVEMENT = "ACHIEVEMENT", // Achievement reward
  EVENT = "EVENT" // Event reward
}
```

### Card Recycling & Junking (May 2026 Update)

To allow players to recycle duplicate or unwanted cards, we implemented the **Card Junking** mechanism:
- **Mutation**: `api.cards.junkCards` validates ownership of targeted card copies.
- **Lock Protection**: Only unlocked cards (`isLocked === false`) are eligible. Locked cards are protected to prevent accidental recycling.
- **Rewards**: Junking cards permanently deletes the corresponding `CardOwnership` records and instantly credits the user's Vault balance with IxCredits scaled according to the card's rarity.

## Card Statistics

### Market Metrics

```typescript
interface CardStats {
  totalSupply: number; // Total in circulation
  marketValue: number; // Current market price (IxC)
  lastTrade: DateTime; // Last sale date
  priceHistory: PricePoint[]; // Historical prices

  // Trading velocity
  tradesLast7Days: number;
  tradesLast30Days: number;

  // Owner metrics
  uniqueOwners: number;
  averageQuantityPerOwner: number;

  // Rarity metrics
  rarityPercentile: number; // 0-100
}
```

### Performance Tracking

For nation cards, track correlation between real nation performance and card value:

```typescript
interface NationCardPerformance {
  cardId: string;
  countryId: string;

  // Market correlation
  valueChangeVsGDP: number; // Correlation coefficient
  valueChangeVsDiplomacy: number;

  // Demand indicators
  searchVolume: number; // How often searched
  watchlistCount: number; // Users watching
  bidCount: number; // Active bids

  // Royalties earned
  royaltiesGenerated: number; // Total IxC for nation owner
  royaltiesPaid: number; // Last 30 days
}
```

## Usage Examples

### Browsing Cards

```typescript
import { api } from "~/trpc/react";

function CardBrowser() {
  const [filters, setFilters] = useState({
    season: 1,
    rarity: undefined,
    type: undefined,
    search: ''
  });

  const { data, isLoading } = api.cards.getCards.useQuery({
    ...filters,
    limit: 50,
    offset: 0
  });

  return (
    <div className="card-browser">
      <CardFilters
        filters={filters}
        onChange={setFilters}
      />

      <CardGrid
        cards={data?.cards}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### Viewing Card Details

```typescript
function CardDetailsPage({ cardId }: { cardId: string }) {
  const { data: card } = api.cards.getCardById.useQuery({ cardId });
  const { data: stats } = api.cards.getCardStats.useQuery({ cardId });

  return (
    <div className="card-details">
      <CardDisplay
        card={card}
        variant="3d"
        showStats
        interactive
      />

      <CardStatsPanel>
        <Stat label="Market Value" value={`${stats.marketValue} IxC`} />
        <Stat label="Total Supply" value={stats.totalSupply} />
        <Stat label="Last Trade" value={formatRelativeTime(stats.lastTrade)} />
        <Stat label="Trades (7d)" value={stats.tradesLast7Days} />
      </CardStatsPanel>

      {card.cardType === 'NATION' && (
        <NationCardDetails
          card={card}
          country={card.country}
        />
      )}
    </div>
  );
}
```

### User Inventory (MyCards)

```typescript
function MyCardsInventory() {
  const [sortBy, setSortBy] = useState<'rarity' | 'date' | 'value'>('rarity');

  const { data: cards } = api.cards.getMyCards.useQuery({
    sortBy,
    filterRarity: undefined
  });

  const deckValue = cards?.reduce((sum, card) =>
    sum + (card.card.marketValue * card.quantity), 0
  );

  return (
    <div className="my-cards">
      <div className="header">
        <h1>MyCards</h1>
        <p className="deck-value">
          Deck Value: {deckValue?.toLocaleString()} IxC
        </p>
      </div>

      <div className="controls">
        <Select value={sortBy} onValueChange={setSortBy}>
          <option value="rarity">Sort by Rarity</option>
          <option value="date">Sort by Date Acquired</option>
          <option value="value">Sort by Value</option>
        </Select>
      </div>

      <CardGrid>
        {cards?.map((ownership) => (
          <CardWithOwnership
            key={ownership.id}
            card={ownership.card}
            quantity={ownership.quantity}
            acquiredDate={ownership.acquiredDate}
            onView={() => router.push(`/cards/${ownership.cardId}`)}
            onTrade={() => openTradeModal(ownership.cardId)}
            onList={() => openAuctionModal(ownership.cardId)}
          />
        ))}
      </CardGrid>
    </div>
  );
}
```

### Card by Country

```typescript
function NationCardViewer({ countryId }: { countryId: string }) {
  const { data: cards } = api.cards.getCardsByCountry.useQuery({
    countryId
  });

  const currentCard = cards?.find(c => c.season === currentSeason);
  const historicalCards = cards?.filter(c => c.season < currentSeason);

  return (
    <div className="nation-cards">
      <h2>Your Nation Card</h2>

      {currentCard && (
        <div className="current-card">
          <CardDisplay card={currentCard} variant="3d" />

          <div className="card-metrics">
            <Metric
              label="Market Value"
              value={`${currentCard.marketValue} IxC`}
              change={calculateChange(currentCard)}
            />
            <Metric
              label="Your Royalties"
              value={`${calculateRoyalties(currentCard)} IxC`}
              sublabel="From trades"
            />
            <Metric
              label="Rarity"
              value={currentCard.rarity}
              badge={<RarityBadge rarity={currentCard.rarity} />}
            />
          </div>

          <Button onClick={() => router.push('/vault/market')}>
            View on Market
          </Button>
        </div>
      )}

      {historicalCards?.length > 0 && (
        <div className="historical">
          <h3>Historical Variants</h3>
          <CardCarousel cards={historicalCards} />
        </div>
      )}
    </div>
  );
}
```

### Featured Cards

```typescript
function FeaturedCardsWidget() {
  const { data: featured } = api.cards.getFeaturedCards.useQuery();

  return (
    <div className="featured-cards">
      <h3>Featured This Week</h3>

      <div className="card-showcase">
        {featured?.map((card) => (
          <FeaturedCard
            key={card.id}
            card={card}
            badge={card.isTrending ? 'Trending' : undefined}
            onClick={() => router.push(`/cards/${card.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Integration with IxStats

### Nation Performance → Card Value

```typescript
// Nightly job to update nation card stats
async function updateNationCardStats() {
  const nations = await db.country.findMany({
    include: { cards: true }
  });

  for (const nation of nations) {
    const currentCard = nation.cards.find(c => c.season === currentSeason);
    if (!currentCard) continue;

    // Recalculate stats
    const stats = {
      economicPower: calculateEconomicPower(nation),
      diplomaticInfluence: calculateDiplomaticInfluence(nation),
      militaryStrength: calculateMilitaryStrength(nation),
      socialVitality: calculateSocialVitality(nation)
    };

    // Update card
    await db.card.update({
      where: { id: currentCard.id },
      data: {
        stats,
        rarity: calculateNationCardRarity(nation),
        updatedAt: new Date()
      }
    });

    // Update market value based on demand
    await updateMarketValue(currentCard.id);
  }
}
```

### Diplomatic Integration

Cards appear in embassy views:

```typescript
function EmbassyCard({ embassy }: { embassy: Embassy }) {
  const { data: guestCard } = api.cards.getCardsByCountry.useQuery({
    countryId: embassy.guestCountryId
  });

  return (
    <div className="embassy-card">
      {/* Embassy details */}

      {guestCard && (
        <div className="nation-card-preview">
          <CardDisplay card={guestCard} size="small" />
          <Button onClick={() => openCardTradeModal(embassy.guestCountryId)}>
            Trade Cards
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Achievement Integration

```typescript
// Award exclusive card for achievement
async function onAchievementUnlock(userId: string, achievement: Achievement) {
  // Award IxCredits
  await awardIxCredits(userId, achievement.ixCreditsReward, 'ACHIEVEMENT_UNLOCK');

  // Award special card if applicable
  if (achievement.cardReward) {
    await createCardOwnership({
      userId,
      cardId: achievement.cardReward,
      quantity: 1,
      acquiredMethod: AcquireMethod.ACHIEVEMENT
    });

    await sendNotification(userId, {
      type: 'CARD_ACQUIRED',
      message: `You received an exclusive card: ${achievement.cardReward.title}!`
    });
  }
}
```

## API Reference

See [API Documentation](../reference/api-complete.md#cards-router) for complete endpoint specifications.

## Database Schema

```prisma
model Card {
  id                String          @id @default(cuid())
  title             String
  description       String?
  artwork           String
  artworkVariants   Json?
  cardType          CardType
  rarity            CardRarity
  season            Int

  // NS Integration
  nsCardId          Int?            @unique
  nsSeason          Int?
  nsData            Json?

  // Wiki Integration
  wikiSource        String?
  wikiArticleTitle  String?
  wikiUrl           String?

  // IxStats Integration
  countryId         String?
  country           Country?        @relation(fields: [countryId], references: [id])

  // Stats
  stats             Json

  // Market data
  totalSupply       Int             @default(0)
  marketValue       Float           @default(0)
  lastTrade         DateTime?

  // Enhancement
  level             Int             @default(1)
  evolutionStage    Int             @default(0)
  enhancements      Json?

  // Relationships
  owners            CardOwnership[]
  auctions          CardAuction[]
  trades            CardTrade[]
  craftingRecipes   CraftingRecipe[] @relation("InputCards")
  craftingOutputs   CraftingRecipe[] @relation("OutputCard")

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([cardType, rarity])
  @@index([season])
  @@index([nsCardId, nsSeason])
  @@index([countryId])
  @@index([marketValue])
}

enum CardType {
  NATION
  LORE
  NS_IMPORT
  SPECIAL
  COMMUNITY
}

enum CardRarity {
  COMMON
  UNCOMMON
  RARE
  ULTRA_RARE
  EPIC
  LEGENDARY
}

model CardOwnership {
  id                String          @id @default(cuid())
  userId            String
  user              User            @relation(fields: [userId], references: [id])
  cardId            String
  card              Card            @relation(fields: [cardId], references: [id])

  quantity          Int             @default(1)
  acquiredDate      DateTime        @default(now())
  acquiredMethod    AcquireMethod

  isLeveledUp       Boolean         @default(false)
  hasAlternateArt   Boolean         @default(false)
  customizations    Json?

  isInsured         Boolean         @default(false)
  insuranceExpiry   DateTime?
  isLocked          Boolean         @default(false)

  @@unique([userId, cardId])
  @@index([userId])
  @@index([cardId])
}

enum AcquireMethod {
  PACK
  TRADE
  AUCTION
  CRAFT
  GIFT
  NS_IMPORT
  ACHIEVEMENT
  EVENT
}
```

## Card Packs

> Merged from `docs/systems/card-packs.md` (pack acquisition and opening mechanics). Date: June 2026.

Card packs are the primary method for acquiring new cards. Players purchase packs with IxCredits, open them through a cinematic reveal sequence, and receive randomized cards based on rarity distribution mechanics.

### Pack Types

#### Basic Pack (15 IxC)
Standard entry-level pack — 5 cards with standard odds: Common 65%, Uncommon 25%, Rare 7%, Ultra Rare 2%, Epic 0.9%, Legendary 0.1%.

#### Premium Pack (35 IxC)
Improved odds — 5 cards: Common 50%, Uncommon 30%, Rare 15%, Ultra Rare 3.5%, Epic 1.3%, Legendary 0.2%.

#### Elite Pack (75 IxC)
Guaranteed Rare+ — 5 cards: Common 30%, Uncommon 35%, Rare 25%, Ultra Rare 7%, Epic 2.5%, Legendary 0.5%. At least 1 Rare or better guaranteed.

#### Themed Packs (50 IxC)
Region, era, or type-specific card pools (e.g., "Sarpedon Regional Pack"). Standard odds with a theme filter applied.

#### Seasonal Packs (60 IxC)
Time-limited releases with enhanced odds and purchase limits (e.g., max 10 per user).

#### Event Packs (100 IxC)
Limited quantity exclusives (e.g., only 1,000 available, max 3 per user).

### Pack Opening Flow

The pack opening experience consists of 4 stages:

1. **Pack Reveal (1.5s)** — Pack appears with pulsing glow, "Tap to Open" prompt
2. **Pack Explosion (0.8s)** — Particle effects, pack model shatters, cards fly into view
3. **Card Reveal (0.8s per card)** — Cards flip one-by-one with rarity-specific sound effects
4. **Quick Actions** — Junk/Keep/List buttons, collection stats update, bonus credits notification

### Bonus Mechanics

- **Lucky Pack**: 10% chance when opening any pack, awards 5-50 bonus IxC
- **First Pack of Day**: +2 IxC for opening first pack each day
- **Weekly Streak**: Open 10 packs in 1 week for +25 IxC bonus

### Purchase Validation

Before purchase, the system validates:
- Pack is available (not deactivated)
- Pack has not expired
- User hasn't exceeded purchase limit
- Pack hasn't sold out (limited quantity)
- User has sufficient IxCredits balance

### Anti-Duplicate Logic

Within a single pack, no duplicate cards are generated. After 10 retry attempts, the system falls back to allow duplicates if no unique card can be found.

### Admin Pack Operations

- `createPack` — Create new pack with validated odds (must sum to 100%)
- `updatePack` — Toggle availability
- `deactivatePack` — Deactivate pack
- Pack analytics: total purchased, opened, unopened, revenue

### Pack DB Schema

```prisma
model CardPack {
  id              String      @id @default(cuid())
  name            String
  cardCount       Int         @default(5)
  packType        PackType    // BASIC, PREMIUM, ELITE, THEMED, SEASONAL, EVENT
  priceCredits    Float
  commonOdds      Float       @default(65)
  uncommonOdds    Float       @default(25)
  rareOdds        Float       @default(7)
  ultraRareOdds   Float       @default(2)
  epicOdds        Float       @default(0.9)
  legendaryOdds   Float       @default(0.1)
  season          Int?
  cardType        CardType?
  themeFilter     Json?
  isAvailable     Boolean     @default(true)
  limitedQuantity Int?
  purchaseLimit   Int?
  expiresAt       DateTime?
  owners          UserPack[]
  @@map("card_packs")
}
```

## Phase 1 Implementation Status

> Merged from `docs/development/ixcards-phase1.md` (Phase 1 foundation deliverables). Date: November 2025. Status: Complete.

### Completed Deliverables

- Database schema design (9 models: MyVault, Card, CardPack, CardOwnership, VaultTransaction, UserPack, CardCollection, CardAuction, CardTrade)
- Service layer architecture (VaultService, CardService, PackService, NSIntegrationService)
- tRPC API design (23 endpoints across 4 routers: vault 7, cards 6, cardPacks 7, nsIntegration 3)
- Comprehensive documentation (4 system docs: myvault, cards, card-packs, ns-integration)
- API reference documentation
- Integration point specifications (MyCountry Dashboard, Diplomacy, Economy, Intelligence, Achievements, ThinkPages, Profile)

### Integration Points Specified

**MyCountry Dashboard**: New MyVault navigation card, IxCredits balance display, quick actions (Open Pack, Visit Market).

**Diplomacy System**: Mission completion rewards (3-15 IxC), embassy partner card trading, diplomatic event rewards.

**Economy System**: Nation performance → card value correlation, budget allocation → vault income multiplier, GDP metrics → card stat calculations.

**Achievement System**: Dual rewards (badges + IxCredits), special card rewards for milestones, collection completion achievements.

### Key Features Designed

**IxCredits Economy**: Passive nation income (GDP-based), active gameplay rewards, card activities, social engagement. Spending sinks: card packs (15-200 IxC), market fees, enhancements, boosts, cosmetics.

**Card Types**: NATION (auto-generated from IxStats nations, dynamic stats), LORE (from IxWiki/IIWiki), NS_IMPORT (from NationStates card dump), SPECIAL (events, milestones, community).

**Pack Mechanics**: Basic/Premium/Elite/Themed/Seasonal/Event packs with configurable rarity odds.

### Next Phase (Phase 2)

Backend implementation: database migration, service layer implementation, tRPC router implementation, NS API client setup, frontend components (MyVault dashboard, card display, pack opening, MyCards inventory).

## See Also

- [MyVault System](./myvault.md) - IxCredits economy and earning mechanics (both part of IxVault)
- [NationStates Integration](./ns-integration.md) - NS card import and sync
- [API Reference](../reference/api-complete.md#cards-router) - Complete endpoint documentation
- [Database Reference](../reference/database.md) - Full schema documentation
