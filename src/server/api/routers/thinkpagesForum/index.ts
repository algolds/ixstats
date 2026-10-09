/**
 * ThinkPages Forum (docs/superpowers/specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md, phases 1-4).
 * Thin: validates, maps the signed-in user to the module's viewer (with what they moderate), calls
 * ~/server/modules/thinkpages-forum, maps ForumError 1:1 to TRPCError. Author display data goes through authorsOf,
 * so no raw user row leaves here. Named `thinkpagesForum` because `api.forum` is the XenForo bridge until phase 4.
 * Moderator actions live in `thinkpagesForumMod` (./mod.ts).
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  authorModeration,
  canStartThread,
  categoryPostingAccess,
  createThread,
  editPost,
  fileAppeal,
  fileReport,
  getCategoryThreads,
  getRealmSection,
  getThreadPosts,
  listForumRealms,
  listSiteCategories,
  MAX_POST_HTML,
  moveDestinations,
  myStanding,
  primaryRealmIdOf,
  replyToThread,
  resolvePostLocation,
  TITLE_MAX,
  TITLE_MIN,
  type AuthorModerationDb,
  type ContentDb,
  type ForumViewer,
} from "~/server/modules/thinkpages-forum";
import { actorOf, authorMaps, categoryKey, id, mapError, page, realm, viewerOf } from "./viewer";

const html = z.string().max(MAX_POST_HTML);
const personaId = id.nullish();

type ThreadPage = Awaited<ReturnType<typeof getThreadPosts>>;

/**
 * A moderator's extras on a thread: Move destinations, and what they may do to each author's posts (I-1, M-8), so
 * the UI offers only what the server allows.
 */
async function moderatorView(
  db: AuthorModerationDb & Pick<ContentDb, "forumCategory">,
  viewer: ForumViewer,
  result: ThreadPage
) {
  const [destinations, moderation] = await Promise.all([
    moveDestinations(db, viewer, result.category),
    authorModeration(db, viewer, [
      result.thread.authorUserId,
      ...result.posts.map((p) => p.authorUserId),
    ]),
  ]);
  return {
    tools: { categories: destinations.map((c) => ({ ...c, realm: result.category.realm })) },
    of: (authorUserId: string | null) => moderation(authorUserId, result.category),
  };
}

export const thinkpagesForumRouter = createTRPCRouter({
  categories: publicProcedure.query(async ({ ctx }) =>
    listSiteCategories(ctx.db, await viewerOf(ctx.db, ctx.user))
  ),

  /** The realm switcher: realms the viewer may pick, defaulting to their primary nation's realm. */
  realms: publicProcedure.query(async ({ ctx }) => {
    const viewer = await viewerOf(ctx.db, ctx.user);
    const activeRealmId = await primaryRealmIdOf(ctx.db, viewer);
    return listForumRealms(ctx.db, viewer && { ...viewer, activeRealmId });
  }),

  /** May write: a realm without categories gets them seeded on first read. */
  realmSection: publicProcedure.input(z.object({ realm })).query(async ({ ctx, input }) => {
    const viewer = await viewerOf(ctx.db, ctx.user);
    const section = await getRealmSection(ctx.db, viewer, input.realm).catch(mapError);
    // Only the verdict leaves: never the viewer's nation ids or the raw ban (T0-18: a flag for BanNotice).
    const { canPost, notice, ban } = section.access;
    return {
      realm: section.realm,
      categories: section.categories,
      canPost,
      notice,
      banned: ban !== null,
    };
  }),

  category: publicProcedure
    .input(z.object({ key: categoryKey, page, realm: realm.optional() }))
    .query(async ({ ctx, input }) => {
      const viewer = await viewerOf(ctx.db, ctx.user);
      const result = await getCategoryThreads(
        ctx.db,
        viewer,
        { key: input.key, realm: input.realm },
        input.page
      ).catch(mapError);
      const access = await categoryPostingAccess(ctx.db, viewer, result.category);
      return {
        ...result,
        // Moderators of the category get the Hidden badge; members never receive hidden threads (M-4).
        threads: result.threads.map(({ hidden, ...thread }) => ({
          ...thread,
          ...(result.canModerate ? { hidden } : {}),
        })),
        canStart: canStartThread(viewer, result.category) && access.canPost,
        notice: access.notice,
        banned: access.ban !== null,
        authors: await authorMaps(ctx.db, result.threads),
      };
    }),

  thread: publicProcedure.input(z.object({ threadId: id, page })).query(async ({ ctx, input }) => {
    const viewer = await viewerOf(ctx.db, ctx.user);
    const result = await getThreadPosts(ctx.db, viewer, input.threadId, input.page).catch(mapError);
    // The single posting-access entry (T0-2): reply, Edit, the notice and the ban flag all come from it.
    const access = await categoryPostingAccess(ctx.db, viewer, result.category);
    // Hidden content stays readable to moderators but refuses writes (writes.ts), so it offers neither reply nor Edit.
    const writable =
      viewer !== null && !result.thread.locked && !result.thread.archived && !result.thread.hidden;
    const canReply = writable && access.canPost;
    // Sitewide the author edits unless banned (T0-17); in a realm section only while they may post there (D13).
    const editable =
      writable && (result.category.scope !== "realm" ? access.ban === null : canReply);
    const moderator = result.canModerate ? await moderatorView(ctx.db, viewer, result) : null;
    return {
      ...result,
      // Moderators of the category get the Hidden badge and what they may do to each post; members never receive
      // hidden posts (T0-19). `byViewer` is authorship (no Report on your own post); `isOwn` is "may edit it now".
      // An imported post without an IxStats author (null, phase 4) is never the viewer's.
      posts: result.posts.map(({ hidden, ...post }) => {
        const byViewer = viewer !== null && post.authorUserId === viewer.id;
        return {
          ...post,
          ...(moderator ? { hidden, ...moderator.of(post.authorUserId) } : {}),
          byViewer,
          isOwn: byViewer && editable && !hidden,
        };
      }),
      viewerIsAuthor: viewer !== null && result.thread.authorUserId === viewer.id,
      canReply,
      notice: access.notice,
      banned: access.ban !== null,
      // The thread bar's actions (lock, pin, hide, archive, move): a site admin's thread is site admins' only.
      ...(moderator
        ? {
            moderatorTools: moderator.tools,
            moderable: moderator.of(result.thread.authorUserId).moderable,
          }
        : {}),
      authors: await authorMaps(ctx.db, [result.thread, ...result.posts]),
    };
  }),

  resolvePost: publicProcedure
    .input(z.object({ postId: id }))
    .query(async ({ ctx, input }) =>
      resolvePostLocation(ctx.db, await viewerOf(ctx.db, ctx.user), input.postId)
    ),

  myPersonas: protectedProcedure.query(({ ctx }) =>
    ctx.db.thinkpagesAccount.findMany({
      where: { clerkUserId: ctx.user.clerkUserId, isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    })
  ),

  /** The member's own warnings, bans and appeals (M20); never who issued or reviewed them. */
  myStanding: protectedProcedure.query(async ({ ctx }) =>
    myStanding(ctx.db, await actorOf(ctx.db, ctx.user))
  ),

  createThread: rateLimitedMutationProcedure
    .input(
      z.object({
        categoryKey,
        realm: realm.optional(),
        title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
        html,
        personaId,
      })
    )
    .mutation(async ({ ctx, input }) =>
      createThread(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  reply: rateLimitedMutationProcedure
    .input(z.object({ threadId: id, html, personaId }))
    .mutation(async ({ ctx, input }) =>
      replyToThread(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  editPost: rateLimitedMutationProcedure
    .input(z.object({ postId: id, html }))
    .mutation(async ({ ctx, input }) =>
      editPost(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** M11: returns only the report's id; the reporter is never shown to the reported member. */
  report: rateLimitedMutationProcedure
    .input(
      z.object({
        targetType: z.enum(["thread", "post"]),
        targetId: id,
        reason: z.string().trim().min(3).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) =>
      fileReport(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** M12: one appeal per active warning or ban of the member's own. */
  appeal: rateLimitedMutationProcedure
    .input(
      z.object({
        subjectType: z.enum(["warning", "ban"]),
        subjectId: id,
        body: z.string().trim().min(10).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) =>
      fileAppeal(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),
});
