import { z } from "zod";
import { createTRPCRouter, lightMutationProcedure } from "~/server/api/trpc";
import { recordPostView } from "~/lib/thinkpages/post-views";

export const thinkpagesPostsViewsRouter = createTRPCRouter({
  /**
   * Count a view of a post's page (SL-8): once per signed-in viewer per post per UTC day, never
   * the author's own, public and unlisted posts only. Views feed the trending score.
   */
  recordPostView: lightMutationProcedure
    .input(z.object({ postId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => ({
      counted: await recordPostView(ctx.db, input.postId, ctx.auth.userId),
    })),
});
