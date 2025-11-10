# Card Packs System

**Last updated:** November 2025 (Phase 1)
**Status:** Development - Phase 1 Implementation

Card packs are the primary method for acquiring new cards in IxStats. Players purchase packs with IxCredits, open them through a cinematic reveal sequence, and receive randomized cards based on rarity distribution mechanics.

## Overview

Card pack system features:
- **Multiple Pack Types** - Basic, Premium, Elite, Themed, Seasonal, Event packs
- **Rarity Distribution** - Configurable odds per pack type
- **Pack Opening Flow** - Cinematic reveal with animations
- **Themed Packs** - Region, era, or type-specific card pools
- **Limited Editions** - Time-limited or quantity-limited packs
- **Bonus Mechanics** - Lucky packs, streak bonuses, daily rewards

## Pack Types

### Basic Pack

Standard entry-level pack:

```typescript
const basicPack: CardPack = {
  name: "Basic Pack",
  description: "5 cards with standard odds",
  artwork: "/packs/basic.png",
  cardCount: 5,
  packType: PackType.BASIC,
  priceCredits: 15,

  // Rarity odds (must sum to 100)
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,

  isAvailable: true,
  limitedQuantity: null, // Unlimited
  purchaseLimit: null // No per-user limit
};
```

**Expected Contents:**
- 3-4 Common cards
- 1-2 Uncommon cards
- 0-1 Rare or better

### Premium Pack

Better odds for higher rarities:

```typescript
const premiumPack: CardPack = {
  name: "Premium Pack",
  description: "5 cards with improved rare odds",
  cardCount: 5,
  packType: PackType.PREMIUM,
  priceCredits: 35,

  // Improved odds
  commonOdds: 50, // Reduced
  uncommonOdds: 30, // Increased
  rareOdds: 15, // Doubled
  ultraRareOdds: 3.5,
  epicOdds: 1.3,
  legendaryOdds: 0.2,
};
```

**Expected Contents:**
- 2-3 Common cards
- 1-2 Uncommon cards
- 1 Rare or better (high chance)

### Elite Pack

Guaranteed rare or better:

```typescript
const elitePack: CardPack = {
  name: "Elite Pack",
  description: "5 cards, guaranteed Rare or better",
  cardCount: 5,
  packType: PackType.ELITE,
  priceCredits: 75,

  // Premium odds
  commonOdds: 30,
  uncommonOdds: 35,
  rareOdds: 25, // High rare rate
  ultraRareOdds: 7,
  epicOdds: 2.5,
  legendaryOdds: 0.5,
};
```

**Guaranteed Content:**
- At least 1 Rare or better card
- 2-3 Uncommon or better cards
- Premium odds for all slots

### Themed Packs

Region, era, or type-specific:

```typescript
const themedPack: CardPack = {
  name: "Sarpedon Regional Pack",
  description: "5 cards from Sarpedon region",
  cardCount: 5,
  packType: PackType.THEMED,
  priceCredits: 50,

  // Standard odds
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,

  // Theme filter
  themeFilter: {
    region: "Sarpedon",
    cardTypes: ["NATION", "LORE"]
  }
};
```

**Theme Types:**
- **Regional** - Cards from specific geographic region
- **Era-Based** - Historical period (Ancient, Modern, etc.)
- **Type-Specific** - Only nation cards, only lore cards, etc.
- **Event-Themed** - Tied to specific events or storylines

### Seasonal Packs

Time-limited seasonal releases:

```typescript
const seasonalPack: CardPack = {
  name: "Winter Holidays Pack",
  description: "Limited time holiday cards",
  cardCount: 5,
  packType: PackType.SEASONAL,
  priceCredits: 60,

  // Enhanced odds
  commonOdds: 55,
  uncommonOdds: 28,
  rareOdds: 12,
  ultraRareOdds: 3.5,
  epicOdds: 1.3,
  legendaryOdds: 0.2,

  // Time-limited
  isAvailable: true,
  expiresAt: new Date('2025-01-05'),
  purchaseLimit: 10 // Max 10 per user
};
```

### Event Packs

Special event exclusives:

```typescript
const eventPack: CardPack = {
  name: "IxStats Anniversary Pack",
  description: "Commemorative anniversary cards",
  cardCount: 5,
  packType: PackType.EVENT,
  priceCredits: 100,

  // Premium odds
  commonOdds: 40,
  uncommonOdds: 35,
  rareOdds: 18,
  ultraRareOdds: 5,
  epicOdds: 1.8,
  legendaryOdds: 0.2,

  // Limited quantity
  limitedQuantity: 1000, // Only 1000 available
  purchaseLimit: 3 // Max 3 per user
};
```

## Rarity Distribution Mechanics

### Probability System

Each card slot in a pack is independently rolled:

```typescript
function rollCardRarity(pack: CardPack): CardRarity {
  const roll = Math.random() * 100;
  let cumulative = 0;

  // Check from rarest to common
  cumulative += pack.legendaryOdds;
  if (roll < cumulative) return CardRarity.LEGENDARY;

  cumulative += pack.epicOdds;
  if (roll < cumulative) return CardRarity.EPIC;

  cumulative += pack.ultraRareOdds;
  if (roll < cumulative) return CardRarity.ULTRA_RARE;

  cumulative += pack.rareOdds;
  if (roll < cumulative) return CardRarity.RARE;

  cumulative += pack.uncommonOdds;
  if (roll < cumulative) return CardRarity.UNCOMMON;

  return CardRarity.COMMON;
}
```

### Card Selection

After determining rarity, select specific card:

```typescript
async function selectCard(
  rarity: CardRarity,
  pack: CardPack
): Promise<Card> {
  // Build query based on pack constraints
  const query = {
    rarity,
    season: pack.season || currentSeason,
    ...(pack.cardType && { cardType: pack.cardType }),
    ...(pack.themeFilter && buildThemeFilter(pack.themeFilter))
  };

  // Get eligible cards
  const eligibleCards = await db.card.findMany({
    where: query
  });

  // Random selection
  return eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
}
```

### Anti-Duplicate Logic

Prevent duplicate cards within same pack:

```typescript
async function generatePackContents(pack: CardPack): Promise<Card[]> {
  const cards: Card[] = [];
  const usedCardIds = new Set<string>();

  for (let i = 0; i < pack.cardCount; i++) {
    let card: Card;
    let attempts = 0;

    do {
      const rarity = rollCardRarity(pack);
      card = await selectCard(rarity, pack);
      attempts++;

      // Fallback if can't find unique after 10 tries
      if (attempts > 10) break;
    } while (usedCardIds.has(card.id));

    usedCardIds.add(card.id);
    cards.push(card);
  }

  return cards;
}
```

## Pack Opening Flow

### Purchase Flow

```typescript
async function purchasePack(
  userId: string,
  packId: string
): Promise<UserPack> {
  const pack = await db.cardPack.findUnique({ where: { id: packId } });
  const vault = await db.myVault.findUnique({ where: { userId } });

  // Validation
  if (!pack.isAvailable) {
    throw new Error("Pack no longer available");
  }

  if (pack.expiresAt && pack.expiresAt < new Date()) {
    throw new Error("Pack expired");
  }

  if (vault.credits < pack.priceCredits) {
    throw new Error("Insufficient credits");
  }

  // Check purchase limit
  if (pack.purchaseLimit) {
    const userPurchases = await db.userPack.count({
      where: { userId, packId }
    });

    if (userPurchases >= pack.purchaseLimit) {
      throw new Error("Purchase limit reached");
    }
  }

  // Check limited quantity
  if (pack.limitedQuantity) {
    const totalPurchased = await db.userPack.count({
      where: { packId }
    });

    if (totalPurchased >= pack.limitedQuantity) {
      throw new Error("Pack sold out");
    }
  }

  // Deduct credits
  await spendCredits(userId, pack.priceCredits, 'SPEND_PACKS', {
    packId: pack.id,
    packName: pack.name
  });

  // Create user pack
  const userPack = await db.userPack.create({
    data: {
      userId,
      packId,
      isOpened: false,
      acquiredMethod: 'PURCHASE'
    }
  });

  return userPack;
}
```

### Opening Flow

```typescript
async function openPack(
  userId: string,
  userPackId: string
): Promise<OpenPackResult> {
  const userPack = await db.userPack.findUnique({
    where: { id: userPackId },
    include: { pack: true }
  });

  // Validation
  if (userPack.userId !== userId) {
    throw new Error("Not your pack");
  }

  if (userPack.isOpened) {
    throw new Error("Pack already opened");
  }

  // Generate cards
  const cards = await generatePackContents(userPack.pack);

  // Create ownership records
  for (const card of cards) {
    await createOrUpdateOwnership(userId, card.id, {
      acquiredMethod: AcquireMethod.PACK,
      metadata: { packId: userPack.packId }
    });
  }

  // Check for lucky pack bonus
  const luckyBonus = Math.random() < 0.1 ?
    Math.floor(Math.random() * 46) + 5 : 0; // 5-50 IxC

  if (luckyBonus > 0) {
    await awardIxCredits(userId, luckyBonus, 'EARN_CARD', {
      reason: 'LUCKY_PACK_BONUS'
    });
  }

  // First pack of day bonus
  const isFirstToday = await checkFirstPackToday(userId);
  if (isFirstToday) {
    await awardIxCredits(userId, 2, 'EARN_CARD', {
      reason: 'FIRST_PACK_OF_DAY'
    });
  }

  // Mark pack as opened
  await db.userPack.update({
    where: { id: userPackId },
    data: {
      isOpened: true,
      openedAt: new Date()
    }
  });

  return {
    cards,
    bonusCredits: luckyBonus + (isFirstToday ? 2 : 0)
  };
}
```

## Pack Opening Cinematic

### Animation Sequence

The pack opening experience consists of 4 stages:

**Stage 1: Pack Reveal (1.5s)**
- Pack appears with pulsing glow
- "Tap to Open" prompt
- Haptic feedback on tap

**Stage 2: Pack Explosion (0.8s)**
- Particle effects burst out
- Pack model shatters
- Cards fly into view

**Stage 3: Card Reveal (0.8s per card)**
- Cards flip one-by-one
- Suspenseful delay between reveals
- Rarity-specific sound effects
- Color flash on reveal

**Stage 4: Quick Actions**
- Junk/Keep/List buttons appear
- Collection stats update
- Bonus credits notification

### Implementation

```typescript
function PackOpeningSequence({ userPack, onComplete }: Props) {
  const [stage, setStage] = useState<'reveal' | 'explosion' | 'cards' | 'actions'>('reveal');
  const [revealedCards, setRevealedCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const { mutate: openPack, data: result } = api.cardPacks.openPack.useMutation({
    onSuccess: (data) => {
      setStage('explosion');
      setTimeout(() => {
        setStage('cards');
        setRevealedCards(data.cards);
      }, 800);
    }
  });

  // Card reveal sequencing
  useEffect(() => {
    if (stage === 'cards' && currentCardIndex < revealedCards.length) {
      const timer = setTimeout(() => {
        playSound(RARITY_SOUNDS[revealedCards[currentCardIndex].rarity]);
        triggerHaptic(RARITY_HAPTICS[revealedCards[currentCardIndex].rarity]);
        setCurrentCardIndex(prev => prev + 1);
      }, 800);

      return () => clearTimeout(timer);
    } else if (stage === 'cards' && currentCardIndex === revealedCards.length) {
      setStage('actions');
    }
  }, [stage, currentCardIndex, revealedCards]);

  return (
    <div className="pack-opening-sequence">
      {stage === 'reveal' && (
        <PackReveal
          pack={userPack.pack}
          onTap={() => openPack({ userPackId: userPack.id })}
        />
      )}

      {stage === 'explosion' && (
        <PackExplosion particleCount={50} />
      )}

      {stage === 'cards' && (
        <CardRevealSequence
          cards={revealedCards.slice(0, currentCardIndex)}
          allCards={revealedCards}
        />
      )}

      {stage === 'actions' && (
        <QuickActions
          cards={revealedCards}
          bonusCredits={result.bonusCredits}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}
```

## Bonus Mechanics

### Lucky Pack Bonus

10% chance when opening any pack:

```typescript
const LUCKY_PACK_ODDS = 0.1;
const LUCKY_PACK_MIN = 5;
const LUCKY_PACK_MAX = 50;

function checkLuckyPack(): number {
  if (Math.random() < LUCKY_PACK_ODDS) {
    return Math.floor(Math.random() * (LUCKY_PACK_MAX - LUCKY_PACK_MIN + 1)) + LUCKY_PACK_MIN;
  }
  return 0;
}
```

### First Pack of Day

+2 IxC for opening first pack each day:

```typescript
async function checkFirstPackToday(userId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openedToday = await db.userPack.count({
    where: {
      userId,
      isOpened: true,
      openedAt: { gte: today }
    }
  });

  return openedToday === 0;
}
```

### Weekly Opening Streak

Open 10 packs in 1 week for +25 IxC bonus:

```typescript
async function checkWeeklyStreak(userId: string): Promise<boolean> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const openedThisWeek = await db.userPack.count({
    where: {
      userId,
      isOpened: true,
      openedAt: { gte: weekAgo }
    }
  });

  return openedThisWeek >= 10;
}
```

## Admin Pack Creation

### Creating New Packs

```typescript
async function createCardPack(packData: CreatePackInput): Promise<CardPack> {
  // Validate odds sum to 100
  const totalOdds =
    packData.commonOdds +
    packData.uncommonOdds +
    packData.rareOdds +
    packData.ultraRareOdds +
    packData.epicOdds +
    packData.legendaryOdds;

  if (Math.abs(totalOdds - 100) > 0.01) {
    throw new Error("Rarity odds must sum to 100");
  }

  return await db.cardPack.create({
    data: {
      ...packData,
      isAvailable: true
    }
  });
}
```

### Updating Pack Availability

```typescript
async function updatePackAvailability(
  packId: string,
  isAvailable: boolean
): Promise<CardPack> {
  return await db.cardPack.update({
    where: { id: packId },
    data: { isAvailable }
  });
}
```

### Pack Analytics

```typescript
async function getPackStatistics(packId: string) {
  const purchases = await db.userPack.count({
    where: { packId }
  });

  const opened = await db.userPack.count({
    where: { packId, isOpened: true }
  });

  const revenue = await db.vaultTransaction.aggregate({
    where: {
      type: 'SPEND_PACKS',
      metadata: {
        path: ['packId'],
        equals: packId
      }
    },
    _sum: { credits: true }
  });

  return {
    totalPurchased: purchases,
    totalOpened: opened,
    unopened: purchases - opened,
    revenue: Math.abs(revenue._sum.credits || 0)
  };
}
```

## Usage Examples

### Browse Available Packs

```typescript
function PackShop() {
  const { data: packs } = api.cardPacks.getAvailablePacks.useQuery();
  const { data: vault } = api.vault.getBalance.useQuery();

  return (
    <div className="pack-shop">
      <h1>Card Packs</h1>
      <p className="balance">Your Balance: {vault?.credits} IxC</p>

      <div className="pack-grid">
        {packs?.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            canAfford={vault?.credits >= pack.priceCredits}
            onPurchase={() => handlePurchase(pack.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### User's Unopened Packs

```typescript
function MyPacks() {
  const { data: packs } = api.cardPacks.getMyPacks.useQuery();
  const [selectedPack, setSelectedPack] = useState<UserPack | null>(null);

  return (
    <div className="my-packs">
      <h2>Your Unopened Packs ({packs?.length || 0})</h2>

      <div className="pack-list">
        {packs?.map((userPack) => (
          <PackPreview
            key={userPack.id}
            pack={userPack.pack}
            acquiredDate={userPack.acquiredDate}
            onOpen={() => setSelectedPack(userPack)}
          />
        ))}
      </div>

      {selectedPack && (
        <PackOpeningModal
          userPack={selectedPack}
          onClose={() => setSelectedPack(null)}
        />
      )}
    </div>
  );
}
```

## API Reference

See [API Documentation](../reference/api-complete.md#card-packs-router) for complete endpoint specifications.

## Database Schema

```prisma
model CardPack {
  id              String      @id @default(cuid())
  name            String
  description     String?
  artwork         String

  cardCount       Int         @default(5)
  packType        PackType
  priceCredits    Float

  // Rarity odds (must sum to 100)
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
  purchaseLimit   Int?
  expiresAt       DateTime?

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
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  packId          String
  pack            CardPack    @relation(fields: [packId], references: [id])

  isOpened        Boolean     @default(false)
  openedAt        DateTime?

  acquiredDate    DateTime    @default(now())
  acquiredMethod  String

  @@index([userId, isOpened])
  @@map("user_packs")
}
```

## See Also

- [MyVault System](./myvault.md) - IxCredits economy
- [Cards System](./cards.md) - Card types and rarity
- [API Reference](../reference/api-complete.md#card-packs-router) - Complete endpoints
- [Database Reference](../reference/database.md) - Full schema
