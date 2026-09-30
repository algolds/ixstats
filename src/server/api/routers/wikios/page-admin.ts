/**
 * page-admin.ts — WikiOS page management and rights tRPC router.
 *
 * Move, delete, undelete and protect pages; block users; change user groups; read the public log,
 * a page's protection and a user's permissions. Every mutation is authorized through
 * `permissions.ts` first; the work itself lives in `PageManagementService` and `RightsAdminService`.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, publicProcedure } from "~/server/api/trpc";
import {
  getWikiActorLabel,
  getWikiAuth,
  requireWikiUserId,
  type WikiAuthContext,
} from "~/lib/wiki-os/auth";
import {
  authorizeAction,
  requireCanonicalTitle,
  requireGroupChange,
  requireRight,
  rightForLevel,
  RESTRICTION_LEVELS,
} from "~/lib/wiki-os/permissions";
import {
  changeableGroups,
  EXPLICIT_GROUPS,
  getWikiPermissions,
  loadTargetPermissions,
  type WikiPermissions,
} from "~/lib/wiki-os/rights";
import {
  PageManagementService,
  PageOperationError,
  talkTitleOf,
  type PageActor,
} from "~/lib/wiki-os/core/page-management-service";
import { LOG_TYPES, RightsAdminService } from "~/lib/wiki-os/core/rights-admin-service";

const titleInput = z.string().min(1).max(500);
const reasonInput = z.string().max(500).default("");
/** Expiry of a block, protection or membership: a moment in the future, or null for never. */
const expiryInput = z
  .date()
  .refine((date) => date > new Date(), "The expiry must be in the future.")
  .nullable()
  .default(null);
const targetInput = z.union([
  z.strictObject({ userId: z.string().min(1).max(64) }),
  z.strictObject({ wikiUsername: z.string().min(1).max(255) }),
]);
const groupsInput = z.array(z.enum(EXPLICIT_GROUPS)).max(EXPLICIT_GROUPS.length).default([]);
const restrictionInput = z.object({
  action: z.enum(["edit", "move", "create", "upload"]),
  /** null removes the restriction. */
  level: z.enum(RESTRICTION_LEVELS).nullable(),
  expiresAt: expiryInput,
});

const actorOf = (ctx: WikiAuthContext): PageActor => ({
  userId: requireWikiUserId(ctx),
  name: getWikiActorLabel(ctx),
});

/** Turn a service refusal (no such page, destination exists) into the matching TRPCError. */
async function refusals<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof PageOperationError) {
      throw new TRPCError({ code: error.code, message: error.message });
    }
    throw error;
  }
}

/** What a client may learn of a permissions snapshot: names, groups and rights, never ids. */
function publicPermissions(permissions: WikiPermissions) {
  return {
    groups: permissions.groups,
    rights: [...permissions.rights],
    block: permissions.block,
  };
}

/** The caller may move `from` to `to` (and, with `moveTalk`, their talk pages). */
async function authorizeMove(
  ctx: WikiAuthContext,
  from: string,
  to: string,
  moveTalk: boolean
): Promise<void> {
  await authorizeAction(ctx, "move", from);
  await authorizeAction(ctx, "move", to);
  await authorizeAction(ctx, "create", to);
  const fromTalk = moveTalk ? talkTitleOf(from) : null;
  const toTalk = moveTalk ? talkTitleOf(to) : null;
  if (fromTalk && toTalk) {
    await authorizeAction(ctx, "move", fromTalk);
    await authorizeAction(ctx, "create", toTalk);
  }
}

export const wikiosPageAdminRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // Pages: move, delete, undelete, protect
  // ---------------------------------------------------------------------------

  /** Move a page, leaving a redirect and bringing its talk page along. */
  movePage: lightMutationProcedure
    .input(
      z.object({
        from: titleInput,
        to: titleInput,
        reason: reasonInput,
        leaveRedirect: z.boolean().default(true),
        moveTalk: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const from = requireCanonicalTitle(input.from);
      const to = requireCanonicalTitle(input.to);
      await authorizeMove(ctx, from, to, input.moveTalk);
      const moved = await refusals(
        PageManagementService.movePage(from, to, input.reason, actorOf(ctx), "ixwiki", {
          leaveRedirect: input.leaveRedirect,
          moveTalk: input.moveTalk,
        })
      );
      return {
        success: true,
        from,
        to,
        redirectCreated: moved.redirectArticleId !== null,
        talkMoved: moved.talk !== null,
      };
    }),

  /** Delete (archive) a page: its history stays, readers get "not found". */
  deletePage: lightMutationProcedure
    .input(z.object({ title: titleInput, reason: reasonInput }))
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await authorizeAction(ctx, "delete", title);
      await refusals(PageManagementService.archiveArticle(title, input.reason, actorOf(ctx)));
      return { success: true, title };
    }),

  /** Undelete a page: publish it again. */
  undeletePage: lightMutationProcedure
    .input(z.object({ title: titleInput, reason: reasonInput }))
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await authorizeAction(ctx, "undelete", title);
      await refusals(
        PageManagementService.restoreArticle(
          title,
          actorOf(ctx),
          "ixwiki",
          input.reason || undefined
        )
      );
      return { success: true, title };
    }),

  /** Set or remove a page's protections; a level is open only to someone who can edit at that level. */
  protectPage: lightMutationProcedure
    .input(
      z.object({
        title: titleInput,
        restrictions: z.array(restrictionInput).min(1).max(4),
        cascade: z.boolean().default(false),
        reason: reasonInput,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const title = requireCanonicalTitle(input.title);
      await authorizeAction(ctx, "protect", title);
      for (const { level } of input.restrictions) {
        if (level) await requireRight(ctx, rightForLevel(level));
      }
      await RightsAdminService.protect({
        title,
        changes: input.restrictions,
        cascade: input.cascade,
        reason: input.reason,
        actor: actorOf(ctx),
      });
      return { success: true, title };
    }),

  // ---------------------------------------------------------------------------
  // Users: block, unblock, groups
  // ---------------------------------------------------------------------------

  blockUser: lightMutationProcedure
    .input(
      z.object({
        target: targetInput,
        expiresAt: expiryInput,
        reason: reasonInput,
        allowUserTalk: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRight(ctx, "block");
      const target = await refusals(RightsAdminService.block({ ...input, actor: actorOf(ctx) }));
      return { success: true, target };
    }),

  unblockUser: lightMutationProcedure
    .input(z.object({ target: targetInput, reason: reasonInput }))
    .mutation(async ({ input, ctx }) => {
      await requireRight(ctx, "block");
      const target = await refusals(RightsAdminService.unblock({ ...input, actor: actorOf(ctx) }));
      return { success: true, target };
    }),

  /** Add and remove user groups; only the groups the caller's own groups let them change. */
  setUserGroups: lightMutationProcedure
    .input(
      z.object({
        target: targetInput,
        add: groupsInput,
        remove: groupsInput,
        reason: reasonInput,
        expiresAt: expiryInput,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireGroupChange(ctx, [...input.add, ...input.remove]);
      const target = await refusals(
        RightsAdminService.setGroups({ ...input, actor: actorOf(ctx) })
      );
      return { success: true, target };
    }),

  // ---------------------------------------------------------------------------
  // Reads (public: nothing here returns a user id)
  // ---------------------------------------------------------------------------

  /** The protections in force on a page. */
  getPageRestrictions: publicProcedure
    .input(z.object({ title: titleInput }))
    .query(async ({ input }) => {
      const title = requireCanonicalTitle(input.title);
      return { title, restrictions: await RightsAdminService.getRestrictions(title) };
    }),

  /**
   * Groups, rights and block of the caller, or, with `user`, of that wiki username (with the explicit
   * memberships a bureaucrat could remove).
   */
  getUserPermissions: publicProcedure
    .input(z.object({ user: z.string().min(1).max(255).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const caller = await getWikiPermissions(ctx);
      if (!input?.user) {
        const { internalUserId } = getWikiAuth(ctx);
        const explicit = await RightsAdminService.explicitGroups({
          userId: internalUserId,
          wikiUsername: caller.verifiedWikiUsername,
        });
        return {
          username: caller.verifiedWikiUsername,
          ...publicPermissions(caller),
          explicitGroups: explicit,
          changeableGroups: changeableGroups(caller.rights),
        };
      }
      const target = await RightsAdminService.resolveTarget({ wikiUsername: input.user });
      const [permissions, explicit] = await Promise.all([
        loadTargetPermissions({ userId: target.userId, wikiUsername: target.displayName }),
        RightsAdminService.explicitGroups(target),
      ]);
      return {
        username: target.displayName,
        ...publicPermissions(permissions),
        explicitGroups: explicit,
        changeableGroups: changeableGroups(caller.rights),
      };
    }),

  listBlocks: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().max(64).optional(),
      })
    )
    .query(({ input }) => RightsAdminService.listBlocks(input.limit, input.cursor)),

  /** Special:Log: moves, deletions, protections, rights changes and blocks. */
  getLog: publicProcedure
    .input(
      z.object({
        type: z.enum(LOG_TYPES).optional(),
        title: titleInput.optional(),
        user: z.string().min(1).max(255).optional(),
        limit: z.number().int().min(1).max(500).default(50),
        cursor: z.string().max(64).optional(),
      })
    )
    .query(({ input }) =>
      RightsAdminService.getLog({
        ...input,
        title: input.title ? requireCanonicalTitle(input.title) : undefined,
      })
    ),
});
