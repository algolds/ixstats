# NationStates Integration

**Last updated:** November 2025 (Phase 1)
**Status:** Development - Phase 1 Implementation

The NationStates (NS) integration allows IxStats users to import their existing NationStates card collections and synchronize NS cards into the IxStats card ecosystem. This creates a bridge between the two platforms while respecting NS's API rate limiting and data policies.

## Overview

NS Integration provides:
- **Daily Card Sync** - Automated sync of NS card dump data
- **Collection Import** - Import user's NS deck with verification
- **Rate Limit Compliance** - Respectful API usage within NS guidelines
- **Dual Platform Support** - Cards work in both NS and IxStats ecosystems
- **Market Watch** - Track NS auction data for arbitrage opportunities

## Core Concepts

### NS Card Dump

NationStates provides daily XML dumps of all cards:

**Dump URL Format:**
```
https://www.nationstates.net/pages/cardlist_S{season}.xml.gz
```

**Dump Contents:**
- All cards for a specific season
- Card metadata (nation, rarity, flag)
- Updated daily at ~12:00 UTC

### NS API Endpoints

**Card Deck API:**
```
https://www.nationstates.net/cgi-bin/api.cgi?nationname={nation}&q=cards+deck
```

**Verification API:**
```
https://www.nationstates.net/cgi-bin/api.cgi?a=verify&nation={nation}&checksum={checksum}
```

**Rate Limiting:**
- 50 requests per 30 seconds
- Must include `User-Agent` header
- Exponential backoff on rate limit errors

## Daily Card Sync

### Sync Service

Automated daily sync of NS card data:

```typescript
import { XMLParser } from 'fast-xml-parser';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);

async function syncNSCards(season: number) {
  console.log(`Starting NS card sync for season ${season}...`);

  // 1. Fetch card dump
  const dumpUrl = `https://www.nationstates.net/pages/cardlist_S${season}.xml.gz`;
  const response = await fetch(dumpUrl, {
    headers: {
      'User-Agent': 'IxStats Card System (https://ixstats.com, contact@ixstats.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NS card dump: ${response.status}`);
  }

  // 2. Decompress
  const compressedData = Buffer.from(await response.arrayBuffer());
  const xmlData = await gunzipAsync(compressedData);

  // 3. Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  const parsed = parser.parse(xmlData.toString());

  // 4. Process cards
  const cards = parsed.CARDS.CARD;
  let imported = 0;
  let updated = 0;

  for (const nsCard of cards) {
    const result = await upsertNSCard(nsCard, season);
    if (result === 'created') imported++;
    if (result === 'updated') updated++;
  }

  console.log(`Sync complete: ${imported} imported, ${updated} updated`);

  return {
    season,
    totalCards: cards.length,
    imported,
    updated,
    timestamp: new Date()
  };
}
```

### Card Upsert Logic

```typescript
async function upsertNSCard(nsCard: NSCardData, season: number) {
  // Map NS rarity to IxStats rarity
  const rarity = mapNSRarity(nsCard.RARITY);

  // Check if card exists
  const existing = await db.card.findUnique({
    where: {
      nsCardId_season: {
        nsCardId: parseInt(nsCard['@_id']),
        season
      }
    }
  });

  if (existing) {
    // Update IxStats-specific metadata only
    await db.card.update({
      where: { id: existing.id },
      data: {
        nsData: nsCard, // Store full NS data
        updatedAt: new Date()
      }
    });
    return 'updated';
  } else {
    // Create new card
    await db.card.create({
      data: {
        title: nsCard.NAME,
        description: `${nsCard.TYPE} from NationStates`,
        artwork: nsCard.FLAG,
        cardType: CardType.NS_IMPORT,
        rarity,
        season,

        nsCardId: parseInt(nsCard['@_id']),
        nsSeason: season,
        nsData: nsCard,

        stats: {
          // NS cards don't have IxStats-style stats
          nsRarity: nsCard.RARITY,
          nsType: nsCard.TYPE
        },

        totalSupply: 0, // Will be tracked as users acquire
        marketValue: 0 // Will be set by market activity
      }
    });
    return 'created';
  }
}
```

### Rarity Mapping

```typescript
function mapNSRarity(nsRarity: string): CardRarity {
  const rarityMap: Record<string, CardRarity> = {
    'common': CardRarity.COMMON,
    'uncommon': CardRarity.UNCOMMON,
    'rare': CardRarity.RARE,
    'ultra-rare': CardRarity.ULTRA_RARE,
    'epic': CardRarity.EPIC,
    'legendary': CardRarity.LEGENDARY
  };

  return rarityMap[nsRarity.toLowerCase()] || CardRarity.COMMON;
}
```

## Collection Import

### Verification Flow

Before importing, verify user owns the NS nation:

```typescript
async function verifyNSOwnership(
  nation: string,
  checksum: string
): Promise<boolean> {
  const apiUrl = new URL('https://www.nationstates.net/cgi-bin/api.cgi');
  apiUrl.searchParams.set('a', 'verify');
  apiUrl.searchParams.set('nation', nation);
  apiUrl.searchParams.set('checksum', checksum);

  const response = await fetch(apiUrl.toString(), {
    headers: {
      'User-Agent': 'IxStats Card System (https://ixstats.com, contact@ixstats.com)'
    }
  });

  const text = await response.text();

  // NS returns "1" for valid, "0" for invalid
  return text.trim() === '1';
}
```

### Generating Verification Checksum

User must generate checksum in NS:

```typescript
/**
 * Instructions for user:
 * 1. Go to your nation page in NationStates
 * 2. Settings -> API -> Generate verification code
 * 3. Copy the verification code
 * 4. Paste it into IxStats import form
 */

function getVerificationInstructions(): string {
  return `
To import your NationStates collection:

1. Visit your nation page on NationStates.net
2. Navigate to Settings > API
3. Click "Generate Verification Code"
4. Copy the verification code
5. Paste the code below and click "Verify"

Your NS nation name: ___________
Verification code:  ___________
  `;
}
```

### Fetching NS Deck

```typescript
interface NSCardDeck {
  cards: Array<{
    cardId: number;
    season: number;
    count: number;
  }>;
}

async function fetchNSDeck(nation: string): Promise<NSCardDeck> {
  const apiUrl = new URL('https://www.nationstates.net/cgi-bin/api.cgi');
  apiUrl.searchParams.set('nationname', nation);
  apiUrl.searchParams.set('q', 'cards+deck');

  // Rate limiting
  await rateLimiter.acquire();

  const response = await fetch(apiUrl.toString(), {
    headers: {
      'User-Agent': 'IxStats Card System (https://ixstats.com, contact@ixstats.com)'
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - retry after delay
      await sleep(30000); // Wait 30 seconds
      return fetchNSDeck(nation);
    }
    throw new Error(`Failed to fetch NS deck: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);

  return {
    cards: parsed.NATION.CARDS.DECK.map((card: any) => ({
      cardId: parseInt(card['@_id']),
      season: parseInt(card['@_season']),
      count: parseInt(card.COUNT)
    }))
  };
}
```

### Import Process

```typescript
async function importNSCollection(
  userId: string,
  nsNation: string,
  verificationCode: string
): Promise<ImportResult> {
  // 1. Verify ownership
  const verified = await verifyNSOwnership(nsNation, verificationCode);
  if (!verified) {
    throw new Error('Could not verify NS nation ownership');
  }

  // 2. Fetch NS deck
  const nsDeck = await fetchNSDeck(nsNation);

  // 3. Import cards
  let imported = 0;
  let skipped = 0;

  for (const deckCard of nsDeck.cards) {
    // Find or create NS card in our database
    const card = await findOrCreateNSCard(
      deckCard.cardId,
      deckCard.season
    );

    if (!card) {
      // Card not yet synced - skip
      skipped++;
      continue;
    }

    // Check if user already owns
    const existing = await db.cardOwnership.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId: card.id
        }
      }
    });

    if (existing) {
      // Update quantity
      await db.cardOwnership.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: deckCard.count }
        }
      });
    } else {
      // Create new ownership
      await db.cardOwnership.create({
        data: {
          userId,
          cardId: card.id,
          quantity: deckCard.count,
          acquiredMethod: AcquireMethod.NS_IMPORT,
          metadata: {
            originalNS: true,
            nsNation,
            importDate: new Date()
          }
        }
      });
    }

    imported++;
  }

  // 4. Award import bonus
  await awardIxCredits(userId, 100, 'EARN_CARD', {
    reason: 'NS_COLLECTION_IMPORT',
    cardsImported: imported
  });

  // 5. Store NS nation association
  await db.user.update({
    where: { id: userId },
    data: {
      nsNation,
      nsVerified: true,
      nsLastSync: new Date()
    }
  });

  return {
    imported,
    skipped,
    totalCards: nsDeck.cards.length,
    bonusCredits: 100
  };
}
```

### Finding/Creating NS Cards

```typescript
async function findOrCreateNSCard(
  nsCardId: number,
  season: number
): Promise<Card | null> {
  // Try to find existing card
  let card = await db.card.findUnique({
    where: {
      nsCardId_season: {
        nsCardId,
        season
      }
    }
  });

  if (card) return card;

  // Card not yet synced - fetch from NS API
  try {
    const nsCardData = await fetchNSCardData(nsCardId, season);
    card = await upsertNSCard(nsCardData, season);
    return card;
  } catch (error) {
    console.error(`Failed to fetch NS card ${nsCardId}:`, error);
    return null;
  }
}
```

## Rate Limiting

### Rate Limiter Implementation

```typescript
class NSRateLimiter {
  private queue: Array<() => void> = [];
  private requestCount = 0;
  private windowStart = Date.now();

  private readonly MAX_REQUESTS = 50;
  private readonly WINDOW_MS = 30000; // 30 seconds

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private processQueue(): void {
    const now = Date.now();

    // Reset window if needed
    if (now - this.windowStart >= this.WINDOW_MS) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Process as many requests as allowed
    while (
      this.queue.length > 0 &&
      this.requestCount < this.MAX_REQUESTS
    ) {
      const resolve = this.queue.shift()!;
      this.requestCount++;
      resolve();
    }

    // Schedule next batch if queue not empty
    if (this.queue.length > 0) {
      const timeUntilReset = this.WINDOW_MS - (now - this.windowStart);
      setTimeout(() => this.processQueue(), timeUntilReset);
    }
  }
}

const rateLimiter = new NSRateLimiter();
```

### Error Handling

```typescript
async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquire();
      return await fetcher();
    } catch (error) {
      lastError = error as Error;

      // Check if rate limited
      if (error.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited, waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
        await sleep(delay);
        continue;
      }

      // Other errors - don't retry
      throw error;
    }
  }

  throw lastError!;
}
```

## NS Market Watch

### Tracking NS Auctions

Monitor NS auction activity for price trends:

```typescript
async function syncNSMarketData() {
  // Note: This would require scraping or official NS market API
  // Placeholder for future implementation

  const auctions = await fetchNSAuctions(); // Hypothetical

  for (const auction of auctions) {
    const card = await db.card.findUnique({
      where: {
        nsCardId_season: {
          nsCardId: auction.cardId,
          season: auction.season
        }
      }
    });

    if (!card) continue;

    // Store price data point
    await db.cardPriceHistory.create({
      data: {
        cardId: card.id,
        price: auction.currentBid,
        source: 'NS_MARKET',
        timestamp: new Date()
      }
    });

    // Update market value if appropriate
    await updateCardMarketValue(card.id);
  }
}
```

### Price Arbitrage Alerts

Alert users to arbitrage opportunities:

```typescript
async function checkArbitrageOpportunities(userId: string) {
  const userCards = await db.cardOwnership.findMany({
    where: {
      userId,
      card: { cardType: CardType.NS_IMPORT }
    },
    include: { card: true }
  });

  const opportunities: ArbitrageOpportunity[] = [];

  for (const ownership of userCards) {
    const nsPrice = await fetchNSMarketPrice(ownership.card.nsCardId);
    const ixstatsPrice = ownership.card.marketValue;

    // Check for significant price difference
    const priceDiff = Math.abs(nsPrice - ixstatsPrice);
    const percentDiff = (priceDiff / Math.min(nsPrice, ixstatsPrice)) * 100;

    if (percentDiff > 20) { // 20% difference threshold
      opportunities.push({
        card: ownership.card,
        nsPrice,
        ixstatsPrice,
        percentDiff,
        recommendation: nsPrice > ixstatsPrice ? 'SELL_ON_NS' : 'SELL_ON_IXSTATS'
      });
    }
  }

  if (opportunities.length > 0) {
    await sendNotification(userId, {
      type: 'ARBITRAGE_OPPORTUNITY',
      opportunities
    });
  }

  return opportunities;
}
```

## Usage Examples

### Import Collection Flow

```typescript
function NSImportWizard() {
  const [step, setStep] = useState<'nation' | 'verify' | 'importing' | 'complete'>('nation');
  const [nsNation, setNsNation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const importMutation = api.nsIntegration.importNSCollection.useMutation({
    onSuccess: (result) => {
      setStep('complete');
      toast.success(`Imported ${result.imported} cards! +${result.bonusCredits} IxC bonus`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return (
    <div className="ns-import-wizard">
      {step === 'nation' && (
        <div className="step-nation">
          <h2>Enter Your NationStates Nation</h2>
          <Input
            value={nsNation}
            onChange={(e) => setNsNation(e.target.value)}
            placeholder="nation-name"
          />
          <Button onClick={() => setStep('verify')}>
            Next
          </Button>
        </div>
      )}

      {step === 'verify' && (
        <div className="step-verify">
          <h2>Verify Ownership</h2>
          <p>{getVerificationInstructions()}</p>
          <Input
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Verification code"
          />
          <Button
            onClick={() => {
              setStep('importing');
              importMutation.mutate({ nsNation, verificationCode });
            }}
          >
            Import Collection
          </Button>
        </div>
      )}

      {step === 'importing' && (
        <div className="step-importing">
          <Spinner />
          <p>Importing your NationStates collection...</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="step-complete">
          <h2>Import Complete!</h2>
          <p>Imported {importMutation.data?.imported} cards</p>
          <p>Earned {importMutation.data?.bonusCredits} IxCredits bonus</p>
          <Button onClick={() => router.push('/cards/mycards')}>
            View My Cards
          </Button>
        </div>
      )}
    </div>
  );
}
```

### View NS Card Data

```typescript
function NSCardDetails({ card }: { card: Card }) {
  const { data: nsData } = api.nsIntegration.getNSCardData.useQuery({
    nsCardId: card.nsCardId!,
    season: card.nsSeason!
  });

  return (
    <div className="ns-card-details">
      <h3>NationStates Data</h3>

      <div className="ns-info">
        <InfoRow label="NS Card ID" value={card.nsCardId} />
        <InfoRow label="Season" value={card.nsSeason} />
        <InfoRow label="NS Rarity" value={nsData?.rarity} />
        <InfoRow label="Nation Type" value={nsData?.type} />
      </div>

      <div className="ns-links">
        <a
          href={`https://www.nationstates.net/page=deck/card=${card.nsCardId}/season=${card.nsSeason}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on NationStates →
        </a>
      </div>
    </div>
  );
}
```

## Admin Operations

### Manual Sync

```typescript
function AdminNSSync() {
  const [season, setSeason] = useState(3);

  const syncMutation = api.nsIntegration.syncNSCards.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Synced season ${result.season}: ` +
        `${result.imported} new, ${result.updated} updated`
      );
    }
  });

  return (
    <div className="admin-ns-sync">
      <h2>Manual NS Card Sync</h2>

      <Input
        type="number"
        value={season}
        onChange={(e) => setSeason(parseInt(e.target.value))}
        label="Season"
      />

      <Button
        onClick={() => syncMutation.mutate({ season })}
        disabled={syncMutation.isPending}
      >
        Sync Season {season}
      </Button>
    </div>
  );
}
```

## API Reference

See [API Documentation](../reference/api-complete.md#ns-integration-router) for complete endpoint specifications.

## Database Schema

```prisma
model Card {
  // ... other fields ...

  // NS Integration
  nsCardId          Int?            @unique
  nsSeason          Int?
  nsData            Json?           // Full NS card data

  @@index([nsCardId, nsSeason])
}

model User {
  // ... other fields ...

  // NS Integration
  nsNation          String?
  nsVerified        Boolean         @default(false)
  nsLastSync        DateTime?
}

model CardOwnership {
  // ... other fields ...

  metadata          Json?           // { originalNS: true, nsNation, importDate }
}
```

## See Also

- [Cards System](./cards.md) - Card types and ownership
- [Card Packs System](./card-packs.md) - Pack mechanics
- [API Reference](../reference/api-complete.md#ns-integration-router) - Complete endpoints
- [Database Reference](../reference/database.md) - Full schema
