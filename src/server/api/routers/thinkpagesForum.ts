/**
 * ThinkPages Forum (docs/superpowers/specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md, phase 1).
 * Thin: validates, maps the signed-in user to the module's viewer, calls ~/server/modules/thinkpages-forum, maps
 * ForumError 1:1 to TRPCError. Author display data goes through authorsOf, so no raw user row leaves here.
 * Named `thinkpagesForum` because `api.forum` is the XenForo bridge until phase 4.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  authorsOf,
  canPostIn,
  canStartThread,
  createThread,
  editPost,
  ForumError,
  getCategoryThreads,
  getThreadPosts,
  listSiteCategories,
  MAX_POST_HTML,
  replyToThread,
  resolvePostLocation,
  TITLE_MAX,
  TITLE_MIN,
  type AuthorsDb,
  type ForumActor,
  type ForumViewer,
} from "~/server/modules/thinkpages-forum";
import { MAX_PAGE } from "~/lib/thinkpages-forum/paging";

function mapError(error: Error): never {
  if (error instanceof ForumError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

interface ViewerSource {
  id: string;
  clerkUserId: string;
  countryId?: string | null;
  role?: { name: string; level: number } | null;
}

function viewerOf(user: ViewerSource | null | undefined): ForumViewer {
  if (!user) return null;
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    countryId: user.countryId ?? null,
    role: user.role ? { name: user.role.name, level: user.role.level } : null,
  };
}

function actorOf(user: ViewerSource): ForumActor {
  return viewerOf(user) as ForumActor;
}

/** Author display data as plain objects (Maps do not serialize), keyed by user id and persona id. */
async function authorMaps(
  db: AuthorsDb,
  rows: ReadonlyArray<{ authorUserId: string; authorPersonaId: string | null }>
) {
  const { users, personas } = await authorsOf(
    db,
    rows.map((r) => r.authorUserId),
    rows.map((r) => r.authorPersonaId)
  );
  return { users: Object.fromEntries(users), personas: Object.fromEntries(personas) };
}

const id = z.string().min(1).max(64);
const page = z.number().int().min(1).max(MAX_PAGE).default(1);
const categoryKey = z.string().regex(/^[a-z0-9-]{2,40}$/);
const html = z.string().max(MAX_POST_HTML);
const personaId = id.nullish();

export const thinkpagesForumRouter = createTRPCRouter({
  categories: publicProcedure.query(({ ctx }) => listSiteCategories(ctx.db, viewerOf(ctx.user))),

  category: publicProcedure
    .input(z.object({ key: categoryKey, page }))
    .query(async ({ ctx, input }) => {
      const viewer = viewerOf(ctx.user);
      const result = await getCategoryThreads(ctx.db, viewer, input.key, input.page).catch(
        mapError
      );
      return {
        ...result,
        canStart: canStartThread(viewer, result.category),
        authors: await authorMaps(ctx.db, result.threads),
      };
    }),

  thread: publicProcedure.input(z.object({ threadId: id, page })).query(async ({ ctx, input }) => {
    const viewer = viewerOf(ctx.user);
    const result = await getThreadPosts(ctx.db, viewer, input.threadId, input.page).catch(mapError);
    const open = !result.thread.locked && !result.thread.archived;
    return {
      ...result,
      posts: result.posts.map((post) => ({
        ...post,
        isOwn: viewer !== null && post.authorUserId === viewer.id,
      })),
      canReply: viewer !== null && open && canPostIn(viewer, result.category),
      authors: await authorMaps(ctx.db, [result.thread, ...result.posts]),
    };
  }),

  resolvePost: publicProcedure
    .input(z.object({ postId: id }))
    .query(({ ctx, input }) => resolvePostLocation(ctx.db, viewerOf(ctx.user), input.postId)),

  myPersonas: protectedProcedure.query(({ ctx }) =>
    ctx.db.thinkpagesAccount.findMany({
      where: { clerkUserId: ctx.user.clerkUserId, isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    })
  ),

  createThread: rateLimitedMutationProcedure
    .input(
      z.object({
        categoryKey,
        title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
        html,
        personaId,
      })
    )
    .mutation(({ ctx, input }) => createThread(ctx.db, actorOf(ctx.user), input).catch(mapError)),

  reply: rateLimitedMutationProcedure
    .input(z.object({ threadId: id, html, personaId }))
    .mutation(({ ctx, input }) => replyToThread(ctx.db, actorOf(ctx.user), input).catch(mapError)),

  editPost: rateLimitedMutationProcedure
    .input(z.object({ postId: id, html }))
    .mutation(({ ctx, input }) => editPost(ctx.db, actorOf(ctx.user), input).catch(mapError)),
});
