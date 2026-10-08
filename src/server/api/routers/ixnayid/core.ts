import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  lightMutationProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  HandleClaimError,
  setUserHandle,
} from "~/server/modules/identity/identity.handle-claim";
import { passportHandleOf } from "~/server/modules/identity/identity.passport-handle";
import { syncOwnForumAccount } from "~/server/modules/identity/identity.service";
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms/realms.access";
import { forumGateway } from "./forum-gateway";

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

/** Admin rights (as `adminProcedure` grants them), dropped while playing as another user. */
function callerIsAdmin(ctx: { user: RealmActor; impersonatorId?: string | null }): boolean {
  return !ctx.impersonatorId && isSiteAdmin(ctx.user);
}

const HANDLE_ERROR_CODES = {
  FORMAT: "BAD_REQUEST",
  RESERVED: "BAD_REQUEST",
  TAKEN: "CONFLICT",
  ALREADY_CHANGED: "FORBIDDEN",
  NO_USER: "NOT_FOUND",
} as const;

export const ixnayidCoreRouter = createTRPCRouter({
  /** All linked accounts at once; also refreshes the caller's own linked forum name. */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        handleChangedAt: true,
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

    // The owner's own call keeps their linked forum name current (fire-and-forget, never throws).
    if (user) void syncOwnForumAccount(user, forumGateway);
    const country = user ? await resolveUserCountry(user) : null;

    // Wiki is "linked" only through a VERIFIED ixwiki link (token proven on the wiki user page, or
    // admin-verified). Owning a country or holding an unproven legacy `User.wikiUsername` does not count.
    const verifiedWikiLink = user
      ? await db.wikiAccountLink.findFirst({
          where: { userId: user.id, source: "ixwiki", verifiedAt: { not: null } },
          select: { username: true, verifiedAt: true },
        })
      : null;

    return {
      /** The passport handle (`passportHandleOf`): the one every share and invite link carries. */
      passportHandle: user ? await passportHandleOf(user, verifiedWikiLink?.username ?? null) : null,
      /** The stored IxStates Passport handle, null until one is claimed. */
      handle: user?.handle ?? null,
      /** The single self-service change is still available (admins may always change it). */
      canChangeHandle: !user?.handleChangedAt || callerIsAdmin(ctx),
      countrySlug:
        country?.slug ?? (country?.name ? country.name.toLowerCase().replace(/ /g, "_") : null),
      ...linkedAccounts(user, verifiedWikiLink),
    };
  }),

  /** Claim or change the signed-in user's IxStates Passport handle. */
  setHandle: lightMutationProcedure
    .input(z.object({ handle: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await setUserHandle({
          userId: ctx.user.id,
          handle: input.handle,
          isAdmin: callerIsAdmin(ctx),
        });
      } catch (error) {
        if (!(error instanceof HandleClaimError)) throw error;
        throw new TRPCError({ code: HANDLE_ERROR_CODES[error.code], message: error.message });
      }
    }),

  // A lookup previews an account before linking it.
  lookupForumUser: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { lookupForumUser } = await import("~/server/modules/forum");
      return lookupForumUser(input.username);
    }),
});
