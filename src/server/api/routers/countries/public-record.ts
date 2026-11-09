import { z } from "zod";
import { rarityRank } from "~/lib/cards/face/labels";
import { CARD_FACE_SELECT, toCardFace } from "~/lib/cards/hub/faces";
import { cleanLeadImage, extractMainTitles } from "~/lib/country/cover-topics";
import { loadCoverArticles } from "~/server/modules/countries/countries.covers";
import { publicProcedure } from "~/server/api/trpc";
import {
  DRAFT_DIRECTIVE_TIER,
  PUBLIC_DIRECTIVE_STATUSES,
  PUBLIC_ISSUE_STATUSES,
  toPublicDirectives,
  toPublicIssueOutcomes,
} from "~/lib/country/public-record";

/**
 * The country profile's public record (`/countries/[slug]`), readable by anyone, signed out
 * included. Only enacted directives and resolved national issues leave the server, and only
 * their public fields: no drafts, abandoned directives, open/expired/dismissed issues, package
 * line items, budgets, executive bandwidth or applied consequences (`~/lib/country/public-record`).
 */
const wikiFilename = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const match = url.match(/\/images\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)$/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

/** Standard canonical encyclopedia topic titles for a country. */
function canonicalTopicTitles(name: string): string[] {
  return [
    `History of ${name}`,
    `Government of ${name}`,
    `Economy of ${name}`,
    `Foreign relations of ${name}`,
    `Politics of ${name}`,
    `Culture of ${name}`,
    `Geography of ${name}`,
    `Demographics of ${name}`,
    `Education in ${name}`,
    `Imperial Armed Forces of ${name}`,
    `Armed Forces of ${name}`,
    `Military of ${name}`,
    `National Assembly (${name})`,
    `Senate of ${name}`,
    `Parliament of ${name}`,
    `Council of Ministers (${name})`,
    `Judiciary of ${name}`,
    `Constitution of ${name}`,
    `Administrative divisions of ${name}`,
    `Provinces of ${name}`,
    `Religion in ${name}`,
    `Health in ${name}`,
    `Climate of ${name}`,
  ];
}

const RELEVANT_LINKED_TOPIC_RE =
  /\b(econom|govern|politic|foreign|diplom|armed|militar|nav|imperator|emperor|empress|king|queen|president|chancellor|monarch|senat|assembl|parliament|corcillum|ministr|council|court|judic|constitut|histor|geograph|cultur|demograph|educat|relig|church|budget|tax|bank|treasur|administrat|provin)/i;

export const publicRecordProcedures = {
  /** The articles that may picture each Factbook block, in priority order (public, cached wiki data). */
  getCoverArticles: publicProcedure
    .input(
      z.object({
        countryName: z.string().trim().min(2).max(200),
        capital: z.string().trim().max(200).nullish(),
        largestCity: z.string().trim().max(200).nullish(),
        legislature: z.string().trim().max(200).nullish(),
      })
    )
    .query(({ ctx, input }) => {
      const { countryName, ...topics } = input;
      return loadCoverArticles(ctx.db, countryName, topics);
    }),

  getPublicRecord: publicProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        countryName: z.string().optional(),
        directiveLimit: z.number().int().min(1).max(100).default(50),
        issueLimit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const trimmedName = input.countryName?.trim() ?? "";
      const hasName = trimmedName.length >= 2;

      const [intents, issues, cardImageRows, rootArticle, cardRows] = await Promise.all([
        ctx.db.intent.findMany({
          where: {
            countryId: input.countryId,
            status: { in: [...PUBLIC_DIRECTIVE_STATUSES] },
            tier: { not: DRAFT_DIRECTIVE_TIER },
          },
          orderBy: { createdIxTime: "desc" },
          take: input.directiveLimit,
          select: {
            id: true,
            goal: true,
            summary: true,
            tier: true,
            category: true,
            status: true,
            progress: true,
            createdIxTime: true,
          },
        }),
        ctx.db.nationalIssue.findMany({
          where: {
            countryId: input.countryId,
            status: { in: [...PUBLIC_ISSUE_STATUSES] },
          },
          orderBy: { respondedAt: "desc" },
          take: input.issueLimit,
          select: {
            id: true,
            title: true,
            domain: true,
            status: true,
            chosenOptionLabel: true,
            autoResolveLabel: true,
            consequenceLog: true,
            respondedIxTime: true,
            createdIxTime: true,
          },
        }),
        ctx.db.cardBackgroundImage?.findMany
          ? ctx.db.cardBackgroundImage.findMany({
              where: { countryId: input.countryId },
              select: { cardType: true, imageUrl: true },
            })
          : Promise.resolve([]),
        hasName && ctx.db.wikiArticle?.findFirst
          ? ctx.db.wikiArticle.findFirst({
              where: {
                namespace: 0,
                status: "PUBLISHED",
                title: { equals: trimmedName, mode: "insensitive" },
              },
              select: {
                id: true,
                title: true,
                slug: true,
                wikitext: true,
              },
            })
          : Promise.resolve(null),
        ctx.db.card?.findMany
          ? ctx.db.card.findMany({
              where: {
                reviewState: "APPROVED",
                isRetired: false,
                NOT: { artwork: "" },
                OR: [
                  { countryId: input.countryId },
                  ...(hasName
                    ? [
                        { title: { contains: trimmedName, mode: "insensitive" as const } },
                        {
                          wikiArticleTitle: {
                            contains: trimmedName,
                            mode: "insensitive" as const,
                          },
                        },
                      ]
                    : []),
                ],
              },
              orderBy: [{ marketValue: "desc" }, { createdAt: "desc" }],
              take: 24,
              // The face fields (the same face the Vault draws), plus the wiki title for article art.
              select: { ...CARD_FACE_SELECT, wikiArticleTitle: true },
            })
          : Promise.resolve([]),
      ]);

      const mainTitles = extractMainTitles(rootArticle?.wikitext);
      const topicTitles = hasName ? canonicalTopicTitles(trimmedName) : [];
      const canonicalOrder = [...new Set([...mainTitles, ...topicTitles])];
      const canonicalRank = new Map<string, number>();
      canonicalOrder.forEach((title, idx) => {
        const key = title.toLowerCase();
        if (!canonicalRank.has(key)) canonicalRank.set(key, idx);
      });

      const articleRows =
        hasName && ctx.db.wikiArticle?.findMany
          ? await ctx.db.wikiArticle.findMany({
              where: {
                namespace: 0,
                status: "PUBLISHED",
                NOT: [
                  { title: { startsWith: "Portal:" } },
                  { title: { startsWith: "Template:" } },
                  { title: { equals: trimmedName, mode: "insensitive" } },
                ],
                OR: rootArticle?.id
                  ? [
                      { title: { in: canonicalOrder, mode: "insensitive" } },
                      {
                        incomingLinks: { some: { sourceArticleId: rootArticle.id } },
                        title: { contains: trimmedName, mode: "insensitive" },
                      },
                    ]
                  : [
                      { title: { in: canonicalOrder, mode: "insensitive" } },
                      { title: { contains: trimmedName, mode: "insensitive" } },
                    ],
              },
              orderBy: { wordCount: "desc" },
              take: 36,
              select: {
                id: true,
                title: true,
                slug: true,
                summary: true,
                leadImageUrl: true,
                readingTime: true,
              },
            })
          : [];

      const cardArtByTitle = new Map<string, string>();
      for (const card of cardRows) {
        const art = card.artwork?.trim();
        if (!art) continue;
        if (card.wikiArticleTitle) {
          cardArtByTitle.set(card.wikiArticleTitle.trim().toLowerCase(), art);
        }
        cardArtByTitle.set(card.title.trim().toLowerCase(), art);
      }

      const relevantArticles = articleRows
        .filter((a) => {
          const key = a.title.trim().toLowerCase();
          return canonicalRank.has(key) || RELEVANT_LINKED_TOPIC_RE.test(a.title);
        })
        .sort((a, b) => {
          const rankA = canonicalRank.get(a.title.trim().toLowerCase()) ?? 999;
          const rankB = canonicalRank.get(b.title.trim().toLowerCase()) ?? 999;
          if (rankA !== rankB) return rankA - rankB;
          return (b.readingTime ?? 0) - (a.readingTime ?? 0);
        });

      const seenCardTitles = new Set<string>();
      const seenCardImages = new Set<string>();
      const uniqueCards = [...cardRows]
        .filter((card) => Boolean(card.artwork?.trim()))
        .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))
        .filter((card) => {
          const key = card.title.trim().toLowerCase();
          const imgKey = (wikiFilename(card.artwork) ?? card.artwork ?? "").trim().toLowerCase();
          if (
            !key ||
            !card.artwork ||
            seenCardTitles.has(key) ||
            (imgKey && seenCardImages.has(imgKey))
          ) {
            return false;
          }
          seenCardTitles.add(key);
          if (imgKey) seenCardImages.add(imgKey);
          return true;
        })
        .slice(0, 6);

      return {
        directives: toPublicDirectives(intents),
        issueOutcomes: toPublicIssueOutcomes(issues),
        media: {
          cardImages: Object.fromEntries(cardImageRows.map((r) => [r.cardType, r.imageUrl])),
          articles: relevantArticles.map((a) => {
            const key = a.title.trim().toLowerCase();
            const imageUrl = cleanLeadImage(a.leadImageUrl) ?? cardArtByTitle.get(key) ?? null;
            return {
              id: a.id,
              title: a.title,
              slug: a.slug,
              summary: a.summary,
              imageUrl,
              readingTime: a.readingTime,
            };
          }),
          // A showcase, not the viewer's collection: faces show their art unmuted.
          cards: uniqueCards.map((card) => toCardFace(card, { collected: true })),
        },
      };
    }),
};
