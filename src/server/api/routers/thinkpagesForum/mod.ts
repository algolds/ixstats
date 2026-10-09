/**
 * ThinkPages Forum moderation (phase 3): the console's reads (context, queue, warnings, bans, appeals, log,
 * category moderators) and every moderator action. Thin, as `thinkpagesForum`: validates, maps the signed-in user to
 * the module's viewer with what they moderate, calls ~/server/modules/thinkpages-forum and maps ForumError. Scope is
 * the module's to enforce (realm and category moderators are not admins), so reads are protected and mutations
 * rate-limited, never adminProcedure. Member notices (M13) go out after the change commits and never fail the call.
 * Lists name the members they show through authorsOf only; who reported something reaches no moderator whose own
 * content it is (the module withholds it).
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
  readOnlyProcedure,
} from "~/server/api/trpc";
import {
  banPlaceName,
  issueBan,
  issueWarning,
  liftBan,
  listAppeals,
  listBans,
  listCategoryModerators,
  listingRealmId,
  listModLog,
  listReports,
  listWarnings,
  locateBanScope,
  MAX_POST_HTML,
  moderationContext,
  modEditPost,
  moveThread,
  notifyAppealDecision,
  notifyAutoBanShortened,
  notifyBan,
  notifyBanLifted,
  notifyWarning,
  resolveMember,
  resolveReport,
  reviewAppeal,
  revokeWarning,
  setCategoryModerator,
  setPostHidden,
  setThreadFlag,
  type AutoBanChange,
  type NoticesDb,
  type ScopeDb,
} from "~/server/modules/thinkpages-forum";
import {
  actorOf,
  categoryKey,
  id,
  mapError,
  memberMaps,
  page,
  realm,
  type ViewerSource,
} from "./viewer";

const reason = z.string().trim().min(1).max(1000);
const note = reason.optional();
const html = z.string().max(MAX_POST_HTML);

const banScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("site") }),
  z.object({ kind: z.literal("realm"), realm }),
  z.object({ kind: z.literal("category"), key: categoryKey, realm: realm.optional() }),
]);

/** Runs a module call, mapping ForumError 1:1 to TRPCError. */
const run = <T>(work: () => Promise<T>): Promise<T> => work().catch(mapError);

/** Member notices, after the change has committed; a failed notice never fails the call (M13). */
async function notify(...notices: Array<Promise<void>>): Promise<void> {
  await Promise.allSettled(notices);
}

/**
 * What a warning, revoke, lift (M2's re-tier) or appeal decision did to the member's automatic site ban, as a
 * notice; a shortened ban is told as such, not as a new ban (M5).
 */
function autoBanNotices(
  db: NoticesDb,
  userId: string,
  change: AutoBanChange | null
): Array<Promise<void>> {
  if (change === null) return [];
  if (change.kind === "lifted") return [notifyBanLifted(db, { userId, ban: { scope: "site" } })];
  if (change.kind === "shortened") {
    return [notifyAutoBanShortened(db, { userId, expiresAt: change.expiresAt })];
  }
  const ban = { scope: "site" as const, expiresAt: change.expiresAt, reason: change.reason };
  return [notifyBan(db, { userId, ban })];
}

/** The moderator and their listing's realm filter (a slug resolved to its id). */
async function listing(db: ScopeDb, user: ViewerSource, slug: string | undefined) {
  const viewer = await actorOf(db, user);
  return { viewer, realmId: await listingRealmId(db, viewer, slug) };
}

const listFilter = { realm: realm.optional(), page };

export const thinkpagesForumModRouter = createTRPCRouter({
  /** What the viewer moderates; empty lists for everyone else, never an error. */
  context: protectedProcedure.query(async ({ ctx }) =>
    moderationContext(ctx.db, await actorOf(ctx.db, ctx.user))
  ),

  reports: protectedProcedure
    .input(
      z.object({ status: z.enum(["open", "resolved", "dismissed"]).default("open"), ...listFilter })
    )
    .query(({ ctx, input }) =>
      run(async () => {
        const { viewer, realmId } = await listing(ctx.db, ctx.user, input.realm);
        const result = await listReports(
          ctx.db,
          viewer,
          { status: input.status, realmId },
          input.page
        );
        const ids = result.rows.flatMap((r) => [r.reporterId, r.handledBy, r.targetAuthorId]);
        return { ...result, authors: await memberMaps(ctx.db, ids) };
      })
    ),

  resolveReport: rateLimitedMutationProcedure
    .input(z.object({ reportId: id, outcome: z.enum(["resolved", "dismissed"]), note }))
    .mutation(({ ctx, input }) =>
      run(async () => resolveReport(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  setThreadFlag: rateLimitedMutationProcedure
    .input(
      z.object({
        threadId: id,
        flag: z.enum(["locked", "pinned", "hidden", "archived"]),
        value: z.boolean(),
        note,
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => setThreadFlag(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  moveThread: rateLimitedMutationProcedure
    .input(
      z.object({
        threadId: id,
        to: z.object({ key: categoryKey, realm: realm.optional() }),
        note,
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => moveThread(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  setPostHidden: rateLimitedMutationProcedure
    .input(z.object({ postId: id, hidden: z.boolean(), note }))
    .mutation(({ ctx, input }) =>
      run(async () => setPostHidden(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  /** The note is required: the log keeps it with the previous text. */
  editPost: rateLimitedMutationProcedure
    .input(z.object({ postId: id, html, note: reason }))
    .mutation(({ ctx, input }) =>
      run(async () => modEditPost(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  /** Points 1 to 5 here; the module applies the issuer's cap (M1). */
  warn: rateLimitedMutationProcedure
    .input(
      z.object({
        userId: id,
        points: z.number().int().min(1).max(5),
        reason,
        target: z.object({ type: z.enum(["thread", "post"]), id }).nullish(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        const outcome = await issueWarning(ctx.db, await actorOf(ctx.db, ctx.user), input);
        await notify(
          notifyWarning(ctx.db, {
            userId: input.userId,
            points: input.points,
            reason: input.reason,
            activePoints: outcome.activePoints,
          }),
          ...autoBanNotices(ctx.db, input.userId, outcome.autoBan)
        );
        return outcome;
      })
    ),

  revokeWarning: rateLimitedMutationProcedure
    .input(z.object({ warningId: id, note }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        const { userId, autoBan } = await revokeWarning(
          ctx.db,
          await actorOf(ctx.db, ctx.user),
          input
        );
        await notify(...autoBanNotices(ctx.db, userId, autoBan));
      })
    ),

  warnings: protectedProcedure
    .input(z.object({ userId: id.optional(), activeOnly: z.boolean().optional(), ...listFilter }))
    .query(({ ctx, input }) =>
      run(async () => {
        const { viewer, realmId } = await listing(ctx.db, ctx.user, input.realm);
        const filter = { userId: input.userId, realmId, activeOnly: input.activeOnly };
        const result = await listWarnings(ctx.db, viewer, filter, input.page);
        const ids = result.rows.flatMap((r) => [r.userId, r.issuedBy, r.revokedBy]);
        return { ...result, authors: await memberMaps(ctx.db, ids) };
      })
    ),

  /** Site bans are site admins' (the module refuses anyone else); `days: null` is permanent. */
  ban: rateLimitedMutationProcedure
    .input(
      z.object({
        userId: id,
        scope: banScope,
        reason,
        days: z.number().int().min(1).max(3650).nullable(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        const actor = await actorOf(ctx.db, ctx.user);
        const place = await locateBanScope(ctx.db, actor, input.scope);
        const banned = await issueBan(ctx.db, actor, {
          userId: input.userId,
          scope: place.scope,
          reason: input.reason,
          days: input.days,
        });
        const ban = {
          scope: input.scope.kind,
          scopeName: place.name,
          expiresAt: banned.expiresAt,
          reason: input.reason,
        };
        await notify(notifyBan(ctx.db, { userId: input.userId, ban }));
        return banned;
      })
    ),

  liftBan: rateLimitedMutationProcedure
    .input(z.object({ banId: id, note }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        const lifted = await liftBan(ctx.db, await actorOf(ctx.db, ctx.user), input);
        // Committed: a failed name lookup only makes the notice name the place generically (M13).
        const scopeName = await banPlaceName(ctx.db, lifted).catch(() => null);
        const ban = { scope: lifted.scope, scopeName };
        await notify(
          notifyBanLifted(ctx.db, { userId: lifted.userId, ban }),
          ...autoBanNotices(ctx.db, lifted.userId, lifted.autoBan)
        );
      })
    ),

  bans: protectedProcedure
    .input(z.object({ active: z.boolean().default(true), userId: id.optional(), ...listFilter }))
    .query(({ ctx, input }) =>
      run(async () => {
        const { viewer, realmId } = await listing(ctx.db, ctx.user, input.realm);
        const filter = { active: input.active, realmId, userId: input.userId };
        const result = await listBans(ctx.db, viewer, filter, input.page);
        const ids = result.rows.flatMap((r) => [r.userId, r.issuedBy, r.liftedBy]);
        return { ...result, authors: await memberMaps(ctx.db, ids) };
      })
    ),

  appeals: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "upheld", "overturned", "moot"]).default("open"),
        ...listFilter,
      })
    )
    .query(({ ctx, input }) =>
      run(async () => {
        const { viewer, realmId } = await listing(ctx.db, ctx.user, input.realm);
        const result = await listAppeals(
          ctx.db,
          viewer,
          { status: input.status, realmId },
          input.page
        );
        const ids = result.rows.flatMap((r) => [r.userId, r.reviewedBy, r.subject?.issuedBy]);
        return { ...result, authors: await memberMaps(ctx.db, ids) };
      })
    ),

  /** Another moderator in scope decides; the member hears the decision, `moot` included. */
  reviewAppeal: rateLimitedMutationProcedure
    .input(
      z.object({
        appealId: id,
        outcome: z.enum(["upheld", "overturned"]),
        response: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        const review = await reviewAppeal(ctx.db, await actorOf(ctx.db, ctx.user), input);
        await notify(
          notifyAppealDecision(ctx.db, {
            userId: review.userId,
            subjectType: review.subjectType,
            outcome: review.outcome,
            response: input.response,
          }),
          ...autoBanNotices(ctx.db, review.userId, review.autoBan)
        );
      })
    ),

  log: protectedProcedure.input(z.object(listFilter)).query(({ ctx, input }) =>
    run(async () => {
      const { viewer, realmId } = await listing(ctx.db, ctx.user, input.realm);
      const result = await listModLog(ctx.db, viewer, { realmId }, input.page);
      const ids = result.rows.flatMap((r) => [
        r.actorId,
        r.targetType === "user" ? r.targetId : null,
      ]);
      return { ...result, authors: await memberMaps(ctx.db, ids) };
    })
  ),

  /** A member by Passport handle or wiki username; only an id and a public name come back. Rate limited (M10). */
  resolveMember: readOnlyProcedure
    .input(z.object({ handle: z.string().trim().min(1).max(100) }))
    .query(({ ctx, input }) =>
      run(async () => resolveMember(ctx.db, await actorOf(ctx.db, ctx.user), input))
    ),

  categoryModerators: protectedProcedure
    .input(z.object({ key: categoryKey, realm: realm.optional() }))
    .query(({ ctx, input }) =>
      run(async () => {
        const rows = await listCategoryModerators(ctx.db, await actorOf(ctx.db, ctx.user), input);
        return {
          rows,
          authors: await memberMaps(
            ctx.db,
            rows.map((r) => r.grantedBy)
          ),
        };
      })
    ),

  /** Site admins only (M19), enforced by the module. */
  setCategoryModerator: rateLimitedMutationProcedure
    .input(z.object({ key: categoryKey, realm: realm.optional(), userId: id, grant: z.boolean() }))
    .mutation(({ ctx, input }) =>
      run(async () =>
        setCategoryModerator(ctx.db, await actorOf(ctx.db, ctx.user), {
          locator: { key: input.key, realm: input.realm },
          userId: input.userId,
          grant: input.grant,
        })
      )
    ),
});
