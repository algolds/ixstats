import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { cardArticleSourceSchema } from "~/lib/cards/card-sources";

export const loreCardsWikiRouter = createTRPCRouter({
  /**
   * Resolve author info for a wiki article (Page Creator + Top Contributor)
   */
  getCardAuthorInfo: publicProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1),
        source: cardArticleSourceSchema.default("ixwiki"),
      })
    )
    .query(async ({ input }) => {
      try {
        const titleKey = input.articleTitle.replace(/_/g, " ").trim().toLowerCase();
        const authorMap = await wikiLoreCardGenerator.fetchArticleAuthorInfoBatch(
          [input.articleTitle],
          input.source
        );
        const authorInfo = authorMap.get(titleKey) ||
          authorMap.get(input.articleTitle.toLowerCase()) ||
          authorMap.get(input.articleTitle) || {
            creator: "Unknown",
            displayAuthor: "Unknown",
          };

        return { authorInfo };
      } catch (error) {
        console.error("[Lore Cards] Error resolving card author info:", error);
        return {
          authorInfo: {
            creator: "Unknown",
            displayAuthor: "Unknown",
          },
        };
      }
    }),
});
