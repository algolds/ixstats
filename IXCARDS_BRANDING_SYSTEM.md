# IxCards Branding & Naming System

## 🎯 Core Branding Framework

### **MyVault Personal System + IxCredits Currency**

**Philosophy:** Personal vault for collectibles with platform-wide credits

| Element | Official Name | UI Display | User-Facing Term |
|---------|---------------|------------|------------------|
| **Overall System** | MyVault | "MyVault" | "Your vault" |
| **Currency** | IxCredits | "IxCredits" or "IxC" | "credits" |
| **Card System** | IxCards | "Cards" or "MyCards" | "cards" |
| **Marketplace** | Card Market | "Card Market" | "market" |
| **Collections** | MyCollections | "MyCollections" | "collections" |
| **User Profile** | Profile (existing) | "Profile" → "Vault" tab | "your profile" |
| **Leaderboards** | Leaderboards (existing) | Add card categories | "rankings" |

---

## 📋 Terminology Guidelines

### **General Rules**

1. **"MyVault" for system-level features**
   - MyVault balance
   - MyVault Rewards
   - MyVault Events
   - MyVault Settings

2. **"IxCredits (IxC)" for currency**
   - Official: "IxCredits"
   - Abbreviated: "IxC" (in tight UI spaces)
   - Casual: "credits" (in conversational copy)

3. **"Cards" for card-related features**
   - Just "Cards" in most contexts
   - "MyCards" for personal inventory UI
   - "IxCards" only in technical/official contexts

4. **"My" prefix for personal features**
   - MyCollections (personal collections)
   - MyCards (personal inventory)
   - MyVault (personal system)

### **Capitalization**
- MyVault (always capitalized, one word)
- IxCredits (camelCase, Ix is always capitalized)
- IxC (all caps when abbreviated)
- Cards (capitalized when referring to the system)

---

## 💰 Currency: IxCredits (IxC)

### **Display Examples**

**Full Display:**
```
Balance: 1,234 IxCredits
You earned 50 IxCredits
Spend 15 IxCredits to open a pack
```

**Abbreviated Display (tight spaces):**
```
1,234 IxC
+50 IxC
-15 IxC
```

**Conversational Copy:**
```
"Earn credits by completing missions"
"Spend credits to boost your diplomatic missions"
"You need 15 credits to purchase this pack"
```

### **Transaction Types**
```typescript
enum VaultTransactionType {
  // Earning
  EARN_PASSIVE   // "Earned from nation dividends"
  EARN_ACTIVE    // "Earned from mission completion"
  EARN_CARDS     // "Earned from card pack bonus"
  EARN_SOCIAL    // "Earned from ThinkPages activity"

  // Spending
  SPEND_PACKS    // "Spent on card pack"
  SPEND_MARKET   // "Spent on market listing"
  SPEND_CRAFT    // "Spent on card crafting"
  SPEND_BOOST    // "Spent on mission boost"
  SPEND_COSMETIC // "Spent on customization"
}
```

---

## 🃏 Cards System Terminology

### **Official vs. User-Facing**

| Context | Term | Example |
|---------|------|---------|
| Technical/API | IxCards | `ixcards.ts` router |
| Database | Card | `Card` model |
| Marketing | IxCards | "Introducing IxCards!" |
| General UI | Cards | "Browse Cards" button |
| Personal UI | MyCards | "MyCards" inventory page |
| Navigation | Cards | "Cards" nav item |

### **Card Subsystems**

**Seasonal References:**
```
✅ "Season 3 Cards"
✅ "Browse Season 5 Cards"
✅ "MyCards - Season 3"
✅ "Card Season 4 Collection"
```

**Feature Names:**
```
✅ Card Market (marketplace)
✅ Card Exchange (alt name for market)
✅ Card Quests (quest system)
✅ MyCard Quests (personal quest UI)
✅ Card Packs (purchasable packs)
✅ Card Crafting (crafting system)
✅ Card Battles (PvP system)
✅ Card Events (special events)
```

**Personal Features:**
```
✅ MyCards (inventory page)
✅ MyCollections (personal collections)
✅ My Deck (current active cards)
✅ My Card History (transaction history)
```

### **Card Types - Naming Convention**

```typescript
// Database
enum CardType {
  NATION     // "Nation Card" in UI
  LORE       // "Lore Card" in UI
  NS_IMPORT  // "NationStates Card" in UI
  SPECIAL    // "Special Edition Card" in UI
  COMMUNITY  // "Community Card" in UI
}

// User-facing displays
"Nation Card: Burgundie"
"Lore Card: Battle of Cartadania"
"NationStates Card: Testlandia"
"Special Edition: IxStats Founder"
"Community Card: User Design"
```

---

## 🏛️ MyVault System Components

### **Core Features**

**MyVault Dashboard:**
- Overview of balance, recent earnings, card stats
- Quick actions (Open Pack, Visit Market, View Collections)
- Daily rewards indicator
- Vault level/progression

**MyVault Rewards:**
- Daily login bonuses
- Streak rewards
- Mission completion rewards
- Achievement rewards

**MyVault Events:**
- Limited-time card events
- Special pack releases
- Community tournaments
- Seasonal challenges

**MyVault Settings:**
- Notification preferences
- Display preferences
- Transaction history
- Privacy settings

### **Navigation Structure**

```
IxStats Main Nav
├─ MyCountry
├─ Diplomacy
├─ Intelligence
├─ [other existing items]
└─ MyVault ← NEW
    ├─ Overview (dashboard)
    ├─ MyCards (inventory)
    ├─ Card Market
    ├─ MyCollections
    ├─ Rewards
    └─ Events
```

### **Integration Points**

**Profile Page → New "Vault" Tab:**
```
Profile Tabs:
├─ Overview (existing)
├─ Activity (existing)
├─ Achievements (existing)
└─ Vault ← NEW
    ├─ Card stats
    ├─ Featured collection
    ├─ Vault level
    └─ Public collections
```

**Leaderboards → New Card Categories:**
```
Leaderboard Categories:
├─ Economic (existing)
├─ Diplomatic (existing)
├─ Military (existing)
└─ Cards ← NEW SECTION
    ├─ Highest Deck Value
    ├─ Most Cards Collected
    ├─ Season Completion %
    └─ Trading Volume
```

---

## 📊 Database Schema Naming

### **Core Models**

```prisma
// MyVault System (replaces IxBank)
model MyVault {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])

  // Currency (IxCredits)
  credits           Float    @default(0)        // Main balance
  lifetimeEarned    Float    @default(0)        // Total earned
  lifetimeSpent     Float    @default(0)        // Total spent

  // Progression
  vaultLevel        Int      @default(1)
  vaultXp           Int      @default(0)

  // Engagement tracking
  loginStreak       Int      @default(0)
  lastLoginDate     DateTime?

  // Daily caps tracking
  todayEarned       Float    @default(0)
  lastDailyReset    DateTime @default(now())

  // Relations
  transactions      VaultTransaction[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("my_vault")
}

model VaultTransaction {
  id          String              @id @default(cuid())
  vaultId     String
  vault       MyVault             @relation(fields: [vaultId], references: [id])

  credits     Float               // Amount (+ or -)
  balanceAfter Float              // Balance after transaction
  type        VaultTransactionType
  source      String              // Specific source
  metadata    Json?               // Additional context

  createdAt   DateTime            @default(now())

  @@index([vaultId, createdAt])
  @@map("vault_transactions")
}

// Card System
model Card {
  id                String          @id @default(cuid())
  title             String
  description       String?
  artwork           String
  artworkVariants   Json?

  // Card classification
  cardType          CardType
  rarity            CardRarity
  season            Int

  // Integrations
  nsCardId          Int?            @unique
  nsSeason          Int?
  wikiSource        String?
  wikiArticleTitle  String?
  countryId         String?
  country           Country?        @relation(fields: [countryId], references: [id])

  // Stats & metadata
  stats             Json
  marketValue       Float           @default(0)
  totalSupply       Int             @default(0)

  // Enhancement
  level             Int             @default(1)
  enhancements      Json?

  // Relations
  owners            CardOwnership[]
  auctions          CardAuction[]
  trades            CardTrade[]
  craftingInputs    CraftingRecipe[] @relation("InputCards")
  craftingOutputs   CraftingRecipe[] @relation("OutputCard")

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([cardType, rarity, season])
  @@index([marketValue])
  @@map("cards")
}

model CardOwnership {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  cardId          String
  card            Card          @relation(fields: [cardId], references: [id])

  quantity        Int           @default(1)
  acquiredDate    DateTime      @default(now())
  acquiredMethod  AcquireMethod

  // Enhancements
  isLeveledUp     Boolean       @default(false)
  hasAlternateArt Boolean       @default(false)
  customizations  Json?

  // Protection
  isLocked        Boolean       @default(false)

  @@unique([userId, cardId])
  @@map("card_ownership")
}

model CardPack {
  id              String      @id @default(cuid())
  name            String      // "Basic Pack", "Season 3 Elite Pack"
  description     String?
  artwork         String

  // Configuration
  cardCount       Int         @default(5)
  packType        PackType
  priceCredits    Float       // Price in IxCredits

  // Rarity distribution
  commonOdds      Float       @default(65)
  uncommonOdds    Float       @default(25)
  rareOdds        Float       @default(7)
  ultraRareOdds   Float       @default(2)
  epicOdds        Float       @default(0.9)
  legendaryOdds   Float       @default(0.1)

  // Constraints
  season          Int?
  cardType        CardType?
  themeFilter     Json?

  // Availability
  isAvailable     Boolean     @default(true)
  limitedQuantity Int?
  purchaseLimit   Int?        // Per user
  expiresAt       DateTime?

  owners          UserPack[]

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("card_packs")
}

model UserPack {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  packId          String
  pack            CardPack    @relation(fields: [packId], references: [id])

  isOpened        Boolean     @default(false)
  openedAt        DateTime?

  acquiredDate    DateTime    @default(now())
  acquiredMethod  String      // "PURCHASE", "REWARD", "EVENT"

  @@index([userId, isOpened])
  @@map("user_packs")
}

model CardCollection {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])

  name            String      // "Season 1 Complete", "Tier 1 Nations"
  description     String?
  slug            String      @unique

  // Display
  isPublic        Boolean     @default(false)
  theme           String?
  sortOrder       String      @default("rarity_desc")

  // Content
  cardIds         Json        // Array of card IDs

  // Cached stats
  cardCount       Int         @default(0)
  deckValue       Float       @default(0)
  rarityBreakdown Json?

  // Social
  views           Int         @default(0)
  likes           Int         @default(0)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("card_collections")
}

model CardAuction {
  id              String        @id @default(cuid())
  cardId          String
  card            Card          @relation(fields: [cardId], references: [id])
  sellerId        String
  seller          User          @relation("SellerAuctions", fields: [sellerId], references: [id])

  // Pricing (in IxCredits)
  askPrice        Float
  currentBid      Float?
  currentBidderId String?
  currentBidder   User?         @relation("BidderAuctions", fields: [currentBidderId], references: [id])
  buyoutPrice     Float?

  // Timing
  startsAt        DateTime      @default(now())
  endsAt          DateTime
  status          AuctionStatus @default(ACTIVE)

  // Features
  isFeatured      Boolean       @default(false)
  isExpress       Boolean       @default(false)

  // Results
  finalPrice      Float?
  winnerId        String?
  winner          User?         @relation("WonAuctions", fields: [winnerId], references: [id])

  bids            AuctionBid[]

  createdAt       DateTime      @default(now())
  completedAt     DateTime?

  @@index([status, endsAt])
  @@map("card_auctions")
}

model AuctionBid {
  id          String      @id @default(cuid())
  auctionId   String
  auction     CardAuction @relation(fields: [auctionId], references: [id])
  bidderId    String
  bidder      User        @relation(fields: [bidderId], references: [id])

  amount      Float       // In IxCredits
  timestamp   DateTime    @default(now())
  wasSnipe    Boolean     @default(false)

  @@map("auction_bids")
}

model CardTrade {
  id              String      @id @default(cuid())
  senderId        String
  sender          User        @relation("SentTrades", fields: [senderId], references: [id])
  receiverId      String
  receiver        User        @relation("ReceivedTrades", fields: [receiverId], references: [id])

  offeredCards    Json        // [{ cardId, quantity }]
  requestedCards  Json        // [{ cardId, quantity }]
  creditsOffer    Float?      // IxCredits sweetener

  status          TradeStatus @default(PENDING)
  message         String?

  createdAt       DateTime    @default(now())
  respondedAt     DateTime?
  expiresAt       DateTime

  @@map("card_trades")
}

model CraftingRecipe {
  id              String      @id @default(cuid())
  name            String      // "Common Fusion", "Rare Evolution"
  description     String?

  // Inputs
  inputCards      Card[]      @relation("InputCards")
  inputRules      Json        // { rarity: "COMMON", quantity: 3 }
  creditsCost     Float       @default(0) // IxCredits cost

  // Output
  outputCardId    String
  outputCard      Card        @relation("OutputCard", fields: [outputCardId], references: [id])

  // Mechanics
  successRate     Float       @default(1.0)
  isRepeatable    Boolean     @default(true)

  // Discovery
  isDiscovered    Boolean     @default(false)
  requiredLevel   Int         @default(1)

  craftedCount    Int         @default(0)

  createdAt       DateTime    @default(now())

  @@map("crafting_recipes")
}

// Update existing User model
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
  collectorLevel    Int              @default(1)
  collectorXp       Int              @default(0)
}

// Enums
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

enum PackType {
  BASIC
  PREMIUM
  ELITE
  THEMED
  SEASONAL
  EVENT
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

enum AuctionStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

enum TradeStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
  EXPIRED
}

enum VaultTransactionType {
  EARN_PASSIVE
  EARN_ACTIVE
  EARN_CARDS
  EARN_SOCIAL
  SPEND_PACKS
  SPEND_MARKET
  SPEND_CRAFT
  SPEND_BOOST
  SPEND_COSMETIC
  ADMIN_ADJUSTMENT
}
```

---

## 🔌 API Router Naming

### **MyVault Router**
```typescript
// src/server/api/routers/vault.ts
export const vaultRouter = createTRPCRouter({
  // Balance & Info
  getBalance: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns: { credits, lifetimeEarned, vaultLevel, ... }
    }),

  // Transactions
  getTransactions: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional(),
      type: z.enum(['EARN', 'SPEND', 'ALL']).optional()
    }))
    .query(async ({ ctx, input }) => {
      // Returns transaction history
    }),

  // Earning
  claimDailyBonus: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Award daily login bonus
      // Returns: { credits, streak, bonus }
    }),

  claimStreakBonus: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Award streak bonus
    }),

  // Spending
  spendCredits: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      type: z.nativeEnum(VaultTransactionType),
      source: z.string(),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Deduct credits, record transaction
    }),

  // Progression
  getVaultLevel: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns: { level, xp, nextLevelXp }
    }),
});
```

### **Cards Router**
```typescript
// src/server/api/routers/cards.ts
export const cardsRouter = createTRPCRouter({
  // Browse & Search
  getCards: publicProcedure
    .input(z.object({
      season: z.number().optional(),
      rarity: z.nativeEnum(CardRarity).optional(),
      type: z.nativeEnum(CardType).optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0)
    }))
    .query(async ({ ctx, input }) => {
      // Returns paginated cards
    }),

  getCardById: publicProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns full card details
    }),

  // User Inventory (MyCards)
  getMyCards: protectedProcedure
    .input(z.object({
      sortBy: z.enum(['rarity', 'date', 'value']).optional(),
      filterRarity: z.nativeEnum(CardRarity).optional()
    }))
    .query(async ({ ctx }) => {
      // Returns user's card inventory
    }),

  // Card Stats
  getCardStats: publicProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Returns: { totalSupply, marketValue, recentTrades, ... }
    }),
});
```

### **Card Packs Router**
```typescript
// src/server/api/routers/card-packs.ts
export const cardPacksRouter = createTRPCRouter({
  // Available Packs
  getAvailablePacks: publicProcedure
    .query(async ({ ctx }) => {
      // Returns: [{ id, name, priceCredits, artwork, ... }]
    }),

  // User's Unopened Packs
  getMyPacks: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns user's unopened packs
    }),

  // Purchase Pack
  purchasePack: protectedProcedure
    .input(z.object({
      packId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Deduct IxCredits, create UserPack
      // Returns: { pack, newBalance }
    }),

  // Open Pack
  openPack: protectedProcedure
    .input(z.object({
      userPackId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate cards based on pack odds
      // Create CardOwnership records
      // Returns: { cards: [...], bonusCredits }
    }),
});
```

### **Card Market Router**
```typescript
// src/server/api/routers/card-market.ts
export const cardMarketRouter = createTRPCRouter({
  // Browse Auctions
  getActiveAuctions: publicProcedure
    .input(z.object({
      rarity: z.nativeEnum(CardRarity).optional(),
      priceRange: z.object({
        min: z.number().optional(),
        max: z.number().optional()
      }).optional(),
      limit: z.number().default(50)
    }))
    .query(async ({ ctx, input }) => {
      // Returns active auctions
    }),

  // Create Auction
  createAuction: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      askPrice: z.number().positive(),
      buyoutPrice: z.number().positive().optional(),
      isExpress: z.boolean().default(false),
      isFeatured: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      // Deduct listing fee (IxCredits)
      // Create auction
      // Returns: { auction, feeCharged }
    }),

  // Place Bid
  placeBid: protectedProcedure
    .input(z.object({
      auctionId: z.string(),
      amount: z.number().positive()
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate bid amount
      // Reserve IxCredits
      // Extend auction timer
      // Returns: { success, newEndTime }
    }),

  // Instant Buyout
  buyoutAuction: protectedProcedure
    .input(z.object({
      auctionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Deduct buyout price
      // Transfer card
      // Complete auction
      // Returns: { card, pricesPaid }
    }),
});
```

### **MyCollections Router**
```typescript
// src/server/api/routers/my-collections.ts
export const myCollectionsRouter = createTRPCRouter({
  // List User Collections
  getMyCollections: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns user's collections
    }),

  // Get Collection Details
  getCollection: publicProcedure
    .input(z.object({
      slug: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Returns collection with cards
    }),

  // Create Collection
  createCollection: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
      theme: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Create collection
    }),

  // Add Card to Collection
  addCardToCollection: protectedProcedure
    .input(z.object({
      collectionId: z.string(),
      cardId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Add card to collection
    }),
});
```

---

## 🎨 UI Component Naming

### **MyVault Components**
```typescript
// src/components/vault/
<VaultDashboard />           // Main dashboard
<VaultBalance />             // Display credits balance
<VaultEarnings />            // Today's earnings breakdown
<VaultTransactionHistory />  // Transaction list
<VaultLevelIndicator />      // Level/XP progress
<VaultRewardsPanel />        // Daily rewards, streaks
<VaultEventsCarousel />      // Featured events

// Usage
<VaultBalance
  credits={1234}
  lifetimeEarned={5000}
  todayEarned={45}
/>

<VaultLevelIndicator
  level={12}
  currentXp={450}
  nextLevelXp={500}
/>
```

### **Card Components**
```typescript
// src/components/cards/
<CardDisplay />              // Individual card display
<CardGrid />                 // Grid of cards
<CardCarousel />             // Apple-style carousel
<MyCardsInventory />         // User's card inventory page
<CardMarketListing />        // Market auction card
<CardStatsPanel />           // Card statistics
<CardRarityBadge />          // Rarity indicator

// Pack components
<PackDisplay />              // Pack visual
<PackOpeningSequence />      // Pack opening animation
<PackPurchaseModal />        // Purchase confirmation

// Usage
<CardDisplay
  card={card}
  variant="3d"                // "flat" | "3d" | "draggable"
  showStats={true}
  interactive={true}
/>

<MyCardsInventory
  cards={userCards}
  sortBy="rarity"
  filterRarity={CardRarity.LEGENDARY}
/>
```

### **Collection Components**
```typescript
// src/components/collections/
<MyCollectionsList />        // User's collections list
<CollectionDisplay />        // Individual collection view
<CollectionCard />           // Collection preview card
<CollectionStatsPanel />     // Deck value, completion
<CreateCollectionModal />    // Create new collection

// Usage
<CollectionDisplay
  collection={collection}
  viewMode="grid"             // "grid" | "carousel" | "list"
  isPublic={collection.isPublic}
/>
```

### **Market Components**
```typescript
// src/components/card-market/
<MarketBrowser />            // Main market interface
<AuctionCard />              // Individual auction
<AuctionCountdown />         // Live countdown timer
<BidPanel />                 // Bidding interface
<MarketFilters />            // Filter sidebar
<MarketAnalytics />          // Price trends, volume

// Usage
<AuctionCard
  auction={auction}
  onBid={handleBid}
  onBuyout={handleBuyout}
  showSnipeWarning={auction.endsIn < 60}
/>
```

---

## 🔗 Integration with IxStats Systems

### **MyCountry Integration**

**Navigation Card:**
```typescript
// In MyCountryNavCards.tsx
<NavigationCard
  title="MyVault"
  icon={<VaultIcon />}
  href="/vault"
  badge={unopenedPacks > 0 ? unopenedPacks : undefined}
  stats={[
    { label: "IxCredits", value: formatNumber(credits) },
    { label: "Cards", value: totalCards },
    { label: "Deck Value", value: formatCurrency(deckValue) }
  ]}
/>
```

**Quick Actions Widget:**
```typescript
// In MyCountry Overview
<VaultQuickActions>
  <QuickAction
    label="Open Pack"
    icon={<PackIcon />}
    badge={unopenedPacks}
    onClick={handleOpenPack}
    disabled={unopenedPacks === 0}
  />
  <QuickAction
    label="Visit Market"
    icon={<MarketIcon />}
    href="/vault/market"
  />
  <QuickAction
    label="Daily Bonus"
    icon={<GiftIcon />}
    onClick={handleClaimDaily}
    disabled={dailyClaimed}
  />
</VaultQuickActions>
```

**Earnings Summary:**
```typescript
// Display in MyCountry Overview
<VaultEarningsSummary>
  <EarningItem
    source="Nation Dividends"
    amount={25}
    icon={<NationIcon />}
  />
  <EarningItem
    source="Mission Completion"
    amount={15}
    icon={<MissionIcon />}
  />
  <EarningItem
    source="Achievement Unlock"
    amount={50}
    icon={<AchievementIcon />}
  />
  <Divider />
  <TotalEarned amount={90} label="Today" />
</VaultEarningsSummary>
```

### **Diplomacy Integration**

**Mission Rewards:**
```typescript
// After mission completion
<MissionCompletionModal>
  <MissionResult success={true} />
  <RewardsPanel>
    <Reward
      type="ixcredits"
      amount={15}
      label="IxCredits Earned"
    />
    <Reward
      type="relationship"
      amount={5}
      label="Relationship Improved"
    />
  </RewardsPanel>
  <QuickActions>
    <Button onClick={handleSpendCredits}>
      Spend 25 IxC to Boost Next Mission
    </Button>
  </QuickActions>
</MissionCompletionModal>
```

**Embassy Card Trading:**
```typescript
// In Embassy detail view
<EmbassyActions>
  <ActionButton
    label="Trade Cards"
    icon={<CardIcon />}
    onClick={() => openCardTradeModal(embassy.guestCountryId)}
  />
</EmbassyActions>

// Card trade modal
<CardTradeModal
  partnerId={embassy.guestCountryId}
  partnerName={embassy.guestCountry.name}
  myCards={availableCards}
  onCreateTrade={handleCreateTrade}
/>
```

### **Achievement Integration**

**Achievement Rewards:**
```typescript
// When achievement unlocks
<AchievementUnlockNotification>
  <AchievementDisplay achievement={achievement} />
  <RewardDisplay>
    <RewardItem
      type="ixcredits"
      amount={50}
      label="50 IxCredits"
    />
    <RewardItem
      type="card"
      card={specialCard}
      label="Exclusive Card"
    />
  </RewardDisplay>
</AchievementUnlockNotification>
```

### **Economy Integration**

**Nation Card Value Tracking:**
```typescript
// In Economy dashboard
<NationCardValueWidget>
  <CardPreview card={nationCard} size="small" />
  <ValueMetrics>
    <Metric
      label="Market Value"
      value={formatCurrency(nationCard.marketValue)}
      change={+15}
      changeLabel="This week"
    />
    <Metric
      label="Your Royalties"
      value={`${formatNumber(royaltiesEarned)} IxC`}
      sublabel="From card trades"
    />
  </ValueMetrics>
  <ActionLink href={`/vault/cards/${nationCard.id}`}>
    View Card Details →
  </ActionLink>
</NationCardValueWidget>
```

### **Social Integration (ThinkPages)**

**Card Trade Posts:**
```typescript
// New post type in ThinkPages
<CreatePost>
  <PostTypeSelector>
    <PostType type="text" />
    <PostType type="card-trade" /> {/* NEW */}
  </PostTypeSelector>
</CreatePost>

// Card trade post display
<CardTradePost>
  <PostHeader author={author} timestamp={timestamp} />
  <TradeOffer>
    <OfferSection label="Offering">
      <CardPreview card={offeredCard} />
    </OfferSection>
    <Icon name="swap" />
    <OfferSection label="Seeking">
      <CardPreview card={requestedCard} />
    </OfferSection>
  </TradeOffer>
  <PostActions>
    <ActionButton
      label="Interested"
      onClick={handleInterest}
    />
    <ActionButton
      label="Make Counter-Offer"
      onClick={handleCounterOffer}
    />
  </PostActions>
</CardTradePost>
```

### **Profile Integration**

**New "Vault" Tab:**
```typescript
// In Profile page
<ProfileTabs>
  <Tab label="Overview" />
  <Tab label="Activity" />
  <Tab label="Achievements" />
  <Tab label="Vault" /> {/* NEW */}
</ProfileTabs>

// Vault tab content
<VaultProfileTab>
  <VaultStats>
    <Stat label="Vault Level" value={vaultLevel} />
    <Stat label="Total Cards" value={totalCards} />
    <Stat label="Deck Value" value={formatCurrency(deckValue)} />
    <Stat label="Lifetime IxC" value={formatNumber(lifetimeEarned)} />
  </VaultStats>

  <FeaturedCollection
    collection={featuredCollection}
    viewMode="carousel"
  />

  <PublicCollectionsList
    collections={publicCollections}
  />

  <CardAchievements
    achievements={cardAchievements}
  />
</VaultProfileTab>
```

---

## 📱 User-Facing Copy Examples

### **Onboarding/Tutorial**

```
Welcome to MyVault!

Your personal vault for collecting, trading, and showcasing cards.

• Earn IxCredits by playing IxStats
• Open card packs to grow your collection
• Trade with other players in the Card Market
• Build themed collections to show off

Ready to open your first pack?
[Open Starter Pack]
```

### **Earnings Notifications**

```
✅ +25 IxCredits
   From nation dividends

✅ +15 IxCredits
   Mission completed: Diplomatic Exchange

✅ +50 IxCredits
   Achievement unlocked: First Embassy

✅ +5 IxCredits
   Card pack bonus!
```

### **Pack Opening**

```
You have 3 unopened packs

Basic Pack
5 cards • Season 3
[Open Pack]

Premium Pack
5 cards • Better odds
[Open Pack]

Season 4 Elite Pack
5 cards • Guaranteed Rare+
[Open Pack]
```

### **Card Market**

```
Card Market

[Search cards...]  [Filters ▼]

Active Auctions (245)

┌─────────────────────────────┐
│ Nation Card: Burgundie      │
│ Rarity: Epic                │
│ Current Bid: 125 IxC        │
│ Ends in: 12m 45s           │
│ [Place Bid] [Buyout 200 IxC]│
└─────────────────────────────┘

Sort by: [Ending Soon ▼]
Filter: [All Rarities ▼]
```

### **MyCollections**

```
MyCollections (8)

┌─────────────────────┐
│ Season 3 Complete   │
│ 180/180 cards       │
│ Deck Value: 2,450   │
│ [View]              │
└─────────────────────┘

┌─────────────────────┐
│ Legendary Nations   │
│ 12 cards            │
│ Deck Value: 5,800   │
│ [View]              │
└─────────────────────┘

[+ Create New Collection]
```

### **Transaction History**

```
IxCredits History

Today: +90 IxC earned

+25 IxC  Nation dividends        2h ago
+15 IxC  Mission reward           3h ago
-15 IxC  Pack purchase            5h ago
+10 IxC  Login streak bonus       8h ago
+5 IxC   Card pack bonus          5h ago
```

---

## 🎯 Implementation Checklist

### **Phase 1: Core System (Weeks 1-2)**
- [ ] Create MyVault database models (migration)
- [ ] Build vault service (earn/spend IxCredits)
- [ ] Create Card, CardOwnership, CardPack models
- [ ] Implement basic vault router (balance, transactions)
- [ ] Build cards router (browse, search, getMyCards)

### **Phase 2: UI Foundation (Weeks 2-3)**
- [ ] Create MyVault dashboard page
- [ ] Build VaultBalance, VaultEarnings components
- [ ] Implement CardDisplay component (3D, draggable)
- [ ] Create MyCards inventory page
- [ ] Add "MyVault" nav item to main navigation

### **Phase 3: Packs & Opening (Week 3-4)**
- [ ] Create card pack generation system
- [ ] Build pack opening sequence (animation)
- [ ] Implement pack purchase flow
- [ ] Add unopened packs indicator
- [ ] Create pack management UI

### **Phase 4: Card Market (Weeks 4-5)**
- [ ] Build auction system (NS-style double auction)
- [ ] Create market browser UI
- [ ] Implement bidding mechanics
- [ ] Add auction countdown timers
- [ ] Build market filters/search

### **Phase 5: Collections (Week 5-6)**
- [ ] Create MyCollections system
- [ ] Build collection management UI
- [ ] Implement public collection sharing
- [ ] Add collection statistics
- [ ] Create collection themes/display modes

### **Phase 6: Integration (Weeks 6-7)**
- [ ] Add MyVault card to MyCountry nav
- [ ] Integrate IxCredits earning into missions
- [ ] Add vault tab to profile
- [ ] Integrate with achievement system
- [ ] Add card categories to leaderboards

### **Phase 7: Advanced Features (Weeks 7-8)**
- [ ] Build crafting system
- [ ] Implement card trading (P2P)
- [ ] Add card enhancement/leveling
- [ ] Create Vault Events system
- [ ] Build NS API integration

### **Phase 8: Polish & Launch (Weeks 8-10)**
- [ ] Mobile optimization
- [ ] Performance tuning (caching, optimization)
- [ ] Admin tools (pack creation, economy monitoring)
- [ ] Tutorial/onboarding flow
- [ ] Documentation

---

## 🔄 Migration Notes

### **Renaming IxBank → MyVault**

**Database migration:**
```sql
-- Rename tables
ALTER TABLE ix_bank RENAME TO my_vault;
ALTER TABLE ix_bank_transactions RENAME TO vault_transactions;

-- Rename columns
ALTER TABLE my_vault RENAME COLUMN balance TO credits;

-- Update foreign keys
ALTER TABLE vault_transactions
  RENAME COLUMN ixBankId TO vaultId;
```

**Code updates:**
```typescript
// Before
import { IxBank } from '@prisma/client';
const bank = await db.ixBank.findUnique(...);

// After
import { MyVault } from '@prisma/client';
const vault = await db.myVault.findUnique(...);
```

**Component updates:**
```typescript
// Before
<IxBankBalance balance={balance} />

// After
<VaultBalance credits={credits} />
```

---

This branding system provides:
✅ Clear "MyVault" identity for personal features
✅ Professional "IxCredits" currency name
✅ Simple "Cards" terminology in most UI contexts
✅ Consistent naming across database, API, and UI
✅ Future-proof for additional vault features
✅ Native integration with existing IxStats systems
