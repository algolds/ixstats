// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  type XFForumsResponse,
  type XFThreadsResponse,
  type XFThreadResponse,
  type XFPostsResponse,
  type XFPost,
  type XFUser,
  type XFThread,
  type XFForum,
  transformBBCode,
  cachedFetch,
  cacheKey,
  xfFetch,
} from "~/server/modules/forum";
import { normalizeNode, normalizePost, normalizeThread } from "./normalize";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const forumReadingRouter = createTRPCRouter({
  // =========================================================================
  // READ ENDPOINTS
  // =========================================================================

  /**
   * Get recent threads across ALL forums (for Trending / New Posts views).
   */
  getRecentThreads: publicProcedure
    .input(
      z.object({
        order: z
          .enum(["last_post_date", "post_date", "reply_count", "view_count"])
          .default("last_post_date"),
        limit: z.number().min(1).max(50).default(25),
        page: z.number().min(1).default(1),
      })
    )
    .query(async ({ input }) => {
      const key = cacheKey("threadList", "all", input.order, input.page);

      const data = await cachedFetch(key, "threadList", () =>
        xfFetch<XFThreadsResponse>(
          `/threads/?order=${input.order}&direction=desc&page=${input.page}&limit=${input.limit}`
        )
      );

      return {
        threads: (data?.threads ?? []).map(normalizeThread),
        pagination: data?.pagination ?? null,
      };
    }),

  /**
   * Get all forums (categories and sub-forums).
   */
  getForums: publicProcedure.query(async () => {
    const data = await cachedFetch(cacheKey("forums"), "forums", () =>
      xfFetch<XFForumsResponse>("/nodes/")
    );

    if (!data?.nodes) return { forums: [] };

    return {
      forums: data.nodes
        .filter((n: XFForum) => n.node_type_id === "Forum" || n.node_type_id === "Category")
        .sort((a: XFForum, b: XFForum) => a.display_order - b.display_order)
        .map(normalizeNode),
    };
  }),

  /**
   * Get a single forum with its thread list (paginated).
   */
  getForum: publicProcedure
    .input(
      z.object({
        forumId: z.number(),
        page: z.number().min(1).default(1),
        order: z
          .enum(["last_post_date", "post_date", "reply_count", "view_count"])
          .default("last_post_date"),
      })
    )
    .query(async ({ input }) => {
      const key = cacheKey("threadList", input.forumId, input.page, input.order);

      const data = await cachedFetch(key, "threadList", async () => {
        // Fetch forum info and threads in parallel
        // XenForo requires /forums/{id}/threads — NOT /threads/?node_id=
        const [forumData, threadsData] = await Promise.all([
          xfFetch<{ node: XFForum }>(`/nodes/${input.forumId}/`),
          xfFetch<XFThreadsResponse>(
            `/forums/${input.forumId}/threads?order=${input.order}&direction=desc&page=${input.page}`
          ),
        ]);

        return { forum: forumData?.node, threads: threadsData };
      });

      return {
        forum: data?.forum ? normalizeNode(data.forum) : null,
        threads: (data?.threads?.threads ?? []).map(normalizeThread),
        pagination: data?.threads?.pagination ?? null,
      };
    }),

  /**
   * Get a thread with its posts (paginated).
   * BBCode is transformed server-side.
   */
  getThread: publicProcedure
    .input(
      z.object({
        threadId: z.number(),
        page: z.number().min(1).default(1),
      })
    )
    .query(async ({ input }) => {
      const key = cacheKey("thread", input.threadId, input.page);

      const data = await cachedFetch(key, "thread", async () => {
        const [threadData, postsData] = await Promise.all([
          xfFetch<XFThreadResponse>(`/threads/${input.threadId}/`),
          // XenForo uses /threads/{id}/posts — NOT /posts/?thread_id=
          xfFetch<XFPostsResponse>(
            `/threads/${input.threadId}/posts?page=${input.page}&order=natural`
          ),
        ]);

        return { thread: threadData, posts: postsData };
      });

      const thread = data?.thread?.thread;

      return {
        thread: thread ? normalizeThread(thread) : null,
        posts: (data?.posts?.posts ?? []).map(normalizePost),
        pagination: data?.posts?.pagination ?? null,
      };
    }),

  /**
   * Get a member's profile.
   */
  getMember: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    const key = cacheKey("member", input.userId);
    const data = await cachedFetch(key, "member", () =>
      xfFetch<{ user: XFUser }>(`/users/${input.userId}/`)
    );

    if (!data?.user) return null;

    const u = data.user;
    return {
      userId: u.user_id,
      username: u.username,
      userTitle: u.user_title,
      messageCount: u.message_count,
      reactionScore: u.reaction_score,
      trophyPoints: u.trophy_points,
      registerDate: u.register_date,
      lastActivity: u.last_activity,
      isStaff: u.is_staff,
      avatarUrl: u.avatar_urls?.l ?? u.avatar_urls?.m ?? null,
      location: u.location ?? null,
      about: u.about ? transformBBCode(u.about).contentHtml : null,
      customFields: u.custom_fields ?? null,
    };
  }),

  /**
   * Search forum threads and posts.
   */
  searchForum: publicProcedure
    .input(
      z.object({
        query: z.string().min(2).max(200),
        type: z.enum(["thread", "post"]).optional(),
        page: z.number().min(1).default(1),
      })
    )
    .query(async ({ input }) => {
      const key = cacheKey("search", input.query, input.type ?? "all", input.page);

      const results = await cachedFetch(key, "search", async () => {
        const params = new URLSearchParams({
          keywords: input.query,
          order: "relevance",
          page: String(input.page),
        });
        if (input.type) params.set("search_type", input.type);

        return xfFetch<{
          results: Array<{
            content_type: string;
            content_id: number;
            content: XFThread | XFPost;
          }>;
          pagination?: { current_page: number; last_page: number; total: number };
        }>(`/search/?${params.toString()}`);
      });

      return {
        results: (results?.results ?? []).map((r) => ({
          type: r.content_type as "thread" | "post",
          id: r.content_id,
          thread:
            r.content_type === "thread" ? normalizeThread(r.content as unknown as XFThread) : null,
          post: r.content_type === "post" ? normalizePost(r.content as unknown as XFPost) : null,
        })),
        pagination: results?.pagination ?? null,
      };
    }),

  // NOTE: Forum alerts route through the global notification system (DynamicIsland).
  // Private messages are centralized in ThinkShare (/messages).
  // XenForo conversations and alerts are not exposed as separate endpoints.
});
