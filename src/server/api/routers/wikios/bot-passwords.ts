/**
 * bot-passwords.ts — Special:BotPasswords tRPC router (plan 410).
 *
 * A signed-in user with a passport handle creates app-specific bot passwords for the WikiOS `api.php` endpoint
 * (Pywikibot, AWB, the Discord bot). A bot logs in as `handle@App`, and each approved claimed name also works in
 * place of the handle (IxnayID design decision 11). The work lives in `lib/wiki-os/api-compat/bot-passwords.ts`;
 * this router validates input and maps refusals.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, lightMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { requireWikiUserId, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { refreshWikiosEditingFlag } from "~/lib/wiki-os/editing-switch";
import { assertWikiosWritable, refusals } from "~/lib/wiki-os/permissions";
import { namesOfUser } from "~/lib/identity/wiki-names";
import { BOT_GRANTS, GRANT_DESCRIPTIONS } from "~/lib/wiki-os/api-compat/grants";
import {
  createBotPassword,
  deleteBotPassword,
  listBotPasswords,
} from "~/lib/wiki-os/api-compat/bot-passwords";

/** The caller's WikiOS user id and passport handle; PRECONDITION_FAILED until they pick a handle. */
async function requireHandleUser(
  ctx: WikiAuthContext & { db: Pick<PrismaClient, "user"> }
): Promise<{ userId: string; handle: string }> {
  const userId = requireWikiUserId(ctx);
  const user = await ctx.db.user.findUnique({ where: { id: userId }, select: { handle: true } });
  if (!user?.handle) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Pick a passport handle in Settings before creating a bot password.",
    });
  }
  return { userId, handle: user.handle };
}

export const wikiosBotPasswordsRouter = createTRPCRouter({
  /**
   * The caller's bot passwords (never the passwords), the grants on offer, the handle a bot logs in as and the
   * approved claimed names (hidden ones too: this is the owner's own view) that work in its place.
   */
  listBotPasswords: readOnlyProcedure.query(async ({ ctx }) => {
    const { userId, handle } = await requireHandleUser(ctx);
    const names = await namesOfUser(ctx.db, userId);
    return {
      handle,
      aliases: names.map((claim) => claim.name),
      grants: BOT_GRANTS.map((grant) => ({ grant, description: GRANT_DESCRIPTIONS[grant] })),
      botPasswords: await listBotPasswords(userId),
    };
  }),

  /** Create a bot password. The password comes back once; it is stored only as a hash. */
  createBotPassword: lightMutationProcedure
    .input(
      z.object({
        appId: z.string().min(1).max(32),
        grants: z.array(z.enum(BOT_GRANTS)).max(BOT_GRANTS.length).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await refreshWikiosEditingFlag();
      assertWikiosWritable();
      const { userId, handle } = await requireHandleUser(ctx);
      const created = await refusals(createBotPassword(userId, input));
      return {
        id: created.summary.id,
        appId: created.summary.appId,
        /** What the bot sends as `lgname`. */
        loginName: `${handle}@${created.summary.appId}`,
        password: created.password,
      };
    }),

  deleteBotPassword: lightMutationProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      await refreshWikiosEditingFlag();
      assertWikiosWritable();
      const { userId } = await requireHandleUser(ctx);
      await refusals(deleteBotPassword(userId, input.id));
      return { success: true as const };
    }),
});
