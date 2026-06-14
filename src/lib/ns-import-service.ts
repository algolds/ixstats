/**
 * NationStates Import Service
 *
 * Business logic layer for importing NS trading cards into IxCards system.
 * Maps NS data to IxStats Card model and handles import workflows.
 */

import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { CardType, CardRarity } from "~/lib/card-enums";
import { nsApiClient, type NSCard } from "~/lib/ns-api-client";
import { type CardCreationData } from "~/lib/card-service";

/**
 * Import result interface
 */
export interface ImportResult {
  success: boolean;
  cardsImported: number;
  duplicatesSkipped: number;
  errors: string[];
  totalValue: number;
  nationName: string;
  bonusCredits: number;
}

/**
 * Duplicate check result
 */
export interface DuplicateReport {
  duplicates: Array<{
    cardId: number;
    season: number;
    title: string;
  }>;
  total: number;
}

/**
 * Import progress callback
 */
export type ImportProgressCallback = (progress: {
  current: number;
  total: number;
  status: string;
}) => void;

/**
 * NS rarity to IxCards CardRarity mapping
 */
const NS_RARITY_MAP: Record<string, CardRarity> = {
  common: CardRarity.COMMON,
  uncommon: CardRarity.UNCOMMON,
  rare: CardRarity.RARE,
  "ultra-rare": CardRarity.ULTRA_RARE,
  epic: CardRarity.EPIC,
  legendary: CardRarity.LEGENDARY,
};

/**
 * Government type → stat profile mapping (all 28 standard NS govt types)
 * Each profile: [economic, diplomatic, military, social]
 */
const GOVT_STAT_PROFILES: Record<string, [number, number, number, number]> = {
  Anarchy: [20, 15, 10, 30],
  "Authoritarian Democracy": [50, 40, 60, 35],
  "Benevolent Dictatorship": [45, 50, 55, 50],
  "Capitalist Paradise": [90, 45, 30, 25],
  Capitalizt: [85, 40, 25, 20],
  "Civil Rights Lovefest": [40, 70, 15, 95],
  "Compulsory Consumerist State": [75, 35, 45, 30],
  "Conservative Democracy": [60, 55, 50, 45],
  "Corporate Bordello": [80, 30, 35, 20],
  "Corporate Police State": [70, 25, 75, 15],
  "Corrupt Dictatorship": [35, 15, 70, 10],
  "Democratic Socialists": [50, 65, 25, 75],
  "Father Knows Best State": [55, 35, 65, 30],
  "Free-Market Paradise": [85, 50, 20, 35],
  "Inoffensive Centrist Democracy": [50, 60, 30, 55],
  "Iron Fist Consumerists": [65, 20, 80, 15],
  "Iron Fist Socialists": [30, 20, 85, 20],
  "Left-Leaning College State": [45, 65, 15, 80],
  "Left-wing Utopia": [40, 70, 10, 90],
  "Liberal Democratic Socialists": [50, 70, 20, 80],
  "Libertarian Police State": [70, 30, 70, 20],
  "Moralistic Democracy": [55, 55, 45, 50],
  "Mother Knows Best State": [50, 40, 60, 40],
  "New York Times Democracy": [60, 65, 35, 65],
  "Psychotic Dictatorship": [25, 10, 90, 5],
  "Right-wing Utopia": [75, 40, 50, 30],
  "Scandinavian Liberal Paradise": [55, 75, 15, 85],
  "Tyranny by Majority": [45, 35, 55, 40],
};

/**
 * NationStates Import Service
 */
export class NSImportService {
  /**
   * Map NS rarity to IxStats CardRarity enum
   */
  mapNSRarity(nsRarity: string): CardRarity {
    const normalized = nsRarity.toLowerCase().trim();
    return NS_RARITY_MAP[normalized] || CardRarity.COMMON;
  }

  /**
   * Convert NS market value to IxCredits
   * Conversion rate: 1 NS bank = 10 IxCredits
   */
  convertNSValueToIxCredits(nsValue: number): number {
    return Math.round(nsValue * 10 * 100) / 100; // 10x multiplier, rounded to 2 decimals
  }

  /**
   * Generate gameplay stats (economic/diplomatic/military/social, each 0-100)
   * from NS card metadata fields.
   */
  generateCardStats(
    nsData: {
      govt?: string;
      marketValue?: string;
      badge?: string;
      trophies?: string;
      region?: string;
      category?: string;
      cardcategory?: string;
    },
    cardId?: number
  ): { economic: number; diplomatic: number; military: number; social: number } {
    // Deterministic jitter seeded from cardId (±3)
    const jitter = (seed: number, index: number) => {
      const hash = ((seed * 2654435761 + index * 40503) >>> 0) % 7;
      return hash - 3; // -3 to +3
    };

    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    const id = cardId ?? 0;

    // Look up government profile (provides balanced base stats)
    const profile = GOVT_STAT_PROFILES[nsData.govt || ""] ?? [45, 40, 35, 40];

    // Market value bonus (scales economic stat)
    const mv = parseFloat(nsData.marketValue || "0");
    const marketBonus = Math.min(mv * 15, 30); // 0-30 from market value

    // Badge/trophy bonus (diplomatic + social boost)
    const hasBadge = !!nsData.badge;
    const trophyCount = parseInt(nsData.trophies || "0") || 0;
    const badgeBonus = hasBadge ? 10 : 0;
    const trophyBonus = Math.min(trophyCount * 3, 15);

    return {
      economic: clamp(profile[0] + marketBonus + jitter(id, 0)),
      diplomatic: clamp(profile[1] + badgeBonus + Math.floor(trophyBonus / 2) + jitter(id, 1)),
      military: clamp(profile[2] + jitter(id, 2)),
      social: clamp(profile[3] + Math.floor(trophyBonus / 2) + jitter(id, 3)),
    };
  }

  /**
   * Map NS card to IxStats Card creation data
   */
  mapNSCardToIxCard(nsCard: NSCard): CardCreationData {
    // Generate description from available NS data
    const description =
      nsCard.description ||
      nsCard.slogan ||
      nsCard.motto ||
      `${nsCard.category || "Unknown"} from ${nsCard.region || "Unknown"}`;

    // Use NS flag as artwork
    const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

    // Parse numeric values
    const cardId = parseInt(nsCard.id);
    const season = parseInt(nsCard.season);
    const marketValue = parseFloat(nsCard.market_value || "0");

    return {
      title: nsCard.name || `Card ${cardId}`,
      description,
      artwork,
      artworkVariants: nsCard.flag
        ? {
            original: nsCard.flag,
            thumbnail: nsCard.flag,
            large: nsCard.flag,
            flagUrl: nsCard.flag,
          }
        : undefined,
      cardType: CardType.NS_IMPORT,
      rarity: this.mapNSRarity(nsCard.rarity),
      season,
      nsCardId: cardId,
      nsSeason: season,
      wikiSource: undefined,
      wikiArticleTitle: nsCard.name,
      wikiUrl: undefined,
      countryId: undefined,
      stats: {
        region: nsCard.region,
        category: nsCard.category,
        govt: nsCard.govt,
        cardcategory: nsCard.cardcategory,
        marketValue: nsCard.market_value,
        badge: nsCard.badge,
        trophies: nsCard.trophies,
        ...this.generateCardStats(
          {
            govt: nsCard.govt,
            marketValue: nsCard.market_value,
            badge: nsCard.badge,
            trophies: nsCard.trophies,
            region: nsCard.region,
            category: nsCard.category,
            cardcategory: nsCard.cardcategory,
          },
          cardId
        ),
      },
      totalSupply: 1,
      marketValue: this.convertNSValueToIxCredits(marketValue),
      level: 1,
      evolutionStage: undefined,
      enhancements: undefined,
    };
  }

  /**
   * Check for duplicate cards before import
   */
  async checkForDuplicates(
    db: PrismaClient,
    cardIds: Array<{ id: number; season: number }>
  ): Promise<DuplicateReport> {
    const duplicates: DuplicateReport["duplicates"] = [];

    for (const { id, season } of cardIds) {
      const existing = await db.card.findFirst({
        where: {
          nsCardId: id,
          nsSeason: season,
        },
        select: {
          id: true,
          title: true,
          nsCardId: true,
          nsSeason: true,
        },
      });

      if (existing && existing.nsCardId && existing.nsSeason) {
        duplicates.push({
          cardId: existing.nsCardId,
          season: existing.nsSeason,
          title: existing.title,
        });
      }
    }

    return {
      duplicates,
      total: duplicates.length,
    };
  }

  /**
   * Import a single NS card
   */
  async importCard(
    db: PrismaClient,
    nsCard: NSCard,
    userId: string,
    options: {
      skipDuplicates?: boolean;
      nationName?: string;
    } = {}
  ): Promise<{ card: any; isNew: boolean; ownership: any }> {
    const cardId = parseInt(nsCard.id);
    const season = parseInt(nsCard.season);

    // Check if card definition exists
    let card = await db.card.findFirst({
      where: {
        nsCardId: cardId,
        nsSeason: season,
      },
    });

    const isNew = !card;

    if (!card) {
      // Create new card definition
      const cardData = this.mapNSCardToIxCard(nsCard);

      card = await db.card.create({
        data: {
          id: `card_ns_${cardId}_s${season}`,
          title: cardData.title,
          description: cardData.description || null,
          artwork: cardData.artwork,
          artworkVariants: cardData.artworkVariants || null,
          cardType: cardData.cardType,
          rarity: cardData.rarity || CardRarity.COMMON,
          season: cardData.season,
          nsCardId: cardData.nsCardId,
          nsSeason: cardData.nsSeason,
          wikiSource: cardData.wikiSource || null,
          wikiArticleTitle: cardData.wikiArticleTitle || null,
          countryId: cardData.countryId || null,
          stats: cardData.stats,
          metadata: {
            nsData: {
              id: nsCard.id,
              season: nsCard.season,
              rarity: nsCard.rarity,
              name: nsCard.name,
              region: nsCard.region,
              category: nsCard.category,
              govt: nsCard.govt,
              type: nsCard.type,
              cardcategory: nsCard.cardcategory,
              slogan: nsCard.slogan,
              motto: nsCard.motto,
              description: nsCard.description,
              badge: nsCard.badge,
              trophies: nsCard.trophies,
              market_value: nsCard.market_value,
              flag: nsCard.flag,
            },
            importedFrom: options.nationName || "unknown",
            importedAt: new Date().toISOString(),
          },
          marketValue: cardData.marketValue,
          totalSupply: cardData.totalSupply,
          level: cardData.level,
          enhancements: cardData.enhancements || null,
        },
      });
    }

    // Create or update card ownership
    const existingOwnership = await db.cardOwnership.findFirst({
      where: {
        userId,
        cardId: card.id,
      },
    });

    let ownership;

    if (existingOwnership) {
      if (options.skipDuplicates) {
        ownership = existingOwnership;
      } else {
        // Increment quantity
        ownership = await db.cardOwnership.update({
          where: { id: existingOwnership.id },
          data: {
            quantity: existingOwnership.quantity + 1,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Get next serial number
      const maxSerial = await db.cardOwnership.findFirst({
        where: { cardId: card.id },
        orderBy: { serialNumber: "desc" },
        select: { serialNumber: true },
      });
      const nextSerial = (maxSerial?.serialNumber || 0) + 1;

      // Create new ownership
      ownership = await db.cardOwnership.create({
        data: {
          id: `own_${Date.now()}_${userId}_${card.id}`,
          userId,
          ownerId: userId,
          cardId: card.id,
          serialNumber: nextSerial,
          quantity: 1,
          level: 1,
          experience: 0,
          isLocked: false,
          acquiredAt: new Date(),
        },
      });
    }

    return { card, isNew, ownership };
  }

  /**
   * Import nation's entire deck
   */
  async importNationDeck(
    db: PrismaClient,
    nationName: string,
    userId: string,
    options: {
      skipDuplicates?: boolean;
      progressCallback?: ImportProgressCallback;
    } = {}
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      cardsImported: 0,
      duplicatesSkipped: 0,
      errors: [],
      totalValue: 0,
      nationName,
      bonusCredits: 0,
    };

    try {
      // Fetch deck from NS API
      const deckData = await nsApiClient.fetchDeck(nationName);

      if (!deckData || deckData.cards.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates or deck is empty",
        });
      }

      // eslint-disable-next-line unused-imports/no-unused-vars
      const totalCards = deckData.cards.length;

      // Deduplicate cards and track quantities
      const cardMap = new Map<string, { card: NSCard; quantity: number }>();

      for (const card of deckData.cards) {
        const key = `${card.id}-${card.season}`;
        const existing = cardMap.get(key);

        if (existing) {
          existing.quantity += 1;
        } else {
          cardMap.set(key, { card, quantity: 1 });
        }
      }

      const uniqueCards = Array.from(cardMap.values());

      // Process each unique card
      for (let i = 0; i < uniqueCards.length; i++) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        const { card: nsCard, quantity } = uniqueCards[i]!;

        if (options.progressCallback) {
          options.progressCallback({
            current: i + 1,
            total: uniqueCards.length,
            status: `Importing ${nsCard.name || `Card ${nsCard.id}`}...`,
          });
        }

        try {
          // Fetch full card info if name is missing
          if (!nsCard.name) {
            const cardInfo = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
            if (cardInfo) {
              Object.assign(nsCard, cardInfo);
            }
          }

          // Skip if still no name
          if (!nsCard.name) {
            result.errors.push(`Card ${nsCard.id} S${nsCard.season}: No name available`);
            continue;
          }

          // Import the card
          const importResult = await this.importCard(db, nsCard, userId, {
            skipDuplicates: options.skipDuplicates,
            nationName,
          });

          if (importResult.ownership) {
            result.cardsImported++;
            result.totalValue += importResult.card.marketValue || 0;
          } else if (options.skipDuplicates) {
            result.duplicatesSkipped++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Card ${nsCard.name || nsCard.id}: ${errorMsg}`);
          console.error(`[NS Import] Failed to import card:`, error);
        }
      }

      // Calculate bonus IxCredits
      result.bonusCredits = Math.min(result.cardsImported * 10, 500);

      // Award bonus to vault
      if (result.bonusCredits > 0) {
        await this.awardImportBonus(db, userId, result.bonusCredits, nationName, result);
      }

      result.success = result.cardsImported > 0;

      return result;
    } catch (error) {
      console.error("[NS Import] Import failed:", error);
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
      return result;
    }
  }

  /**
   * Award import bonus IxCredits to user's vault
   */
  private async awardImportBonus(
    db: PrismaClient,
    userId: string,
    bonusAmount: number,
    nationName: string,
    importResult: ImportResult
  ): Promise<void> {
    try {
      // Get or create user's vault
      const vault = await db.myVault.upsert({
        where: { userId },
        create: {
          userId,
          credits: bonusAmount,
        },
        update: {
          credits: { increment: bonusAmount },
        },
      });

      // Get updated balance
      const updatedVault = await db.myVault.findUnique({
        where: { id: vault.id },
        select: { credits: true },
      });

      // Create transaction record
      await db.vaultTransaction.create({
        data: {
          id: `vtx_ns_import_${userId}_${Date.now()}`,
          vaultId: vault.id,
          credits: bonusAmount,
          balanceAfter: updatedVault?.credits ?? bonusAmount,
          type: "EARN",
          source: "ns_import_bonus",
          metadata: {
            nationName,
            cardsImported: importResult.cardsImported,
            totalValue: importResult.totalValue,
          },
        },
      });

      console.log(
        `[NS Import] Awarded ${bonusAmount} IxCredits to user ${userId} for importing ${nationName}`
      );
    } catch (error) {
      console.error("[NS Import] Failed to award bonus credits:", error);
      // Don't throw - import should succeed even if bonus fails
    }
  }

  /**
   * Get import statistics for a user
   */
  async getImportStats(
    db: PrismaClient,
    userId: string
  ): Promise<{
    totalImports: number;
    totalCards: number;
    totalValue: number;
    lastImport: Date | null;
  }> {
    // Count NS import transactions
    const vault = await db.myVault.findUnique({
      where: { userId },
      include: {
        transactions: {
          where: {
            source: "ns_import_bonus",
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const imports = vault?.transactions || [];
    const totalImports = imports.length;
    const lastImport = imports[0]?.createdAt || null;

    // Count imported cards
    const importedCards = await db.cardOwnership.findMany({
      where: {
        userId,
        cards: {
          cardType: CardType.NS_IMPORT,
        },
      },
      include: {
        cards: true,
      },
    });

    const totalCards = importedCards.reduce((sum, ownership) => sum + ownership.quantity, 0);
    const totalValue = importedCards.reduce(
      (sum, ownership) => sum + (ownership.cards.marketValue || 0),
      0
    );

    return {
      totalImports,
      totalCards,
      totalValue,
      lastImport,
    };
  }

  /**
   * Validate nation ownership before import
   */
  async validateNationOwnership(
    db: PrismaClient,
    userId: string,
    nationName: string,
    verificationId: string
  ): Promise<boolean> {
    const verification = await db.nSVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      return false;
    }

    return (
      verification.userId === userId &&
      verification.nationName.toLowerCase() === nationName.toLowerCase() &&
      verification.verified === true &&
      verification.expiresAt > new Date()
    );
  }
}

/**
 * Singleton instance
 */
export const nsImportService = new NSImportService();
