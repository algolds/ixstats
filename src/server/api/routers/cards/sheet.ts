/** The card sheet (spec §2.3 Detail sheet), and the wiki excerpt its About section reads. */
import { z } from "zod";
import { cardArticleSourceSchema } from "~/lib/cards/card-sources";
import { parseSheetFrom } from "~/lib/cards/face/sheet-link";
import { loadCardSheet } from "~/lib/cards/hub/sheet";
import { createTRPCRouter, publicProcedure, publicReadOnlyProcedure } from "~/server/api/trpc";
import { holderOf, playersOf, vaultVisible } from "./_passport";

export const cardsSheetRouter = createTRPCRouter({
  /**
   * Signed out too (owner decision): a visitor sees a card only where a player shows it publicly, and is asked to sign
   * in everywhere else (`loadCardSheet`). Signed in or out, on the read-only rate limit.
   */
  getSheet: publicReadOnlyProcedure
    // `from` is a kind, a dot and its value: a passport handle runs to 255 characters (`holder.` plus 255).
    .input(z.object({ cardId: z.string().min(1).max(64), from: z.string().max(262).nullish() }))
    .query(({ ctx, input }) =>
      loadCardSheet(ctx.db, ctx.user?.id ?? null, input.cardId, {
        from: parseSheetFrom(input.from),
        rules: { vaultVisible, holderOf, playersOf },
      })
    ),

  /**
   * Fetch wiki article wikitext/excerpt on-demand for lore cards
   */
  getWikiArticleExcerpt: publicProcedure
    .input(z.object({ articleTitle: z.string().min(1), wikiSource: cardArticleSourceSchema }))
    .query(async ({ input }) => {
      const { getArticleWikitext, getArticleIntro } =
        await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const article = await getArticleWikitext(input.articleTitle, input.wikiSource);
      if (article?.wikitext) {
        return { extract: article.wikitext, wikitext: article.wikitext };
      }
      const result = await getArticleIntro(input.articleTitle, input.wikiSource);
      return { extract: result?.text ?? null, wikitext: result?.text ?? null };
    }),
});
