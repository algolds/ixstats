# MyVault System

**Last updated:** November 2025 (Phase 1)
**Status:** Development - Phase 1 Implementation

MyVault is IxStats' personal virtual vault system where players earn, manage, and spend IxCredits (IxC) - the platform's universal currency. It serves as the economic backbone connecting gameplay actions to rewards and unlockables.

## Overview

MyVault provides:
- **IxCredits Currency** - Universal platform currency (abbreviated IxC)
- **Multi-Path Earning** - Passive nation income, active gameplay rewards, card activities, social engagement
- **Balanced Economy** - Daily caps, inflation control, varied spending sinks
- **Progression System** - Vault level/XP tracking with milestone rewards
- **Transaction History** - Complete audit trail of all earnings and spending

## Core Concepts

### IxCredits (IxC)

The universal currency of IxStats, used across all platform features:

**Display Formats:**
```typescript
// Full display
"Balance: 1,234 IxCredits"
"You earned 50 IxCredits"

// Abbreviated (tight spaces)
"1,234 IxC"
"+50 IxC"
"-15 IxC"

// Conversational
"Earn credits by completing missions"
"Spend credits to open card packs"
```

**Key Characteristics:**
- Cannot be purchased with real money
- Earned through gameplay only
- Used for cards, boosts, cosmetics, and premium features
- Inflation-controlled economy

### Vault Levels

Players progress through vault levels by earning XP from transactions:

```typescript
// XP calculation
const xp = Math.floor(creditsAmount * XP_MULTIPLIER);
const nextLevelXp = currentLevel * 100; // Linear progression

// Level up rewards
const levelUpBonus = {
  credits: currentLevel * 10,
  packReward: currentLevel % 5 === 0, // Every 5 levels
  badgeUnlock: currentLevel % 10 === 0 // Every 10 levels
};
```

## Earning IxCredits

### 1. Passive Income (Nation-Based)

Rewards nation ownership without forced engagement:

**Daily Dividend System:**
```typescript
// Base calculation
const baseDividend = (gdpPerCapita / 10000) * tierMultiplier;
const populationBonus = (population / 1_000_000) * 0.01;
const growthBonus = gdpGrowth > 3 ? baseDividend * 0.1 : 0;

const totalDividend = baseDividend + populationBonus + growthBonus;

// Tier multipliers
const tierMultipliers = {
  TIER_1: 3.0,
  TIER_2: 2.0,
  TIER_3: 1.5,
  TIER_4: 1.0
};
```

**Example:** Nation with $45K GDP/capita, Tier 2, 25M pop, 4% growth
```
Base: (45000/10000) * 2 = 9 IxC
Population: 25 * 0.01 = 0.25 IxC
Growth: 9 * 1.1 = 9.9 IxC
Total: ~10 IxCredits/day passive
```

**National Card Royalties:**
- Earn 2% of any transaction involving your nation's card
- Creates incentive to improve nation (increases card value)
- Passive income even while offline

### 2. Active Gameplay Rewards

Incentivize daily engagement across all IxStats systems:

**Daily Activities:**
| Activity | IxCredits | Cap | Notes |
|----------|-----------|-----|-------|
| Login streak | 1-10 | Daily | Scales day 1-7+, resets if missed |
| Crisis event response | 5 | Daily | Per event answered |
| Diplomatic mission | 3-15 | 5/day | Based on difficulty |
| Economic decision | 2 | 10/day | Budget/policy changes |
| ThinkPages post | 1 | 5/day | Original content |
| ThinkPages reaction | 0.5 | 3/day | Comments/likes |

**Milestone Bonuses:**
| Milestone | IxCredits | Trigger |
|-----------|-----------|---------|
| Achievement unlock | 10-100 | Rarity-based |
| Establish embassy | 15 | First contact |
| Budget completion | 5 | Full allocation |
| Intelligence review | 3 | Read daily briefing |
| Cabinet meeting | 8 | Attend meeting |

**Competitive Rewards:**
| Rank | IxCredits/Day | Category |
|------|---------------|----------|
| Top 10 | 50 | Any leaderboard |
| Top 100 | 10 | Any leaderboard |
| ThinkTank win | 20 | Debate victory |

**Daily Earning Cap:** 100 IxC from active gameplay (passive unlimited)

### 3. Card-Specific Earnings

Make cards themselves a source of income:

**Pack Opening:**
- 10% chance of "lucky pack" bonus: +5-50 IxC
- First pack of day: +2 IxC
- Open 10 packs in 1 week: +25 IxC bonus

**Collection Milestones:**
- Complete rarity set: 50 IxC
- Complete season set: 500 IxC
- Complete themed collection: 100-1000 IxC
- Own all cards from region: 200 IxC

**Market Activity:**
- Successful auction (seller): 1% of sale as bonus
- Market maker (100+ trades/week): 50 IxC
- Auction snipe: 3 IxC
- Daily deck appreciation: +1 IxC per 100 value gained

### 4. Social & Collaborative

Reward community engagement:

**Generosity System:**
- Gift card: +1 IxC (sender) + 0.5 IxC (recipient)
- Max 10/day to prevent abuse

**Trading Network:**
- P2P trade completion: +2 IxC (both parties)
- Positive trade review: +3 IxC
- Host public trade session: +10 IxC

**Teaching Bonus:**
- Referred player opens first pack: +50 IxC
- Referred player completes collection: +100 IxC

## Spending IxCredits

### 1. Core Card Operations

**Card Packs:**
| Pack Type | Price | Contents | Odds |
|-----------|-------|----------|------|
| Basic | 15 IxC | 5 cards | Standard |
| Premium | 35 IxC | 5 cards | Better odds |
| Elite | 75 IxC | 5 cards | Guaranteed Rare+ |
| Themed | 50 IxC | 5 cards | Region/era specific |

**Market Fees:**
- Auction listing: 0.5 IxC
- Express auction (30-min): 5 IxC
- Featured listing: 10 IxC

**Deck Management:**
- Deck expansion: Quadratic pricing (1², 4², 9²...)
- Extra deck slots: 5 IxC per slot
- Collection showcase: 20 IxC per slot

### 2. Card Enhancement System

**Crafting:**
- Basic craft (2 commons → 1 uncommon): 5 IxC
- Advanced craft (3 same → higher rarity): 25 IxC
- Special edition craft: 100 IxC

**Card Evolution:**
- Level up card: 10-50 IxC per level
- Unlock alternate artwork: 30 IxC
- Add animated effects: 50 IxC

**Card Insurance:**
- Single card protection (1 week): 10 IxC
- Full deck insurance: 50 IxC/week

### 3. Cross-Platform Benefits

Bridge to other IxStats systems:

**Diplomatic Boosts:**
- Increase mission success (+10%): 25 IxC
- Instant embassy upgrade: 40 IxC
- Rush cultural exchange: 30 IxC

**Economic Advantages:**
- Accelerate economic calculation: 20 IxC
- Unlock premium economic model: 100 IxC (one-time)
- GDP growth boost (+0.1% for 1 quarter): 35 IxC

**Intelligence Premium:**
- Advanced analytics: 50 IxC/month
- AI-powered forecasting: 75 IxC/month
- Competitor intelligence: 15 IxC each

**Social Features:**
- ThinkPages premium themes: 25 IxC
- Pin post to top: 10 IxC
- Boost post visibility: 15 IxC

### 4. Cosmetic & Prestige

**Visual Customization:**
- Custom card backs: 40 IxC
- Holographic effects: 60 IxC
- Custom frames: 30 IxC
- Collection themes: 50 IxC

**Profile Enhancements:**
- Profile badges: 20 IxC
- Custom effects: 45 IxC
- Showcase featured cards: 25 IxC

**Exclusive Access:**
- Early season access: 150 IxC
- Limited edition packs: 200 IxC
- Special event participation: 50-100 IxC

## Usage Examples

### Claiming Daily Bonus

```typescript
import { api } from "~/trpc/react";

function DailyBonusButton() {
  const utils = api.useUtils();

  const claimDaily = api.vault.claimDailyBonus.useMutation({
    onSuccess: (result) => {
      toast.success(`Claimed ${result.bonus} IxCredits! Streak: ${result.streak} days`);
      utils.vault.getBalance.invalidate();
    }
  });

  return (
    <Button
      onClick={() => claimDaily.mutate()}
      disabled={claimDaily.isPending}
    >
      Claim Daily Bonus
    </Button>
  );
}
```

### Checking Balance

```typescript
function VaultBalance() {
  const { data: vault, isLoading } = api.vault.getBalance.useQuery();

  if (isLoading) return <Skeleton />;

  return (
    <div className="vault-balance">
      <h3>IxCredits Balance</h3>
      <p className="balance">{vault.credits.toLocaleString()} IxC</p>
      <p className="lifetime">Lifetime: {vault.lifetimeEarned.toLocaleString()} IxC</p>
      <p className="today">Today: +{vault.todayEarned} IxC</p>
    </div>
  );
}
```

### Spending Credits

```typescript
function PurchasePackButton({ pack }: { pack: CardPack }) {
  const utils = api.useUtils();

  const purchase = api.cardPacks.purchasePack.useMutation({
    onSuccess: (result) => {
      toast.success(`Purchased ${pack.name}!`);
      utils.vault.getBalance.invalidate();
      utils.cardPacks.getMyPacks.invalidate();
    },
    onError: (error) => {
      if (error.message.includes("Insufficient credits")) {
        toast.error("Not enough IxCredits");
      }
    }
  });

  return (
    <Button
      onClick={() => purchase.mutate({ packId: pack.id })}
      disabled={purchase.isPending}
    >
      Buy for {pack.priceCredits} IxC
    </Button>
  );
}
```

### Transaction History

```typescript
function TransactionHistory() {
  const { data: transactions } = api.vault.getTransactions.useQuery({
    limit: 20,
    type: 'ALL'
  });

  return (
    <div className="transaction-history">
      <h3>Recent Transactions</h3>
      {transactions?.map((tx) => (
        <div key={tx.id} className="transaction">
          <span className={tx.credits > 0 ? 'earn' : 'spend'}>
            {tx.credits > 0 ? '+' : ''}{tx.credits} IxC
          </span>
          <span className="source">{tx.source}</span>
          <span className="time">{formatRelativeTime(tx.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Earnings Summary

```typescript
function EarningsSummary() {
  const { data: summary } = api.vault.getEarningsSummary.useQuery();

  return (
    <div className="earnings-summary">
      <h3>Today's Earnings</h3>

      <EarningItem
        icon={<NationIcon />}
        label="Nation Dividends"
        amount={summary.passive}
      />

      <EarningItem
        icon={<MissionIcon />}
        label="Active Gameplay"
        amount={summary.active}
        cap={100}
      />

      <EarningItem
        icon={<CardIcon />}
        label="Card Activities"
        amount={summary.cards}
      />

      <EarningItem
        icon={<SocialIcon />}
        label="Social Engagement"
        amount={summary.social}
        cap={50}
      />

      <Divider />

      <div className="total">
        <strong>Total Today:</strong>
        <span>{summary.total} IxC</span>
      </div>
    </div>
  );
}
```

## Economy Balancing

### Daily Earning Caps

```typescript
const DAILY_CAPS = {
  PASSIVE: null, // Unlimited (rewards nation building)
  ACTIVE: 100, // Cap active gameplay
  CARD_TRADING: null, // Unlimited (rewards market activity)
  SOCIAL: 50, // Cap social rewards
};

// Check if user hit cap
async function canEarnFromSource(userId: string, type: TransactionType) {
  const today = await getTransactionsToday(userId, type);
  const cap = DAILY_CAPS[type];

  if (!cap) return true; // No cap

  const earned = today.reduce((sum, tx) => sum + tx.credits, 0);
  return earned < cap;
}
```

### Inflation Control

Weekly economy audit monitors:
- Total IxCredits in circulation
- Average daily earning rate
- Spending velocity
- Pack opening rates

**Automatic Adjustments:**
- Dynamic pack pricing (±10% based on economy)
- Auction fees for high-value sales (10% on >100 IxC)
- Junk value adjustments per season

### Scarcity Mechanics

- Limited edition cards (max 1000 copies)
- Seasonal exclusives (time-limited availability)
- Crafting failures (80% success on advanced)
- Random pack contents (no guaranteed outcomes except Elite)

## Integration Points

### MyCountry Dashboard

**New Nav Card:**
```typescript
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
<VaultQuickActions>
  <QuickAction label="Open Pack" badge={unopenedPacks} />
  <QuickAction label="Visit Market" />
  <QuickAction label="Daily Bonus" disabled={dailyClaimed} />
</VaultQuickActions>
```

### Diplomacy System

**Mission Rewards:**
- All missions award IxCredits (3-15 based on difficulty)
- Special "Collector's Mission" type rewards themed packs
- Diplomatic events award bonus IxCredits

### Achievement System

**Dual Rewards:**
- Existing achievements now grant IxCredits
- Card achievements grant traditional badges
- Meta-achievements unlock exclusive cards

### Profile Page

**New "Vault" Tab:**
- Card statistics
- Featured collection
- Vault level
- Public collections

## API Reference

See [API Documentation](../reference/api-complete.md#vault-router) for complete endpoint specifications.

## Database Schema

```prisma
model MyVault {
  id                String              @id @default(cuid())
  userId            String              @unique
  user              User                @relation(fields: [userId], references: [id])

  credits           Float               @default(0)
  lifetimeEarned    Float               @default(0)
  lifetimeSpent     Float               @default(0)

  todayEarned       Float               @default(0)
  lastDailyReset    DateTime            @default(now())

  loginStreak       Int                 @default(0)
  lastLoginDate     DateTime?

  vaultLevel        Int                 @default(1)
  vaultXp           Int                 @default(0)

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

  credits     Float
  balanceAfter Float
  type        VaultTransactionType
  source      String
  metadata    Json?

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
```

## See Also

- [Cards System](./cards.md) - Card types, ownership, and stats
- [Card Packs System](./card-packs.md) - Pack types and opening mechanics
- [API Reference](../reference/api-complete.md#vault-router) - Complete endpoint documentation
- [Database Reference](../reference/database.md) - Full schema documentation
