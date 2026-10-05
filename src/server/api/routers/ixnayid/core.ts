import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

const COUNTRY_SELECT = { id: true, name: true, slug: true } as const;

/** The user's country: the direct relation, else by id, else via an active ThinkPages persona. */
async function resolveUserCountry(user: {
  clerkUserId: string | null;
  countryId: string | null;
  country: { id: string; name: string; slug: string | null } | null;
}) {
  if (user.country) return user.country;
  if (user.countryId) {
    const byId = await db.country.findUnique({
      where: { id: user.countryId },
      select: COUNTRY_SELECT,
    });
    if (byId) return byId;
  }
  if (!user.clerkUserId) return null;
  const persona = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId: user.clerkUserId, isActive: true, countryId: { not: null } },
    select: { countryId: true },
  });
  return persona?.countryId
    ? db.country.findUnique({ where: { id: persona.countryId }, select: COUNTRY_SELECT })
    : null;
}

type LinkedUser = {
  forumUserId: number | null;
  forumUsername: string | null;
  lastForumSync: Date | null;
  discordUserId: string | null;
  discordUsername: string | null;
  lastDiscordSync: Date | null;
} | null;

function linkedAccounts(
  user: LinkedUser,
  wikiLink: { username: string; verifiedAt: Date | null } | null
) {
  return {
    forum: {
      linked: !!user?.forumUserId || !!user?.forumUsername,
      username: user?.forumUsername ?? null,
      lastSync: user?.lastForumSync ?? null,
    },
    wiki: {
      linked: !!wikiLink,
      username: wikiLink?.username ?? null,
      isCustomClaimed: !!wikiLink,
      lastSync: wikiLink?.verifiedAt ?? null,
    },
    discord: {
      linked: !!user?.discordUserId,
      userId: user?.discordUserId ?? null,
      username: user?.discordUsername ?? null,
      lastSync: user?.lastDiscordSync ?? null,
    },
  };
}

export const ixnayidCoreRouter = createTRPCRouter({
  /** All linked accounts at once. */
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
        discordUserId: true,
        discordUsername: true,
        lastDiscordSync: true,
        country: { select: { id: true, name: true, slug: true } },
      },
    });

    const country = user ? await resolveUserCountry(user) : null;

    // Wiki is "linked" only through a VERIFIED ixwiki link (token proven on the wiki user page, or
    // admin-verified). Owning a country or holding an unproven legacy `User.wikiUsername` does not count.
    const verifiedWikiLink = user
      ? await db.wikiAccountLink.findFirst({
          where: { userId: user.id, source: "ixwiki", verifiedAt: { not: null } },
          select: { username: true, verifiedAt: true },
        })
      : null;
    const verifiedWikiName = verifiedWikiLink?.username ?? null;
    const sessionUsername = (ctx.user as { username?: string | null }).username;
    // First available identity wins; the generic "admin" session name is skipped.
    const passportHandle =
      [
        verifiedWikiName,
        user?.forumUsername,
        country?.slug,
        country?.name,
        sessionUsername !== "admin" ? sessionUsername : null,
        user?.clerkUserId,
        user?.id,
      ].find(Boolean) || null;

    return {
      passportHandle,
      countrySlug:
        country?.slug ?? (country?.name ? country.name.toLowerCase().replace(/ /g, "_") : null),
      ...linkedAccounts(user, verifiedWikiLink),
    };
  }),

  // A lookup previews an account before linking it.
  lookupForumUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { lookupForumUser } = await import("~/server/modules/forum");
      return lookupForumUser(input.username);
    }),
});
