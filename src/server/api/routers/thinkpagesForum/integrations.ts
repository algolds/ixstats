/**
 * The IxStates integration reads (docs/superpowers/specs/2026-10-10-thinkpages-forum-integrations-design.md), merged
 * into `thinkpagesForum`: the newest board messages for Home's "Your realm" panel and for a realm's overview. Thin:
 * validates and calls ~/server/modules/thinkpages-forum. Both are queries and write nothing.
 */
import { z } from "zod";
import { createTRPCRouter, rateLimitedPublicProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { realmBoardPreview, realmPanel } from "~/server/modules/thinkpages-forum";
import { memberOf, realm } from "./viewer";

export const thinkpagesForumIntegrationsRouter = createTRPCRouter({
  /** Home's "Your realm": the board of the realm of the caller's current country, or null without one. */
  realmPanel: readOnlyProcedure.query(({ ctx }) => realmPanel(ctx.db, memberOf(ctx.user))),

  /** A realm's newest board messages for anyone who may see the realm; null for an unknown or hidden one. */
  realmBoardPreview: rateLimitedPublicProcedure
    .input(z.object({ slug: realm }))
    .query(({ ctx, input }) =>
      realmBoardPreview(ctx.db, ctx.user ? memberOf(ctx.user) : null, input.slug)
    ),
});
