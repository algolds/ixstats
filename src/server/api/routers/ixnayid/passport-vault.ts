import { db } from "~/server/db";

export async function resolvePassportVault(userId?: string | null) {
  const base = {
    totalCards: 0,
    deckValue: 0,
    collectorLevel: 1,
    collectorXp: 0,
    credits: 0,
    topCards: [] as Array<{
      ownershipId: string;
      cardId: string;
      title: string;
      rarity: string;
      marketValue: number;
      artworkUrl: string | null;
      cardType: string;
      card?: any;
      ownership?: any;
    }>,
  };

  if (!userId) return base;

  try {
    const [myVault, liveCount, liveValueAgg, ownerships] = await Promise.all([
      (db as any).myVault.findUnique({
        where: { userId },
        select: { credits: true, vaultLevel: true, vaultXp: true },
      }).catch(() => null),
      (db as any).cardOwnership.count({
        where: { ownerId: userId, cards: { isRetired: false } },
      }).catch(() => null),
      (db as any).cardOwnership.findMany({
        where: { ownerId: userId, cards: { isRetired: false } },
        select: { quantity: true, cards: { select: { marketValue: true } } },
      } as any).catch(() => []),
      (db as any).cardOwnership.findMany({
        where: { ownerId: userId },
        take: 6,
        orderBy: [{ createdAt: "desc" }],
        include: {
          cards: {
            select: {
              id: true,
              title: true,
              name: true,
              description: true,
              slug: true,
              category: true,
              subcategory: true,
              rarity: true,
              cardType: true,
              season: true,
              level: true,
              marketValue: true,
              totalSupply: true,
              artworkUrl: true,
              artwork: true,
              wikiSource: true,
              wikiArticleTitle: true,
              wikiPageId: true,
              wikiExcerpt: true,
              wikiImageUrl: true,
              stats: true,
              metadata: true,
              attributes: true,
              nsCardId: true,
              nsSeason: true,
              nsData: true,
            },
          },
        },
      }).catch(() => []),
    ]);

    if (myVault) {
      base.credits = Math.floor(myVault.credits ?? 0);
      base.collectorLevel = myVault.vaultLevel ?? base.collectorLevel;
      base.collectorXp = myVault.vaultXp ?? base.collectorXp;
    }

    if (typeof liveCount === "number") base.totalCards = liveCount;
    if (Array.isArray(liveValueAgg)) {
      const liveDeck = liveValueAgg.reduce(
        (s: number, o: any) => s + (o.cards?.marketValue ?? 0) * (o.quantity ?? 1),
        0
      );
      base.deckValue = liveDeck;
    }

    if (Array.isArray(ownerships) && ownerships.length) {
      base.topCards = ownerships.map((o: any) => {
        const c = o.cards;
        return {
          ownershipId: o.id,
          cardId: o.cardId,
          title: c?.title ?? c?.name ?? "IxCard",
          rarity: c?.rarity ?? "COMMON",
          marketValue: c?.marketValue ?? 0,
          artworkUrl: c?.artworkUrl ?? c?.artwork ?? c?.wikiImageUrl ?? null,
          cardType: c?.cardType ?? "UNKNOWN",
          card: c
            ? {
                id: c.id,
                title: c.title ?? c.name ?? "IxCard",
                description: c.description ?? null,
                artwork: c.artwork ?? "",
                artworkVariants: null,
                cardType: c.cardType ?? "UNKNOWN",
                category: c.category ?? null,
                subcategory: c.subcategory ?? null,
                artworkUrl: c.artworkUrl ?? null,
                artworkSource: null,
                artworkCredit: null,
                slug: c.slug ?? null,
                rarity: c.rarity ?? "COMMON",
                season: c.season ?? 1,
                nsCardId: c.nsCardId ?? null,
                nsSeason: c.nsSeason ?? null,
                nsData: c.nsData ?? null,
                wikiSource: c.wikiSource ?? null,
                wikiArticleTitle: c.wikiArticleTitle ?? null,
                wikiPageId: c.wikiPageId ?? null,
                wikiExcerpt: c.wikiExcerpt ?? null,
                wikiImageUrl: c.wikiImageUrl ?? null,
                wikiUrl: c.wikiArticleTitle
                  ? `https://${c.wikiSource === "iiwiki" ? "iiwiki.com" : "ixwiki.com"}/wiki/${encodeURIComponent(c.wikiArticleTitle)}`
                  : null,
                countryId: null,
                stats: c.stats ?? {},
                metadata: c.metadata ?? null,
                attributes: c.attributes ?? {},
                ownershipId: o.id,
                isLocked: o.isLocked ?? false,
                marketValue: c.marketValue ?? 0,
                totalSupply: c.totalSupply ?? 0,
                level: o.level ?? c.level ?? 1,
                evolutionStage: 0,
                enhancements: null,
                createdAt: o.createdAt ?? new Date(),
                updatedAt: o.updatedAt ?? new Date(),
                lastTrade: o.lastSaleDate ?? null,
                serialNumber: o.serialNumber ?? 0,
                experience: o.experience ?? 0,
                acquiredAt: o.acquiredAt ?? o.createdAt ?? new Date(),
              }
            : null,
          ownership: o,
        };
      });
    }
  } catch {}

  return base;
}
