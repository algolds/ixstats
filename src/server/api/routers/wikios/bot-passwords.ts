/**
 * bot-passwords.ts — Special:BotPasswords tRPC router (plan 410).
 *
 * A signed-in user with a verified wiki link creates app-specific bot passwords for the WikiOS
 * `api.php` endpoint (Pywikibot, AWB, the Discord bot). The work lives in
 * `lib/wiki-os/api-compat/bot-passwords.ts`; this router validates input and maps refusals.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { requireWikiUserId, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { assertWikiosWritable, refusals } from "~/lib/wiki-os/permissions";
import { getVerifiedWikiLink } from "~/lib/wiki-os/storage";
import { BOT_GRANTS, GRANT_DESCRIPTIONS } from "~/lib/wiki-os/api-compat/grants";
import {
  createBotPassword,
  deleteBotPassword,
  listBotPasswords,
} from "~/lib/wiki-os/api-compat/bot-passwords";

/** The caller's WikiOS user id and verified wiki username; PRECONDITION_FAILED when they have not linked a wiki account. */
async function requireLinkedUser(
  ctx: WikiAuthContext
): Promise<{ userId: string; wikiUsername: string }> {
  const userId = requireWikiUserId(ctx);
  const link = await getVerifiedWikiLink(userId);
  if (!link) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Link and verify your wiki account before creating a bot password.",
    });
  }
  return { userId, wikiUsername: link.username };
}

export const wikiosBotPasswordsRouter = createTRPCRouter({
  /** The caller's bot passwords (never the passwords), the grants on offer and the wiki name a bot logs in as. */
  listBotPasswords: readOnlyProcedure.query(async ({ ctx }) => {
    const { userId, wikiUsername } = await requireLinkedUser(ctx);
    return {
      wikiUsername,
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
      assertWikiosWritable();
      const { userId, wikiUsername } = await requireLinkedUser(ctx);
      const created = await refusals(createBotPassword(userId, input));
      return {
        id: created.summary.id,
        appId: created.summary.appId,
        /** What the bot sends as `lgname`. */
        loginName: `${wikiUsername}@${created.summary.appId}`,
        password: created.password,
      };
    }),

  deleteBotPassword: lightMutationProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      assertWikiosWritable();
      const { userId } = await requireLinkedUser(ctx);
      await refusals(deleteBotPassword(userId, input.id));
      return { success: true as const };
    }),
});
