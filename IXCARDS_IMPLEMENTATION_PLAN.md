# IxCards Trading Card System - Enhanced Implementation Plan v3

> **📋 Branding:** See `IXCARDS_BRANDING_SYSTEM.md` for complete terminology guidelines

## 🏷️ Terminology Quick Reference

| Concept | Official Name | Common Usage | Abbreviated |
|---------|---------------|--------------|-------------|
| Overall System | **MyVault** | "your vault" | - |
| Currency | **IxCredits** | "credits" | **IxC** |
| Card System | IxCards | "Cards" or "MyCards" | - |
| Marketplace | Card Market | "market" | - |
| Collections | MyCollections | "collections" | - |

---

## 🎯 Core Vision
A **symbiotic ecosystem** where Cards and IxStats enhance each other:
- IxStats users earn rewards for existing gameplay → spend IxCredits in MyVault
- Card-only users get gradual exposure to IxStats features through MyVault
- Cards create new reasons to engage with diplomacy, economy, social systems
- Native integration via MyVault while maintaining standalone viability

---

## 💰 MyVault Economy - Deep Mechanics

### Multi-Path Earning System

#### 1. **Passive Income (Nation-Based)**
Rewards nation ownership without forced engagement:

**Daily Dividend System:**
- Base rate: `(GDP Per Capita / 10000) * Economic Tier Multiplier`
- Economic Tier multipliers: Tier 1 (3x), Tier 2 (2x), Tier 3 (1.5x), Tier 4 (1x)
- Population bonus: +0.01 IxCredits per 1M citizens
- Growth bonus: +10% dividend if GDP growth > 3% this quarter

**National Card Royalties:**
- Earn 2% of any transaction involving YOUR nation's card
- Creates incentive to improve your nation (increases card value)
- Passive income even while offline

**Example:** Nation with $45K GDP/capita, Tier 2, 25M pop, 4% growth
- Daily dividend: (45000/10000) * 2 = 9 IxCredits
- Population bonus: 25 * 0.01 = 0.25 IxCredits
- Growth bonus: 9 * 1.1 = 9.9 IxCredits
- **Total: ~10 IxCredits/day passive**

#### 2. **Active Gameplay Rewards**
Incentivize daily engagement across ALL IxStats systems:

**Daily Activities:**
- Login streak: 1 IxC (day 1) → 10 IxC (day 7+), resets if missed
- Answer 1 crisis event: 5 IxC
- Complete 1 diplomatic mission: 3-15 IxC (based on difficulty)
- Make 1 economic decision: 2 IxC
- Post on ThinkPages: 1 IxC (max 5/day)
- React/comment on ThinkPages: 0.5 IxC (max 3/day)

**Milestone Bonuses:**
- Unlock achievement: 10-100 IxC (based on rarity)
- Establish new embassy: 15 IxC
- Complete budget allocation: 5 IxC
- Intelligence briefing review: 3 IxC
- Attend cabinet meeting: 8 IxC

**Competitive Rewards:**
- Top 10 leaderboard (any category): 50 IxC/day
- Top 100: 10 IxC/day
- Win ThinkTank debate: 20 IxC

#### 3. **Card-Specific Earnings**
Make cards themselves a source of income:

**Pack Opening:**
- 10% chance of "lucky pack" bonus: +5-50 IxC
- First pack of day: +2 IxC
- Open 10 packs in 1 week: +25 IxC bonus

**Collection Milestones:**
- Complete rarity set (all commons): 50 IxC
- Complete season set: 500 IxC
- Complete themed collection (e.g., "All Tier 1 Nations"): 100-1000 IxC
- Own all cards from 1 region: 200 IxC

**Market Activity:**
- Successful auction (as seller): 1% of sale price as IxC bonus
- Market maker bonus: Trade 100+ cards/week → 50 IxC
- Auction snipe: Successfully snipe card → 3 IxC
- Bank transfer heist: Successfully heist → 10% bonus IxC

**Daily Deck Value Appreciation:**
- If your deck value increases: +1 IxC per 100 value gained
- Incentivizes smart trading/collecting

#### 4. **Social & Collaborative**
Reward community engagement:

**Generosity System:**
- Gift card to another player: +1 IxC (sender) + 0.5 IxC (recipient)
- Max 10/day to prevent abuse
- Creates positive social dynamics

**Trading Network:**
- Complete peer-to-peer trade: +2 IxC (both parties)
- Positive trade review from partner: +3 IxC
- Host public trade session: +10 IxC

**Tournaments & Events:**
- Weekly card battle tournament entry: 10 IxC
- Win tournament: 100-1000 IxC (prize pool)
- Participate in seasonal events: 25-500 IxC

**Teaching Bonus:**
- Referred player opens first pack: +50 IxC
- Referred player completes first collection: +100 IxC

### Spending Sinks (Balanced Economy)

#### 1. **Core Card Operations**
- **Card Packs:**
  - Basic Pack (5 cards): 15 IxC
  - Premium Pack (5 cards, better odds): 35 IxC
  - Elite Pack (5 cards, guaranteed rare+): 75 IxC
  - Themed Packs (region/era specific): 50 IxC

- **Market Fees:**
  - Auction listing: 0.5 IxC
  - Express auction (30-min instead of 60-min): 5 IxC
  - Featured listing (top of marketplace): 10 IxC

- **Deck Management:**
  - Deck expansion: 1² IxC (1, 4, 9, 16, 25...)
  - Deck reorganization slots: 5 IxC per extra slot
  - Collection showcase slots: 20 IxC per slot

#### 2. **Card Enhancement System**
- **Crafting:**
  - Basic craft (2 commons → 1 uncommon): 5 IxC
  - Advanced craft (3 same cards → higher rarity): 25 IxC
  - Special edition craft: 100 IxC

- **Card Evolution:**
  - Level up card (better stats/art): 10-50 IxC per level
  - Unlock alternate artwork: 30 IxC
  - Add animated effects: 50 IxC

- **Card Insurance:**
  - Protect card from battle loss (1 week): 10 IxC
  - Full deck insurance: 50 IxC/week

#### 3. **Cross-Platform Benefits** (Bridge to IxStats)
- **Diplomatic Boosts:**
  - Increase mission success rate (+10%): 25 IxC
  - Instant embassy upgrade: 40 IxC
  - Rush cultural exchange: 30 IxC

- **Economic Advantages:**
  - Accelerate economic calculation: 20 IxC
  - Unlock premium economic model: 100 IxC (one-time)
  - GDP growth boost (+0.1% for 1 quarter): 35 IxC

- **Intelligence Premium:**
  - Unlock advanced analytics: 50 IxC/month
  - AI-powered forecasting: 75 IxC/month
  - Competitor intelligence reports: 15 IxC each

- **Social Features:**
  - ThinkPages premium themes: 25 IxC
  - Pin post to top: 10 IxC
  - Boost post visibility: 15 IxC

#### 4. **Cosmetic & Prestige**
- **Visual Customization:**
  - Custom card backs: 40 IxC each
  - Holographic effects: 60 IxC
  - Custom frames: 30 IxC
  - Collection display themes: 50 IxC

- **Profile Enhancements:**
  - Profile badges: 20 IxC each
  - Custom profile effects: 45 IxC
  - Showcase featured cards: 25 IxC

- **Exclusive Access:**
  - Early access to new seasons: 150 IxC
  - Limited edition packs: 200 IxC
  - Special event participation: 50-100 IxC

### Economy Balancing Mechanisms

**Daily Earning Caps:**
- Passive income: Unlimited (rewards nation building)
- Active gameplay: 100 IxC/day cap
- Card trading: Unlimited (rewards market activity)
- Social: 50 IxC/day cap

**Inflation Control:**
- Weekly MyVault economy audit: Monitor money supply
- Dynamic pack pricing (adjusts based on economy)
- Auction fees (10% on sales >100 IxC)
- Junk value adjustments per season

**Scarcity Mechanics:**
- Limited edition cards (1000 copies max)
- Seasonal exclusives (only available during event)
- Crafting failures (80% success rate on advanced crafts)
- Random pack contents (no guaranteed outcomes except Elite)

---

## 🔗 Native IxStats Integration Strategy

### Three-Tier User Model

#### **Tier 1: Card-Only Users (Entry Point)**
**Goal:** Let them enjoy cards immediately, gently expose IxStats

**Experience:**
- Can create account and start opening free starter pack
- Earn IxCredits through card activities only (limited rates)
- See "Nation Bonus Available" prompts in UI
- Collection includes placeholder for "Your Nation Card" (grayed out)
- Market shows nation cards with economic data tooltips

**Conversion Hooks:**
- "Create your nation to unlock 10x daily IxCredits income"
- "Nations with embassies earn bonus IxCredits from diplomatic cards"
- "Unlock your nation card by building your country"
- Weekly notification: "Card collectors with nations earn 5x more IxCredits"

#### **Tier 2: IxStats Users (Existing Players)**
**Goal:** Cards enhance existing gameplay, not distract

**Experience:**
- Automatically receive starter pack on first login to MyVault
- Earn IxCredits passively from nation performance
- Notifications: "New achievement unlocked: +50 IxC to spend on cards"
- MyVault section in MyCountry dashboard (optional nav card)
- Can ignore cards entirely (IxCredits accumulate anyway)

**Integration Points:**
- Daily IxCredits summary in MyCountry overview
- "Spend IxCredits" quick action buttons (boost missions, etc.)
- Collection showcase in nation profile
- Diplomatic cards appear when viewing embassies

#### **Tier 3: Hybrid Power Users (Ultimate Goal)**
**Goal:** Deep engagement across entire platform

**Experience:**
- Using cards to min/max IxStats gameplay
- Using IxStats success to dominate card economy
- Hosting card tournaments via ThinkShare
- Trading exclusive cards through diplomatic channels
- Creating themed collections tied to geopolitical narratives

### System-Specific Integration

#### **MyCountry Dashboard**
**New Nav Card:** "MyVault" (collapsible, bottom of stack)
- Quick stats: IxCredits balance, deck value, unopened packs
- "Open Pack" button
- Daily IxCredits earnings summary
- Link to full MyVault interface

**Overview Tab - MyVault Widget:**
- Current IxCredits balance with sparkline trend
- Today's earnings breakdown
- Quick actions: "Open Pack", "Visit Card Market", "Boost Mission"

#### **Diplomacy System**
**Embassy Network Integration:**
- Each embassy shows "Trade Cards" button
- "Diplomatic Card Exchange" mission type:
  - Success: Both nations receive themed card pack
  - Builds relationship + card rewards

**Mission Rewards:**
- All missions now award IxCredits (3-15 based on difficulty)
- Special "Collector's Mission" type:
  - Objective: "Trade 5 cards with embassy partners"
  - Reward: Exclusive diplomatic card pack

**Diplomatic Events:**
- Responding to scenarios awards IxCredits
- Positive outcomes grant themed card (e.g., "Peace Treaty Card")

#### **Intelligence System**
**New Analytics Tab:** "Card Economy Intelligence"
- Market trends (which cards appreciating)
- Competitor deck analysis
- Recommended trades based on your nation's strengths
- "Cards of nations with similar profiles to yours"

**Briefings Integration:**
- Weekly briefing includes card market summary
- "Your nation card value: +15% this week"
- Competitor analysis includes card holdings

#### **Economy System**
**Economic Performance → Card Value:**
- Your nation card's market value tied to GDP/growth
- Strong economy = higher demand for your card = royalties
- Economic milestones unlock card rewards:
  - Hit $50K GDP/capita: Unlock elite economic pack
  - Reach Tier 1: Receive legendary nation card variant

**Budget Allocation:**
- New budget category: "MyVault Development Fund"
- Allocate budget → boosts IxCredits passive income rate

#### **Social Platform (ThinkPages/ThinkShare)**
**Card Trading Posts:**
- New post type: "Card Trade Offer"
- Inline card previews in posts
- React with "Want" → creates trade interest notification

**ThinkTanks Integration:**
- Create card-themed research groups
- "Best Economic Cards Tier List"
- Collaborative collection goals

**Activity Feed:**
- "User X pulled a Legendary card!"
- "User Y completed the Season 1 collection!"
- Card achievements appear in feed

#### **Achievement System**
**Card-Specific Achievements:**
- Integrated into existing achievement system
- Each achievement awards IxCredits
- Special card rewards for meta-achievements
  - Unlock 100 achievements → Exclusive "Achievement Hunter" card

**Dual Rewards:**
- Existing achievements now also grant IxCredits
- Card achievements also grant traditional achievement badges
- Creates unified progression system

#### **Defense System**
**Card Battles (Optional PvP Mode):**
- Use nation stats from Defense system as card battle power
- Military strength, readiness → battle card stats
- Win battles → earn IxCredits + keep opponent's card (if wagered)

**Crisis Events:**
- Successfully handle crisis → exclusive crisis card
- Crisis cards tradeable, collectible
- "Survived 2030 Economic Crisis" card

---

## 🃏 Card Generation & Content Pipeline

### Multi-Source Card Types

#### **1. IxStats Nation Cards (Dynamic)**
**Generation:**
- Automatically created when nation is founded
- Updates nightly with current stats
- Historical variants created each quarter

**Card Data:**
- **Front:** Flag, coat of arms, nation name, motto
- **Stats:**
  - Economic Power: GDP-based (0-100)
  - Diplomatic Influence: Embassy count + relationships (0-100)
  - Military Strength: Defense metrics (0-100)
  - Social Vitality: ThinkPages engagement (0-100)
- **Rarity:** Based on nation performance metrics
  - Common: New nations, Tier 4 economies
  - Uncommon: Tier 3, some achievements
  - Rare: Tier 2, active diplomacy
  - Ultra-Rare: Tier 1, top 100 leaderboard
  - Epic: Top 10 in any category
  - Legendary: Founders, top 3 nations, special status

**Dynamic Mechanics:**
- Card stats update weekly
- Special variants for milestones:
  - "GDP Titan" variant at $100K per capita
  - "Diplomatic Master" at 25+ embassies
  - "Social Icon" at 10K+ ThinkPages followers

#### **2. Wiki Lore Cards (Historical)**
**Source:** IxWiki/IIWiki articles via enhanced wiki fetcher

**Generation Service:**
```typescript
// Conceptual flow
async function generateLoreCard() {
  // 1. Fetch random article with quality filters
  const article = await fetchRandomWikiArticle({
    minLength: 5000,
    hasInfobox: true,
    hasImages: true,
    categories: ['History', 'Geography', 'People', 'Events']
  });

  // 2. Extract card metadata
  const metadata = {
    title: article.title,
    description: await summarizeArticle(article.text, 200),
    imageUrl: selectBestImage(article.images),
    category: determineCardCategory(article),
    stats: generateLoreStats(article),
    rarity: calculateLoreRarity(article)
  };

  // 3. Create card in database
  return await createCard(metadata);
}
```

**Lore Card Categories:**
- **Historical Figures:** Leaders, scientists, artists
- **Geographical Locations:** Cities, landmarks, regions
- **Historical Events:** Wars, treaties, discoveries
- **Cultural Artifacts:** Art, literature, traditions
- **Legendary Items:** Mythical objects, symbols

**Stats:**
- **Historical Significance:** Article length + references (0-100)
- **Cultural Impact:** Cross-references + article age (0-100)
- **Rarity:** Based on article uniqueness (0-100)

**Daily Generation:**
- 10 new lore cards/day (varied categories)
- Featured article of the week → guaranteed legendary
- User-requested articles → 50 IxC to generate

#### **3. NationStates Cards (Imported)**
**NS API Integration:**

**Daily Sync Service:**
```typescript
// Fetch NS card daily dump
async function syncNSCards() {
  const dumpUrl = `https://www.nationstates.net/pages/cardlist_S${currentSeason}.xml.gz`;
  const cardData = await fetchAndDecompress(dumpUrl);

  // Parse and store in database
  for (const nsCard of cardData) {
    await db.card.upsert({
      where: { nsCardId: nsCard.id, season: nsCard.season },
      update: {
        // NS cards are immutable, but we track our metadata
        ixstatsEnhancements: {
          pullCount: increment(1),
          lastPulled: new Date()
        }
      },
      create: {
        nsCardId: nsCard.id,
        season: nsCard.season,
        title: nsCard.nation,
        rarity: nsCard.rarity,
        artwork: nsCard.flag,
        cardType: 'NS_IMPORT',
        metadata: nsCard
      }
    });
  }
}
```

**User Collection Import:**
```typescript
// OAuth with NS, import user's deck
async function importNSCollection(userId: string, nsNation: string) {
  // 1. Verify NS nation ownership via Verification API
  const verified = await verifyNSOwnership(nsNation);

  // 2. Fetch NS deck
  const nsDeck = await fetchNSDeck(nsNation);

  // 3. Create IxCards equivalents
  for (const card of nsDeck.cards) {
    await createCardOwnership({
      userId,
      cardId: findOrCreateNSCard(card),
      quantity: card.count,
      acquiredMethod: 'NS_IMPORT',
      metadata: { originalNS: true }
    });
  }

  // 4. Award import bonus
  await awardIxCredits(userId, 100, 'NS_COLLECTION_IMPORT');
}
```

**NS Market Watch:**
- Hourly sync of NS auction data
- Track price trends
- Alert users to arbitrage opportunities
- "NS Card of the Hour" featured listings

#### **4. Special Edition Cards**
**Event Cards:**
- IxStats platform milestones
  - "IxStats v2.0 Launch" card
  - "100K Users" commemorative

**Seasonal Cards:**
- Holiday exclusives (limited time)
- Quarterly season cards
- Anniversary editions

**Community Cards:**
- Top contributors/moderators
- Contest winners
- User-submitted designs (moderated)

**Collaborative Cards:**
- ThinkTank group achievements
- Diplomatic alliance commemoratives
- Economic bloc special editions

### Rarity Algorithm

**Base Rarity Calculation:**
```typescript
function calculateCardRarity(card: CardInput): Rarity {
  let rarityScore = 0;

  // For nation cards
  if (card.type === 'NATION') {
    rarityScore += card.economicTier * 20; // Tier 1 = 20 points
    rarityScore += card.leaderboardRank ? (1000 - card.leaderboardRank) / 10 : 0;
    rarityScore += card.achievementCount * 2;
    rarityScore += card.embassyCount * 3;
    rarityScore += card.accountAge > 365 ? 15 : 0; // Veteran bonus
  }

  // For lore cards
  if (card.type === 'LORE') {
    rarityScore += card.articleLength / 100;
    rarityScore += card.referenceCount * 5;
    rarityScore += card.isFeatured ? 50 : 0;
  }

  // For NS cards
  if (card.type === 'NS_IMPORT') {
    rarityScore = NS_RARITY_MAP[card.nsRarity]; // Use NS rarity
  }

  // Map score to rarity tiers
  if (rarityScore >= 90) return 'LEGENDARY';
  if (rarityScore >= 70) return 'EPIC';
  if (rarityScore >= 50) return 'ULTRA_RARE';
  if (rarityScore >= 30) return 'RARE';
  if (rarityScore >= 15) return 'UNCOMMON';
  return 'COMMON';
}
```

---

## 🎨 Premium UI/UX Components

### Card Display Technology Stack

**Component Hierarchy:**
```
<CardDisplaySystem>
  ├─ <CardGallery> (Grid/Carousel/3D modes)
  │   ├─ <CardContainer3D> (from 3d-card.tsx)
  │   │   └─ <CardBody>
  │   │       ├─ <CometCard> (holographic effects)
  │   │       │   └─ <DraggableCardBody> (physics)
  │   │       │       └─ <GlassCard> (glass physics layer)
  │   │       │           └─ <CardContent> (actual card data)
  │   └─ <CardDetailsModal> (expanded view)
  └─ <PackOpeningExperience>
      ├─ <PackRevealAnimation>
      ├─ <CardFlipSequence>
      └─ <RarityReveal> (particle effects)
```

**Glass Physics Integration:**
```typescript
// Card component using IxStats glass system
<GlassCard
  depth="child" // Glass hierarchy
  className="relative aspect-[2.5/3.5] rounded-xl overflow-hidden"
  glowColor={RARITY_COLORS[card.rarity]}
>
  <CometCard rotateDepth={15} translateDepth={25}>
    <DraggableCardBody className="card-draggable">
      <CardContent card={card} />

      {/* Rarity indicator with glass effect */}
      <RarityBadge
        rarity={card.rarity}
        className="absolute top-2 right-2"
        animated
      />

      {/* Holographic overlay for rare+ */}
      {card.rarity >= 'RARE' && (
        <HolographicOverlay
          pattern={card.holographicPattern}
          intensity={RARITY_INTENSITY[card.rarity]}
        />
      )}
    </DraggableCardBody>
  </CometCard>
</GlassCard>
```

### Pack Opening Cinematic

**Animation Sequence:**
1. **Pack appears** (3D rendered, pulsing glow)
2. **Tap to open** (haptic feedback, sound effect)
3. **Pack explodes** (particle effects, cards fly out)
4. **Cards flip one-by-one** (suspenseful 0.8s delay each)
5. **Rarity reveal** (color flash, unique sound per rarity)
6. **Quick actions** (Junk/Keep/List buttons appear)

**Implementation:**
```typescript
<PackOpeningSequence pack={pack} onComplete={handleComplete}>
  <Stage1_PackReveal
    duration={1500}
    glowColor={pack.tierColor}
  />

  <Stage2_PackExplosion
    particleCount={50}
    explosionForce={2.5}
    duration={800}
  />

  <Stage3_CardReveal
    cards={pack.cards}
    revealDelay={800}
    flipDuration={600}
    onCardReveal={(card, index) => {
      playSound(RARITY_SOUNDS[card.rarity]);
      triggerHaptic(RARITY_HAPTICS[card.rarity]);
    }}
  />

  <Stage4_QuickActions
    cards={pack.cards}
    onJunk={handleJunk}
    onKeep={handleKeep}
    onList={handleList}
  />
</PackOpeningSequence>
```

### Marketplace Interface

**Real-Time Auction Feed:**
```typescript
<AuctionFeed>
  {/* Live countdown timers using IxTime */}
  <AuctionCard
    auction={auction}
    countdown={<IxTimeCountdown targetTime={auction.endsAt} />}
    onBid={handleBid}
    snipeWarning={auction.endsIn < 60} // Warning if <1 min
  />

  {/* Market analytics with glass charts */}
  <MarketAnalytics>
    <GlassChart type="line" data={priceHistory} />
    <TrendingCards limit={5} />
    <MarketSentiment />
  </MarketAnalytics>

  {/* Advanced filters */}
  <FilterPanel>
    <RarityFilter />
    <TypeFilter />
    <PriceRangeFilter />
    <StatRangeFilter />
    <SeasonFilter />
  </FilterPanel>
</AuctionFeed>
```

### Collection Showcase

**Multiple View Modes:**
- **Grid:** Dense, hover for details
- **Carousel:** Apple-style card carousel (use apple-cards-carousel.tsx)
- **3D Gallery:** Floating cards in 3D space
- **Stats Dashboard:** Analytics focus

**Public Sharing:**
```typescript
// Shareable collection URL
`/cards/@${username}/${collectionSlug}`

<CollectionShowcase
  collection={collection}
  theme={collection.theme} // Glass theme variants
  viewMode={viewMode}
  isPublic={collection.isPublic}
>
  <CollectionStats deckValue={deckValue} completion={completion} />
  <CardGrid cards={collection.cards} sortBy={sortBy} />
  <SimilarCollections /> {/* Recommendation engine */}
</CollectionShowcase>
```

---

## 📊 Database Schema (Enhanced)

### Core Models

```prisma
model Card {
  id                String          @id @default(cuid())
  title             String
  description       String?
  artwork           String          // Image URL
  artworkVariants   Json?           // Alternate art unlocks
  cardType          CardType        // NATION, LORE, NS_IMPORT, SPECIAL
  rarity            CardRarity
  season            Int

  // NS Integration
  nsCardId          Int?            @unique
  nsSeason          Int?
  nsData            Json?           // Original NS card data

  // Wiki Integration
  wikiSource        String?         // 'ixwiki' | 'iiwiki'
  wikiArticleTitle  String?
  wikiUrl           String?

  // IxStats Integration
  countryId         String?         // If nation card
  country           Country?        @relation(fields: [countryId], references: [id])

  // Stats (for battles/display)
  stats             Json            // { economic: 85, diplomatic: 72, ... }

  // Metadata
  totalSupply       Int             @default(0) // How many in circulation
  marketValue       Float           @default(0) // Current market price
  lastTrade         DateTime?

  // Evolution/Enhancement
  level             Int             @default(1)
  evolutionStage    Int             @default(0)
  enhancements      Json?           // Applied upgrades

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
  NATION          // IxStats nation
  LORE            // Wiki article
  NS_IMPORT       // NationStates card
  SPECIAL         // Limited edition/event
  COMMUNITY       // User-submitted
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
  acquiredMethod    AcquireMethod   // PACK, TRADE, AUCTION, CRAFT, GIFT, NS_IMPORT

  // Enhancement tracking
  isLeveledUp       Boolean         @default(false)
  hasAlternateArt   Boolean         @default(false)
  customizations    Json?

  // Protection
  isInsured         Boolean         @default(false)
  insuranceExpiry   DateTime?
  isLocked          Boolean         @default(false) // Prevent accidental junk/trade

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

model MyVault {
  id                String              @id @default(cuid())
  userId            String              @unique
  user              User                @relation(fields: [userId], references: [id])

  credits           Float               @default(0)        // IxCredits balance
  lifetimeEarned    Float               @default(0)        // Total earned
  lifetimeSpent     Float               @default(0)        // Total spent

  // Daily tracking
  todayEarned       Float               @default(0)
  lastDailyReset    DateTime            @default(now())

  // Streak tracking
  loginStreak       Int                 @default(0)
  lastLoginDate     DateTime?

  // Progression
  vaultLevel        Int                 @default(1)
  vaultXp           Int                 @default(0)

  // Premium status
  premiumUntil      DateTime?
  premiumMultiplier Float               @default(1.0)

  transactions      VaultTransaction[]

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@map("my_vault")
}

model VaultTransaction {
  id          String              @id @default(cuid())
  vaultId     String
  vault       MyVault             @relation(fields: [vaultId], references: [id])

  credits     Float               // Amount (+ or -)
  balanceAfter Float              // Balance after transaction
  type        VaultTransactionType
  source      String              // "DAILY_LOGIN", "ACHIEVEMENT_UNLOCK", "PACK_PURCHASE", etc.
  metadata    Json?               // Additional context

  createdAt   DateTime            @default(now())

  @@index([vaultId, createdAt])
  @@index([type])
  @@map("vault_transactions")
}

enum VaultTransactionType {
  EARN_PASSIVE
  EARN_ACTIVE
  EARN_CARD
  EARN_SOCIAL
  SPEND_PACKS
  SPEND_MARKET
  SPEND_CRAFT
  SPEND_BOOST
  SPEND_COSMETIC
  ADMIN_ADJUSTMENT
}

model CardPack {
  id              String      @id @default(cuid())
  name            String
  description     String?
  artwork         String

  // Pack configuration
  cardCount       Int         @default(5)
  packType        PackType
  priceCredits    Float       // Price in IxCredits

  // Rarity odds (percentages, must sum to 100)
  commonOdds      Float       @default(65)
  uncommonOdds    Float       @default(25)
  rareOdds        Float       @default(7)
  ultraRareOdds   Float       @default(2)
  epicOdds        Float       @default(0.9)
  legendaryOdds   Float       @default(0.1)

  // Constraints
  season          Int?        // Season-specific pack
  cardType        CardType?   // Type-specific pack (e.g., LORE only)
  themeFilter     Json?       // { region: "Sarpedon", era: "Modern" }

  // Availability
  isAvailable     Boolean     @default(true)
  limitedQuantity Int?        // Null = unlimited
  purchaseLimit   Int?        // Per user
  expiresAt       DateTime?

  // User ownership
  owners          UserPack[]

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("card_packs")
}

enum PackType {
  BASIC
  PREMIUM
  ELITE
  THEMED
  SEASONAL
  EVENT
}

model UserPack {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  packId    String
  pack      CardPack  @relation(fields: [packId], references: [id])

  isOpened  Boolean   @default(false)
  openedAt  DateTime?

  acquiredDate DateTime @default(now())
  acquiredMethod String // "PURCHASE", "REWARD", "GIFT"

  @@index([userId, isOpened])
}

model CardAuction {
  id            String      @id @default(cuid())
  cardId        String
  card          Card        @relation(fields: [cardId], references: [id])
  sellerId      String
  seller        User        @relation("SellerAuctions", fields: [sellerId], references: [id])

  askPrice      Float       // Seller's asking price
  currentBid    Float?      // Current highest bid
  currentBidderId String?
  currentBidder User?       @relation("BidderAuctions", fields: [currentBidderId], references: [id])

  buyoutPrice   Float?      // Optional instant buy

  // Auction mechanics
  startsAt      DateTime    @default(now())
  endsAt        DateTime    // 60 min from start, +1 min on each bid
  status        AuctionStatus @default(ACTIVE)

  // Features
  isFeatured    Boolean     @default(false)
  isExpress     Boolean     @default(false) // 30-min auction

  // Result
  finalPrice    Float?
  winnerId      String?
  winner        User?       @relation("WonAuctions", fields: [winnerId], references: [id])

  // History
  bids          AuctionBid[]

  createdAt     DateTime    @default(now())
  completedAt   DateTime?

  @@index([status, endsAt])
  @@index([cardId])
  @@index([sellerId])
}

enum AuctionStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

model AuctionBid {
  id          String      @id @default(cuid())
  auctionId   String
  auction     CardAuction @relation(fields: [auctionId], references: [id])
  bidderId    String
  bidder      User        @relation(fields: [bidderId], references: [id])

  amount      Float
  timestamp   DateTime    @default(now())
  wasSnipe    Boolean     @default(false) // Bid in last 60 seconds

  @@index([auctionId, timestamp])
  @@index([bidderId])
}

model CardTrade {
  id              String        @id @default(cuid())
  senderId        String
  sender          User          @relation("SentTrades", fields: [senderId], references: [id])
  receiverId      String
  receiver        User          @relation("ReceivedTrades", fields: [receiverId], references: [id])

  offeredCards    Json          // [{ cardId, quantity }]
  requestedCards  Json          // [{ cardId, quantity }]
  creditsOffer    Float?        // Optional IxCredits sweetener

  status          TradeStatus   @default(PENDING)
  message         String?       // Trade proposal message

  createdAt       DateTime      @default(now())
  respondedAt     DateTime?
  expiresAt       DateTime      // Auto-reject after 48 hours

  @@index([senderId, status])
  @@index([receiverId, status])
  @@map("card_trades")
}

enum TradeStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
  EXPIRED
}

model CardCollection {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])

  name          String
  description   String?
  slug          String    @unique

  // Configuration
  isPublic      Boolean   @default(false)
  theme         String?   // Display theme
  sortOrder     String    @default("rarity_desc")

  // Content
  cardIds       Json      // Array of card IDs

  // Stats (cached)
  cardCount     Int       @default(0)
  deckValue     Float     @default(0)
  rarityBreakdown Json?   // { common: 5, rare: 2, ... }

  // Social
  views         Int       @default(0)
  likes         Int       @default(0)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId])
  @@index([isPublic])
}

model CraftingRecipe {
  id              String      @id @default(cuid())
  name            String
  description     String?

  // Inputs
  inputCards      Card[]      @relation("InputCards")
  inputRules      Json        // { rarity: "COMMON", quantity: 3 }
  creditsCost     Float       @default(0)  // IxCredits cost

  // Output
  outputCardId    String
  outputCard      Card        @relation("OutputCard", fields: [outputCardId], references: [id])

  // Mechanics
  successRate     Float       @default(1.0) // 0-1 (0.8 = 80% success)
  isRepeatable    Boolean     @default(true)

  // Availability
  isDiscovered    Boolean     @default(false) // Hidden until first craft
  requiredLevel   Int         @default(1)
  seasonExclusive Int?        // Only available in specific season

  // Usage tracking
  craftedCount    Int         @default(0)

  createdAt       DateTime    @default(now())

  @@index([isDiscovered])
  @@map("crafting_recipes")
}

// Add to existing User model
model User {
  // ... existing fields ...

  // MyVault
  vault             MyVault?

  // Cards
  cardOwnerships    CardOwnership[]
  packs             UserPack[]
  collections       CardCollection[]
  auctionsSelling   CardAuction[]    @relation("SellerAuctions")
  auctionsBidding   CardAuction[]    @relation("BidderAuctions")
  auctionsWon       CardAuction[]    @relation("WonAuctions")
  tradesSent        CardTrade[]      @relation("SentTrades")
  tradesReceived    CardTrade[]      @relation("ReceivedTrades")
  auctionBids       AuctionBid[]

  // Card stats (cached)
  totalCards        Int              @default(0)
  deckValue         Float            @default(0)
  collectorLevel    Int              @default(1)  // Collector level
  collectorXp       Int              @default(0)
}

// Add to existing Country model
model Country {
  // ... existing fields ...

  // Card relationship
  cards             Card[]
}
```

---

## 🚀 Development Phases

### Phase 1: Foundation (Weeks 1-2)
- Database migration for all card models
- MyVault service with IxCredits transaction system
- Basic card CRUD operations
- NS API client setup

### Phase 2: Pack & Market (Weeks 2-4)
- Pack opening implementation
- Auction marketplace (NS-style double auction)
- Basic UI components (card display, pack opening)
- IxCredits earning mechanics (passive + active)

### Phase 3: Integration (Weeks 4-6)
- MyCountry dashboard integration
- Achievement system integration
- Diplomatic mission rewards
- Economy → card value pipeline
- Social platform integration

### Phase 4: Advanced Features (Weeks 6-8)
- Crafting system
- Card evolution/leveling
- Collection showcase
- NS collection import
- Wiki card generation service

### Phase 5: Polish & Launch (Weeks 8-10)
- Mobile optimization
- Performance tuning (Redis caching)
- Admin tools
- Documentation
- Tutorial/onboarding flow

---

## 📈 Success Metrics

**Engagement:**
- Daily active users (DAU) increase: +30%
- Session length increase: +45%
- Return rate (7-day): +25%

**Cross-Platform:**
- Card users who create nations: 40%+
- Nation owners who try cards: 60%+
- Users engaging with 3+ systems: 35%+

**Economy Health:**
- IxCredits inflation: <10% monthly
- Market trade volume: Steady growth
- Pack opening rate: 500+/day

**Retention:**
- 30-day retention: 50%+
- 90-day retention: 30%+
- Login streak >7 days: 25%+
