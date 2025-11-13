/**
 * NationStates API Client
 *
 * Integrates with NationStates public API to fetch nation data and trading cards
 *
 * API Documentation: https://www.nationstates.net/pages/api.html
 */

export interface NSCard {
  id: string;
  season: string;
  rarity: string;
  name?: string;
  category?: string;
  region?: string;
  market_value: string;
  flag?: string;
  badge?: string;
  trophies?: string;
  slogan?: string;
  motto?: string;
  govt?: string;
  type?: string;
  description?: string;
  cardcategory?: string;
  quantity?: number; // Number of copies owned
}

interface NSDeckResponse {
  nation: string;
  cards: NSCard[];
  deck_value: number;
  num_cards: number;
}

/**
 * NationStates API Client
 */
export class NSApiClient {
  private readonly baseUrl = "https://www.nationstates.net/cgi-bin/api.cgi";
  private readonly userAgent = "IxStats/1.0 (https://ixstats.com; contact: admin@ixstats.com)";

  /**
   * Verify that a nation exists
   */
  async verifyNation(nationName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}?nation=${encodeURIComponent(nationName)}&q=name`,
        {
          headers: {
            "User-Agent": this.userAgent,
          },
        }
      );

      if (!response.ok) {
        return false;
      }

      const xml = await response.text();
      return xml.includes("<NAME>") && !xml.includes("Unknown nation");
    } catch (error) {
      console.error("[NS API] Failed to verify nation:", error);
      return false;
    }
  }

  /**
   * Fetch nation's trading card deck
   */
  async fetchDeck(nationName: string): Promise<NSDeckResponse | null> {
    try {
      // Use the Trading Cards API to fetch a nation's deck
      // Format: ?q=cards+deck;nationname=(name)
      const response = await fetch(
        `${this.baseUrl}?q=cards+deck;nationname=${encodeURIComponent(nationName)}`,
        {
          headers: {
            "User-Agent": this.userAgent,
          },
        }
      );

      if (!response.ok) {
        console.error("[NS API] Failed to fetch deck:", response.status);
        return null;
      }

      const xml = await response.text();
      console.log("[NS API] Fetched deck XML for", nationName, "- Length:", xml.length);
      const result = this.parseDeckXML(xml, nationName);
      console.log("[NS API] Parsed deck result:", result ? `${result.cards.length} cards` : "null");
      return result;
    } catch (error) {
      console.error("[NS API] Failed to fetch deck:", error);
      return null;
    }
  }

  /**
   * Parse deck XML response
   */
  private parseDeckXML(xml: string, nationName: string): NSDeckResponse | null {
    try {
      const cards: NSCard[] = [];

      // Extract DECK section (using 's' flag to match newlines)
      const deckMatch = xml.match(/<DECK>(.*?)<\/DECK>/s);
      if (!deckMatch) {
        console.log("[NS API] No DECK section found in XML");
        console.log("[NS API] XML preview:", xml.substring(0, 500));
        return { nation: nationName, cards: [], deck_value: 0, num_cards: 0 };
      }

      const deckXml = deckMatch[1];
      console.log("[NS API] Found DECK section, length:", deckXml.length);

      // Extract all CARD elements (using 'gs' flags to match newlines globally)
      const cardMatches = Array.from(deckXml.matchAll(/<CARD>(.*?)<\/CARD>/gs));
      console.log("[NS API] Found", cardMatches.length, "CARD elements");

      for (const match of cardMatches) {
        const cardXml = match[1];

        // Log the raw XML for the first card to see structure
        if (cards.length === 0) {
          console.log("[NS API] First card XML:", cardXml.substring(0, 300));
        }

        const id = this.extractTag(cardXml, "CARDID");
        const season = this.extractTag(cardXml, "SEASON");
        const rarity = this.extractTag(cardXml, "CATEGORY");

        // Try multiple possible name tags
        let name = this.extractTag(cardXml, "NAME");
        if (!name) name = this.extractTag(cardXml, "NATION");

        const category = this.extractTag(cardXml, "TYPE");
        const region = this.extractTag(cardXml, "REGION");
        const marketValue = this.extractTag(cardXml, "MARKET_VALUE");
        const flag = this.extractTag(cardXml, "FLAG");
        const badge = this.extractTag(cardXml, "BADGE");
        const trophies = this.extractTag(cardXml, "TROPHIES");
        const slogan = this.extractTag(cardXml, "SLOGAN");
        const motto = this.extractTag(cardXml, "MOTTO");

        console.log("[NS API] Parsing card:", { id, name, season, rarity, xmlPreview: cardXml.substring(0, 100) });

        // Deck API only provides: CARDID, CATEGORY, MARKET_VALUE, SEASON
        // Name and other details must be fetched separately
        if (id && season && rarity) {
          cards.push({
            id,
            season: season || "1",
            rarity: this.normalizeRarity(rarity),
            name: name || undefined,
            category: category || undefined,
            region: region || undefined,
            market_value: marketValue || "0.00",
            flag: flag || undefined,
            badge: badge || undefined,
            trophies: trophies || undefined,
            slogan: slogan || undefined,
            motto: motto || undefined,
          });
        } else {
          console.log("[NS API] Skipping card - missing required fields (id, season, or rarity)");
        }
      }

      // Calculate deck value
      const deckValue = cards.reduce((sum, card) => {
        return sum + parseFloat(card.market_value || "0");
      }, 0);

      return {
        nation: nationName,
        cards,
        deck_value: deckValue,
        num_cards: cards.length,
      };
    } catch (error) {
      console.error("[NS API] Failed to parse deck XML:", error);
      return null;
    }
  }

  /**
   * Extract value from XML tag
   */
  private extractTag(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, "is");
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Normalize NS rarity to IxCards rarity
   */
  private normalizeRarity(nsRarity: string | null): string {
    if (!nsRarity) return "COMMON";

    const rarityMap: Record<string, string> = {
      "common": "COMMON",
      "uncommon": "UNCOMMON",
      "rare": "RARE",
      "ultra-rare": "ULTRA_RARE",
      "epic": "EPIC",
      "legendary": "LEGENDARY",
    };

    const normalized = rarityMap[nsRarity.toLowerCase()];
    return normalized || "COMMON";
  }

  /**
   * Generate site-specific token for verification
   * This ensures the verification code is only valid for IxStats
   */
  generateVerificationToken(nationName: string): string {
    const secret = process.env.NS_VERIFICATION_SECRET || "ixstats-default-secret-change-in-production";
    const hash = require("crypto")
      .createHash("md5")
      .update(`${nationName.toLowerCase()}-${secret}`)
      .digest("hex");
    return hash;
  }

  /**
   * Verify nation ownership using NS verification API
   * https://www.nationstates.net/pages/api.html#verification
   */
  async verifyOwnership(nationName: string, checksum: string): Promise<boolean> {
    try {
      const token = this.generateVerificationToken(nationName);

      const response = await fetch(
        `${this.baseUrl}?a=verify&nation=${encodeURIComponent(nationName)}&checksum=${encodeURIComponent(checksum)}&token=${token}`,
        {
          headers: {
            "User-Agent": this.userAgent,
          },
        }
      );

      if (!response.ok) {
        console.error("[NS API] Verification request failed:", response.status);
        return false;
      }

      const text = await response.text();

      // API returns 1 for success, 0 for failure
      return text.trim() === "1";
    } catch (error) {
      console.error("[NS API] Failed to verify ownership:", error);
      return false;
    }
  }

  /**
   * Get the verification URL for a nation
   */
  getVerificationUrl(nationName: string): string {
    const token = this.generateVerificationToken(nationName);
    return `https://www.nationstates.net/page=verify_login?token=${token}`;
  }

  /**
   * Fetch detailed card information
   */
  async fetchCardInfo(cardId: string, season: string): Promise<Partial<NSCard> | null> {
    try {
      await this.rateLimit(); // Respect rate limits

      const response = await fetch(
        `${this.baseUrl}?q=card+info;cardid=${cardId};season=${season}`,
        {
          headers: {
            "User-Agent": this.userAgent,
          },
        }
      );

      if (!response.ok) {
        console.error(`[NS API] Failed to fetch card info for ${cardId} S${season}:`, response.status);
        return null;
      }

      const xml = await response.text();
      console.log(`[NS API] Fetched card info XML for ${cardId} S${season} - Length:`, xml.length);

      // Extract card details - comprehensive field extraction
      const name = this.extractTag(xml, "NAME");
      const flag = this.extractTag(xml, "FLAG");
      const region = this.extractTag(xml, "REGION");
      const category = this.extractTag(xml, "TYPE");
      const slogan = this.extractTag(xml, "SLOGAN");
      const motto = this.extractTag(xml, "MOTTO");
      const govt = this.extractTag(xml, "GOVT");
      const cardcategory = this.extractTag(xml, "CARDCATEGORY");
      const badge = this.extractTag(xml, "BADGE");
      const trophies = this.extractTag(xml, "TROPHIES");
      const description = this.extractTag(xml, "DESCRIPTION");

      // Construct card image URL using season-specific path
      // Cards use /images/cards/s{season}/uploads/ not /images/flags/
      let flagUrl: string | undefined = undefined;
      if (flag) {
        if (flag.startsWith('http')) {
          flagUrl = flag;
        } else {
          // Card images are stored in season-specific directories
          // e.g., /images/cards/s3/uploads/heku__147541.jpg
          flagUrl = `https://www.nationstates.net/images/cards/s${season}/${flag}`;
        }
        console.log(`[NS API] Constructed card image URL: ${flagUrl}`);
      }

      const result = {
        name: name || undefined,
        flag: flagUrl,
        region: region || undefined,
        category: category || govt || undefined,
        slogan: slogan || undefined,
        motto: motto || undefined,
        govt: govt || undefined,
        type: category || undefined,
        cardcategory: cardcategory || undefined,
        badge: badge || undefined,
        trophies: trophies || undefined,
        description: description || undefined,
      };

      console.log(`[NS API] Parsed card info for ${cardId} S${season}:`, {
        name: result.name,
        hasFlag: !!result.flag,
        region: result.region,
        category: result.category,
      });

      return result;
    } catch (error) {
      console.error(`[NS API] Failed to fetch card info for ${cardId} S${season}:`, error);
      return null;
    }
  }

  /**
   * Fetch a nation's current flag URL
   * Returns the current flag for active nations, null for ceased nations
   *
   * NOTE: This is NOT used for card images. Cards have their own snapshot images
   * stored in /images/cards/s{season}/ directories.
   */
  async fetchNationFlag(nationName: string): Promise<string | null> {
    try {
      await this.rateLimit(); // Respect rate limits

      const response = await fetch(
        `${this.baseUrl}?nation=${encodeURIComponent(nationName)}&q=flag`,
        {
          headers: {
            "User-Agent": this.userAgent,
          },
        }
      );

      // If nation doesn't exist (404) or other error, return null
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[NS API] Nation ${nationName} does not exist (404)`);
        } else if (response.status === 429) {
          console.log(`[NS API] Rate limited when fetching ${nationName} flag`);
        }
        return null;
      }

      const xml = await response.text();

      // Check if nation ceased to exist
      if (xml.includes("Unknown nation")) {
        console.log(`[NS API] Nation ${nationName} has ceased to exist`);
        return null;
      }

      const flagPath = this.extractTag(xml, "FLAG");

      if (!flagPath) {
        return null;
      }

      // NS returns full URLs for nation flags
      const fullUrl = flagPath.startsWith('http') ? flagPath : `https://www.nationstates.net/${flagPath}`;
      console.log(`[NS API] Successfully fetched current flag for ${nationName}: ${fullUrl}`);
      return fullUrl;
    } catch (error) {
      console.error(`[NS API] Failed to fetch nation flag for ${nationName}:`, error);
      return null;
    }
  }

  /**
   * Rate limit helper (NS API rate limit: 50 requests per 30 seconds)
   * Using 800ms delay to be more conservative and avoid 429 errors
   */
  private async rateLimit() {
    await new Promise((resolve) => setTimeout(resolve, 800)); // 800ms between requests
  }

  /**
   * Fetch card dump XML for a specific season
   * Downloads gzipped XML dump from NationStates
   *
   * @param season - Season number (1, 2, 3, etc.)
   * @returns Decompressed XML string
   */
  async fetchCardDump(season: number): Promise<string> {
    const dumpUrl = `https://www.nationstates.net/pages/cardlist_S${season}.xml.gz`;
    const maxRetries = 3;
    const timeoutMs = 60000; // 60 second timeout per attempt

    console.log(`[NS API] Fetching card dump for season ${season} from ${dumpUrl}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[NS API] Download attempt ${attempt}/${maxRetries} for season ${season}`);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(dumpUrl, {
          headers: {
            "User-Agent": this.userAgent,
            "Accept-Encoding": "gzip",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get("content-length");
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        console.log(`[NS API] Downloading ${totalBytes ? (totalBytes / 1024 / 1024).toFixed(2) + " MB" : "unknown size"}`);

        // Read response as ArrayBuffer for gzip decompression
        const arrayBuffer = await response.arrayBuffer();
        const compressedBytes = new Uint8Array(arrayBuffer);

        console.log(`[NS API] Downloaded ${(compressedBytes.length / 1024 / 1024).toFixed(2)} MB (compressed)`);

        // Decompress gzip using Node.js zlib (requires 'zlib' import)
        const zlib = await import("zlib");
        const { promisify } = await import("util");
        const gunzip = promisify(zlib.gunzip);

        console.log(`[NS API] Decompressing gzip data...`);
        const decompressed = await gunzip(Buffer.from(compressedBytes));
        const xmlString = decompressed.toString("utf-8");

        console.log(`[NS API] ✓ Successfully downloaded and decompressed season ${season} card dump (${(xmlString.length / 1024 / 1024).toFixed(2)} MB uncompressed)`);
        return xmlString;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[NS API] Attempt ${attempt}/${maxRetries} failed for season ${season}:`, errorMsg);

        if (attempt === maxRetries) {
          throw new Error(`Failed to fetch card dump for season ${season} after ${maxRetries} attempts: ${errorMsg}`);
        }

        // Exponential backoff: 2^attempt seconds
        const delaySeconds = Math.pow(2, attempt);
        console.log(`[NS API] Retrying in ${delaySeconds} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    throw new Error(`Failed to fetch card dump for season ${season}`);
  }

  /**
   * Parse NS card dump XML into array of NSCard objects
   * Uses streaming approach to handle large XML files (100K+ cards)
   *
   * @param xmlData - Raw XML string from card dump
   * @returns Array of NSCard objects
   */
  async parseNSDump(xmlData: string): Promise<NSCard[]> {
    const cards: NSCard[] = [];
    let parseErrors = 0;

    console.log(`[NS API] Parsing card dump XML (${(xmlData.length / 1024 / 1024).toFixed(2)} MB)`);

    try {
      // Extract all CARD elements using regex
      // Note: This is memory-intensive but faster than stream parsing for our use case
      const cardMatches = Array.from(xmlData.matchAll(/<CARD>(.*?)<\/CARD>/gs));
      const totalCards = cardMatches.length;

      console.log(`[NS API] Found ${totalCards} cards in dump`);

      let lastLogPercent = 0;

      for (let i = 0; i < cardMatches.length; i++) {
        const match = cardMatches[i];
        const cardXml = match ? match[1] : null;

        if (!cardXml) {
          parseErrors++;
          continue;
        }

        try {
          // Extract card fields
          const id = this.extractTag(cardXml, "CARDID");
          const season = this.extractTag(cardXml, "SEASON");
          const name = this.extractTag(cardXml, "NAME");
          const rarity = this.extractTag(cardXml, "CATEGORY");
          const region = this.extractTag(cardXml, "REGION");
          const marketValue = this.extractTag(cardXml, "MARKET_VALUE");
          const flag = this.extractTag(cardXml, "FLAG");
          const badge = this.extractTag(cardXml, "BADGE");
          const trophies = this.extractTag(cardXml, "TROPHIES");
          const slogan = this.extractTag(cardXml, "SLOGAN");
          const cardCategory = this.extractTag(cardXml, "TYPE");

          // Validate required fields
          if (!id || !season || !rarity) {
            parseErrors++;
            continue;
          }

          cards.push({
            id,
            season: season || "1",
            name: name || undefined,
            rarity: this.normalizeRarity(rarity),
            region: region || undefined,
            market_value: marketValue || "0.00",
            flag: flag || undefined,
            badge: badge || undefined,
            trophies: trophies || undefined,
            slogan: slogan || undefined,
            cardcategory: cardCategory || undefined,
          });

        } catch (error) {
          parseErrors++;
          if (parseErrors <= 10) {
            console.error(`[NS API] Error parsing card at index ${i}:`, error);
          }
        }

        // Progress logging every 10%
        const currentPercent = Math.floor((i / totalCards) * 100);
        if (currentPercent >= lastLogPercent + 10) {
          console.log(`[NS API] Parsing progress: ${currentPercent}% (${i}/${totalCards} cards)`);
          lastLogPercent = currentPercent;
        }
      }

      console.log(`[NS API] ✓ Successfully parsed ${cards.length} cards (${parseErrors} errors skipped)`);

      if (parseErrors > 0) {
        console.warn(`[NS API] ⚠ Encountered ${parseErrors} parse errors (${((parseErrors / totalCards) * 100).toFixed(2)}% error rate)`);
      }

      return cards;

    } catch (error) {
      console.error(`[NS API] Fatal error parsing card dump:`, error);
      throw new Error(`Failed to parse card dump: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Singleton instance
 */
export const nsApiClient = new NSApiClient();
