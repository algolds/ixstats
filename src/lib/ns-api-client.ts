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

      // Extract DECK section
      const deckMatch = xml.match(/<DECK>(.*?)<\/DECK>/);
      if (!deckMatch) {
        console.log("[NS API] No DECK section found in XML");
        console.log("[NS API] XML preview:", xml.substring(0, 500));
        return { nation: nationName, cards: [], deck_value: 0, num_cards: 0 };
      }

      const deckXml = deckMatch[1];
      console.log("[NS API] Found DECK section, length:", deckXml.length);

      // Extract all CARD elements
      const cardMatches = Array.from(deckXml.matchAll(/<CARD>(.*?)<\/CARD>/g));
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
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, "i");
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

      // Extract card details
      const name = this.extractTag(xml, "NAME");
      const flag = this.extractTag(xml, "FLAG");
      const region = this.extractTag(xml, "REGION");
      const category = this.extractTag(xml, "TYPE");
      const slogan = this.extractTag(xml, "SLOGAN");
      const motto = this.extractTag(xml, "MOTTO");
      const govt = this.extractTag(xml, "GOVT");

      // Convert flag path to full URL
      const flagUrl = flag ? `https://www.nationstates.net/${flag}` : undefined;

      return {
        name: name || undefined,
        flag: flagUrl,
        region: region || undefined,
        category: category || govt || undefined,
        slogan: slogan || undefined,
        motto: motto || undefined,
      };
    } catch (error) {
      console.error(`[NS API] Failed to fetch card info for ${cardId} S${season}:`, error);
      return null;
    }
  }

  /**
   * Rate limit helper (NS API rate limit: 50 requests per 30 seconds)
   */
  private async rateLimit() {
    await new Promise((resolve) => setTimeout(resolve, 600)); // 600ms between requests
  }
}

/**
 * Singleton instance
 */
export const nsApiClient = new NSApiClient();
