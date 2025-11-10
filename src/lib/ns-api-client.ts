/**
 * NationStates API Client
 *
 * Provides integration with NationStates Trading Cards API for importing card collections
 * and syncing daily card dumps. Complies with NS API rate limits (50 requests per 30 seconds).
 *
 * Features:
 * - Daily card dump download and parsing
 * - NS deck fetching via API
 * - NS nation ownership verification
 * - User collection import with IxC rewards
 * - Automatic rate limiting and retry logic
 * - Content caching with 24hr TTL for dumps
 *
 * NS API Documentation:
 * - https://www.nationstates.net/pages/api.html
 * - Trading Cards API: https://www.nationstates.net/pages/api.html#tradingcardsapi
 * - Daily Dumps: https://www.nationstates.net/pages/cardlist_S{season}.xml.gz
 *
 * @see /nationstates-trading-cards-info.md for complete NS API details
 */

import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { XMLParser } from "fast-xml-parser";
import { externalApiCache, type CacheOptions } from "./external-api-cache";

/**
 * NS API Rate Limiter
 * Enforces 50 requests per 30 seconds as per NS API requirements
 */
class NSRateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 50;
  private readonly windowMs = 30000; // 30 seconds

  /**
   * Check rate limit and wait if necessary
   * Uses flush bucket algorithm matching NS API rate limiting
   */
  async checkLimit(): Promise<void> {
    const now = Date.now();
    // Remove requests outside the current window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]!;
      const waitTime = this.windowMs - (now - oldestRequest);
      console.log(`[NS API] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkLimit();
    }

    this.requests.push(now);
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.maxRequests - this.requests.length;
  }
}

// Singleton rate limiter instance
const rateLimiter = new NSRateLimiter();

/**
 * NS API configuration
 */
const NS_API_CONFIG = {
  USER_AGENT: "IxStats Cards (https://ixstats.com; contact@ixstats.com)",
  BASE_URL: "https://www.nationstates.net",
  CARD_DUMP_URL: (season: number) => `https://www.nationstates.net/pages/cardlist_S${season}.xml.gz`,
  API_URL: "https://www.nationstates.net/cgi-bin/api.cgi",
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
} as const;

/**
 * NS Card data structure from daily dump
 */
export interface NSCard {
  id: string;
  season: number;
  nation: string;
  rarity: "common" | "uncommon" | "rare" | "ultra-rare" | "epic" | "legendary";
  flag: string;
  region: string;
  cardCategory: string;
  marketValue?: number;
  badge?: string;
}

/**
 * NS Deck data structure from API
 */
export interface NSDeck {
  nation: string;
  cards: Array<{
    cardId: string;
    nation: string;
    season: number;
    rarity: string;
    marketValue: number;
  }>;
  value?: number;
  bank?: number;
  lastValued?: string;
}

/**
 * NS API Error types
 */
export class NSAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "NSAPIError";
  }
}

/**
 * Make HTTP request with proper NS API headers and retry logic
 */
async function makeNSRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  await rateLimiter.checkLimit();

  const headers = {
    "User-Agent": NS_API_CONFIG.USER_AGENT,
    ...options.headers,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < NS_API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[NS API] Request to ${url} (attempt ${attempt + 1}/${NS_API_CONFIG.MAX_RETRIES})`);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Check for rate limit errors
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : NS_API_CONFIG.RETRY_DELAYS[attempt] || 4000;
        console.log(`[NS API] Rate limited, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new NSAPIError(
          `NS API returned ${response.status}: ${response.statusText}`,
          response.status,
          response.status >= 500 // Server errors are retryable
        );
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (error instanceof NSAPIError && !error.retryable) {
        throw error; // Don't retry non-retryable errors
      }

      if (attempt < NS_API_CONFIG.MAX_RETRIES - 1) {
        const delay = NS_API_CONFIG.RETRY_DELAYS[attempt] || 4000;
        console.log(`[NS API] Request failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new NSAPIError("NS API request failed after all retries");
}

/**
 * Download and decompress NS card dump for a season
 * Uses streaming for large file downloads
 *
 * @param season - Season number (1, 2, 3, etc.)
 * @returns Raw XML data as string
 */
export async function fetchCardDump(season: number): Promise<string> {
  // Check cache first (24hr TTL)
  const cacheOptions: CacheOptions = {
    service: "custom",
    type: "json",
    identifier: `ns-card-dump-s${season}`,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  };

  const cached = await externalApiCache.get<string>(cacheOptions);
  if (cached) {
    console.log(`[NS API] Using cached card dump for season ${season}`);
    return cached.data;
  }

  console.log(`[NS API] Downloading card dump for season ${season}`);
  const url = NS_API_CONFIG.CARD_DUMP_URL(season);

  const response = await makeNSRequest(url);
  const buffer = await response.arrayBuffer();

  // Decompress gzip data
  const decompressed = gunzipSync(Buffer.from(buffer));
  const xmlData = decompressed.toString("utf-8");

  // Cache the result
  await externalApiCache.set(cacheOptions, xmlData, {
    source: "ns-card-dump",
    downloadSize: buffer.byteLength,
    decompressedSize: xmlData.length,
  });

  console.log(`[NS API] Downloaded and cached ${xmlData.length} bytes of XML data`);
  return xmlData;
}

/**
 * Parse NS card dump XML into structured card objects
 *
 * @param xmlData - Raw XML string from card dump
 * @returns Array of NSCard objects
 */
export function parseNSDump(xmlData: string): NSCard[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });

  const parsed = parser.parse(xmlData);
  const cards: NSCard[] = [];

  // NS card dump structure: <CARDS><CARD>...</CARD></CARDS>
  const cardList = Array.isArray(parsed.CARDS?.CARD)
    ? parsed.CARDS.CARD
    : parsed.CARDS?.CARD
      ? [parsed.CARDS.CARD]
      : [];

  for (const card of cardList) {
    cards.push({
      id: card.CARDID?.toString() || card.id?.toString(),
      season: parseInt(card.SEASON?.toString() || card.season?.toString()),
      nation: card.NAME || card.nation,
      rarity: (card.CATEGORY || card.rarity || "common").toLowerCase(),
      flag: card.FLAG || card.flag || "",
      region: card.REGION || card.region || "",
      cardCategory: card.TYPE || card.cardCategory || "",
      badge: card.BADGE || card.badge,
    });
  }

  console.log(`[NS API] Parsed ${cards.length} cards from dump`);
  return cards;
}

/**
 * Sync NS cards to database (upsert logic)
 * Used by daily sync job to keep card library up to date
 *
 * @param season - Season number to sync
 * @returns Number of cards synced
 */
export async function syncNSCards(season: number): Promise<number> {
  console.log(`[NS API] Starting card sync for season ${season}`);

  const xmlData = await fetchCardDump(season);
  const cards = parseNSDump(xmlData);

  // Note: Actual database upsert will be implemented in ns-card-sync-service.ts
  // This function provides the card data for syncing

  console.log(`[NS API] Sync prepared ${cards.length} cards for season ${season}`);
  return cards.length;
}

/**
 * Fetch a user's NS deck via API
 *
 * @param nationName - NS nation name
 * @returns Deck data with cards owned
 */
export async function fetchNSDeck(nationName: string): Promise<NSDeck> {
  // Check cache first (1hr TTL)
  const cacheOptions: CacheOptions = {
    service: "custom",
    type: "json",
    identifier: `ns-deck-${nationName.toLowerCase()}`,
    ttl: 60 * 60 * 1000, // 1 hour
  };

  const cached = await externalApiCache.get<NSDeck>(cacheOptions);
  if (cached) {
    console.log(`[NS API] Using cached deck for nation ${nationName}`);
    return cached.data;
  }

  console.log(`[NS API] Fetching deck for nation ${nationName}`);
  const url = `${NS_API_CONFIG.API_URL}?q=cards+deck;nationname=${encodeURIComponent(nationName)}`;

  const response = await makeNSRequest(url);
  const xmlData = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const parsed = parser.parse(xmlData);

  // Parse deck data from NS API response
  // Structure is: CARDS > DECK > CARD (array)
  const cardsRoot = parsed.CARDS || {};
  const deckCards = cardsRoot.DECK?.CARD || [];
  const cardsArray = Array.isArray(deckCards) ? deckCards : deckCards ? [deckCards] : [];

  const deck: NSDeck = {
    nation: nationName,
    cards: cardsArray.map((card: any) => ({
      cardId: card.CARDID?.toString() || card.id?.toString(),
      nation: card.NAME?.toString() || "",
      season: parseInt(card.SEASON?.toString() || "1"),
      rarity: card.CATEGORY?.toString()?.toLowerCase() || "common",
      marketValue: parseFloat(card.MARKET_VALUE?.toString() || "0"),
    })),
    value: parseFloat(cardsRoot.DECK_VALUE?.toString() || "0"),
    bank: parseFloat(cardsRoot.BANK?.toString() || "0"),
    lastValued: cardsRoot.LAST_VALUED ? new Date(parseInt(cardsRoot.LAST_VALUED) * 1000).toISOString() : undefined,
  };

  // Cache the result
  await externalApiCache.set(cacheOptions, deck, {
    source: "ns-deck-api",
    cardCount: deck.cards.length,
  });

  console.log(`[NS API] Fetched deck with ${deck.cards.length} cards`);
  return deck;
}

/**
 * Verify NS nation ownership using verification code method
 * User visits https://www.nationstates.net/page=verify_login to get code
 *
 * @param nationName - NS nation name to verify
 * @param checksum - Verification code from NS
 * @returns True if verification succeeds
 */
export async function verifyNSOwnership(
  nationName: string,
  checksum: string
): Promise<boolean> {
  console.log(`[NS API] Verifying ownership of nation ${nationName}`);

  const url = `${NS_API_CONFIG.API_URL}?a=verify&nation=${encodeURIComponent(nationName)}&checksum=${encodeURIComponent(checksum)}`;

  try {
    const response = await makeNSRequest(url);
    const result = await response.text();

    // NS API returns "1" for successful verification, "0" for failure
    const verified = result.trim() === "1";

    console.log(`[NS API] Verification ${verified ? "SUCCESS" : "FAILED"} for nation ${nationName}`);
    return verified;
  } catch (error) {
    console.error(`[NS API] Verification error for nation ${nationName}:`, error);
    return false;
  }
}

/**
 * Get single card data from NS API
 *
 * @param cardId - NS card ID
 * @param season - Season number
 * @returns Card data
 */
export async function getNSCardData(cardId: string, season: number): Promise<NSCard | null> {
  // Check cache first (1hr TTL for individual cards)
  const cacheOptions: CacheOptions = {
    service: "custom",
    type: "json",
    identifier: `ns-card-${season}-${cardId}`,
    ttl: 60 * 60 * 1000, // 1 hour
  };

  const cached = await externalApiCache.get<NSCard>(cacheOptions);
  if (cached) {
    console.log(`[NS API] Using cached card data for ${cardId} S${season}`);
    return cached.data;
  }

  console.log(`[NS API] Fetching card data for ${cardId} S${season}`);
  const url = `${NS_API_CONFIG.API_URL}?q=card+info;cardid=${cardId};season=${season}`;

  try {
    const response = await makeNSRequest(url);
    const xmlData = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
    });

    const parsed = parser.parse(xmlData);
    const cardData = parsed.CARD;

    if (!cardData) {
      console.warn(`[NS API] Card not found: ${cardId} S${season}`);
      return null;
    }

    const card: NSCard = {
      id: cardId,
      season,
      nation: cardData.NAME || "",
      rarity: (cardData.CATEGORY || "common").toLowerCase(),
      flag: cardData.FLAG || "",
      region: cardData.REGION || "",
      cardCategory: cardData.TYPE || "",
      marketValue: parseFloat(cardData.MARKET_VALUE || "0"),
      badge: cardData.BADGE,
    };

    // Cache the result
    await externalApiCache.set(cacheOptions, card, {
      source: "ns-card-api",
    });

    return card;
  } catch (error) {
    console.error(`[NS API] Error fetching card ${cardId} S${season}:`, error);
    return null;
  }
}

/**
 * Import NS collection for a user
 * Awards 100 IxC bonus for successful import
 * Note: Actual database operations handled by router
 *
 * @param userId - IxStats user ID
 * @param nsNation - NS nation name
 * @param verificationCode - NS verification code
 * @returns Import result with card count and bonus awarded
 */
export async function importNSCollection(
  userId: string,
  nsNation: string,
  verificationCode: string
): Promise<{
  success: boolean;
  cardsImported: number;
  ixcBonus: number;
  error?: string;
}> {
  console.log(`[NS API] Starting collection import for user ${userId}, nation ${nsNation}`);

  // Verify ownership
  const verified = await verifyNSOwnership(nsNation, verificationCode);
  if (!verified) {
    return {
      success: false,
      cardsImported: 0,
      ixcBonus: 0,
      error: "NS nation ownership verification failed",
    };
  }

  // Fetch deck
  const deck = await fetchNSDeck(nsNation);

  // Return data for database processing
  // Actual card creation and IxC award handled by router with database transaction
  return {
    success: true,
    cardsImported: deck.cards.length,
    ixcBonus: 100,
  };
}

/**
 * Get rate limiter status for monitoring
 */
export function getRateLimiterStatus() {
  return {
    remainingRequests: rateLimiter.getRemainingRequests(),
    maxRequests: 50,
    windowSeconds: 30,
  };
}
