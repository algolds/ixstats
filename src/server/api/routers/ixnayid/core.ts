import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { lookupWikiUser } from "~/lib/wiki-os/adapters/ixstates/user-sync";

export const ixnayidCoreRouter = createTRPCRouter({
  // =========================================================================
  // STATUS — all linked accounts at once
  // =========================================================================

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        clerkUserId: true,
        countryId: true,
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
        wikiUserId: true,
        wikiUsername: true,
        lastWikiSync: true,
        discordUserId: true,
        discordUsername: true,
        lastDiscordSync: true,
        country: { select: { id: true, name: true, slug: true } },
      },
    });

    let country = user?.country ?? null;
    if (!country && user?.countryId) {
      country = await db.country.findUnique({
        where: { id: user.countryId },
        select: { id: true, name: true, slug: true },
      });
    }

    if (!country && user?.clerkUserId) {
      const tpAccount = await db.thinkpagesAccount.findFirst({
        where: { clerkUserId: user.clerkUserId, isActive: true },
        select: { countryId: true },
      });
      if (tpAccount?.countryId) {
        country = await db.country.findUnique({
          where: { id: tpAccount.countryId },
          select: { id: true, name: true, slug: true },
        });
      }
    }

    const activeWikiName = user?.wikiUsername || country?.name || null;
    const passportHandle =
      user?.wikiUsername ||
      user?.forumUsername ||
      country?.slug ||
      country?.name ||
      ((ctx.user as any)?.username !== "admin" ? (ctx.user as any)?.username : null) ||
      user?.clerkUserId ||
      user?.id ||
      null;

    return {
      passportHandle,
      countrySlug:
        country?.slug ??
        (country?.name ? country.name.toLowerCase().replace(/ /g, "_") : null),
      forum: {
        linked: !!user?.forumUserId || !!user?.forumUsername,
        username: user?.forumUsername ?? null,
        lastSync: user?.lastForumSync ?? null,
      },
      wiki: {
        linked: !!activeWikiName,
        username: activeWikiName,
        isCustomClaimed: !!user?.wikiUsername,
        lastSync: user?.lastWikiSync ?? null,
      },
      discord: {
        linked: !!user?.discordUserId,
        userId: user?.discordUserId ?? null,
        username: user?.discordUsername ?? null,
        lastSync: user?.lastDiscordSync ?? null,
      },
    };
  }),

  // =========================================================================
  // LOOKUP — preview before linking
  // =========================================================================

  lookupForumUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { lookupForumUser } = await import("~/server/modules/forum");
      return lookupForumUser(input.username);
    }),

  lookupWikiUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      return lookupWikiUser(input.username);
    }),
});
