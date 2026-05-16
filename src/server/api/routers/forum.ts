// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import {
  setupForumCustomFields,
  linkForumAccount,
  syncUserToForum,
  xfFetchAsUser,
  xfPostAsUser,
  xfDelete,
  type XFForumsResponse,
  type XFThreadsResponse,
  type XFThreadResponse,
  type XFPostsResponse,
  type XFPost,
  type XFUser,
  type XFThread,
  type XFForum,
  getXfApiKey,
  getXfApiUrl,
  transformBBCode,
  transformPosts,
  cachedFetch,
  cacheKey,
  invalidateThread,
  cacheInvalidate,
} from "~/modules/forum";
import { notificationAPI } from "~/lib/notification-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch from XenForo API (server-level, no user impersonation) */
async function xfFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getXfApiKey();
  if (!apiKey) {
    console.error("[Forum Router] XENFORO_API_KEY is missing. Forum features will be disabled.");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getXfApiUrl()}${endpoint}`, {
      headers: {
        "XF-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Forum Router] HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[Forum Router] Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

/** Resolve the user's linked XenForo user ID, or throw */
async function requireForumUser(userId: string): Promise<number> {
  const { db } = await import("~/server/db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { forumUserId: true, forumUsername: true },
  });

  if (user?.forumUserId) return user.forumUserId;

  // Fallback: if forumUsername is set but forumUserId is missing, look it up and backfill
  if (user?.forumUsername) {
    const { lookupForumUser } = await import("~/modules/forum");
    const xfUser = await lookupForumUser(user.forumUsername);
    if (xfUser) {
      await db.user.update({
        where: { id: userId },
        data: { forumUserId: xfUser.userId },
      });
      return xfUser.userId;
    }
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "You must link your forum account first. Go to Profile → IxnayID to connect your accounts.",
  });
}

// ---------------------------------------------------------------------------
// Normalized output types
// ---------------------------------------------------------------------------

interface ForumNode {
  nodeId: number;
  title: string;
  description: string;
  parentNodeId: number;
  displayOrder: number;
  threadCount: number;
  messageCount: number;
  lastPostDate: number | null;
  lastPostUsername: string | null;
  lastThreadTitle: string | null;
  lastThreadId: number | null;
  nodeType: string;
}

interface NormalizedThread {
  threadId: number;
  nodeId: number;
  title: string;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  postDate: number;
  replyCount: number;
  viewCount: number;
  lastPostDate: number;
  lastPostUsername: string;
  isSticky: boolean;
  isOpen: boolean;
  forumName: string | null;
}

interface NormalizedPost {
  postId: number;
  threadId: number;
  authorId: number;
  authorName: string;
  authorAvatar: string | null;
  authorTitle: string | null;
  authorMessageCount: number;
  authorReactionScore: number;
  authorJoinDate: number;
  postDate: number;
  contentHtml: string;
  isFirstPost: boolean;
  reactionScore: number;
  position: number;
  attachments: Array<{
    id: number;
    filename: string;
    fileSize: number;
    thumbnailUrl: string | null;
    directUrl: string | null;
    contentType: string;
    width: number | null;
    height: number | null;
  }>;
}

function normalizeThread(t: XFThread): NormalizedThread {
  return {
    threadId: t.thread_id,
    nodeId: t.node_id,
    title: t.title,
    authorId: t.user_id,
    authorName: t.username,
    authorAvatar: t.User?.avatar_urls?.l ?? t.User?.avatar_urls?.m ?? null,
    postDate: t.post_date,
    replyCount: t.reply_count,
    viewCount: t.view_count,
    lastPostDate: t.last_post_date,
    lastPostUsername: t.last_post_username,
    isSticky: t.sticky,
    isOpen: t.discussion_open,
    forumName: t.Forum?.title ?? null,
  };
}

function normalizePost(p: XFPost): NormalizedPost {
  // Prefer XenForo's pre-rendered HTML (message_parsed) over our BBCode transformer.
  // XenForo handles attachments, mentions, media embeds, and custom BB codes natively.
  const rawPost = p as any; // XF API may include message_parsed
  let contentHtml: string;

  if (rawPost.message_parsed) {
    // Use XenForo's rendered HTML — rewrite internal URLs to /forum/ routes
    contentHtml = rewriteXFHtml(rawPost.message_parsed);
  } else {
    // Fallback: transform BBCode ourselves
    const transformed = transformBBCode(p.message);
    contentHtml = transformed.contentHtml;
  }

  return {
    postId: p.post_id,
    threadId: p.thread_id,
    authorId: p.user_id,
    authorName: p.username,
    authorAvatar: p.User?.avatar_urls?.l ?? p.User?.avatar_urls?.m ?? null,
    authorTitle: p.User?.user_title ?? null,
    authorMessageCount: p.User?.message_count ?? 0,
    authorReactionScore: p.User?.reaction_score ?? 0,
    authorJoinDate: p.User?.register_date ?? 0,
    postDate: p.post_date,
    contentHtml,
    isFirstPost: p.is_first_post,
    reactionScore: p.reaction_score,
    position: p.position,
    attachments: (p.Attachments ?? []).map((a) => ({
      id: a.attachment_id,
      filename: a.filename,
      fileSize: a.file_size,
      thumbnailUrl: a.thumbnail_url ?? null,
      directUrl: a.direct_url ?? null,
      contentType: a.content_type,
      width: a.width ?? null,
      height: a.height ?? null,
    })),
  };
}

/** Rewrite XenForo's rendered HTML: fix internal links, handle images properly */
function rewriteXFHtml(html: string): string {
  let result = html;

  // --- Link rewrites ---

  // Thread links: /threads/slug.123/ → /forum/thread/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/threads\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/thread/$1"'
  );
  // Also handle /threads/123/ without slug
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/threads\/(\d+)\/?"/g,
    'href="/forum/thread/$1"'
  );
  // Post links: /posts/123/ → anchor within page
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/posts\/(\d+)\/?"/g,
    'href="#post-$1"'
  );
  // Member links: /members/name.123/ → /forum/members/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/members\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/members/$1"'
  );
  // Forum links: /forums/slug.123/ → /forum/123
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/forums\/[^"]*?\.(\d+)\/?"/g,
    'href="/forum/$1"'
  );
  // Attachment download links: keep as external
  result = result.replace(
    /href="https?:\/\/forum\.ixwiki\.com\/attachments\/([^"]*)"/g,
    'href="https://forum.ixwiki.com/attachments/$1" target="_blank" rel="noopener noreferrer"'
  );

  // --- Image handling ---

  // Add referrerpolicy to prevent hotlink blocking (same pattern as WikiOS)
  result = result.replace(
    /<img(?![^>]*referrerpolicy)/g,
    '<img referrerpolicy="no-referrer"'
  );

  // Add lazy loading to images that don't have it
  result = result.replace(
    /<img(?![^>]*loading=)/g,
    '<img loading="lazy"'
  );

  // Add decoding="async" for better rendering
  result = result.replace(
    /<img(?![^>]*decoding=)/g,
    '<img decoding="async"'
  );

  // Add forum-img class for proper styling (responsive max-width)
  result = result.replace(
    /<img(?![^>]*class="[^"]*forum-img)/g,
    '<img class="forum-img"'
  );

  // XenForo wraps attachment images in <a> — make the images clickable/expandable
  // Fix attachment URLs that use relative paths
  result = result.replace(
    /src="\/data\//g,
    'src="https://forum.ixwiki.com/data/'
  );
  result = result.replace(
    /srcset="\/data\//g,
    'srcset="https://forum.ixwiki.com/data/'
  );
  // Fix srcset entries that have relative paths after commas
  result = result.replace(
    /srcset="([^"]*?)\/data\//g,
    'srcset="$1https://forum.ixwiki.com/data/'
  );

  // --- Element class enhancements ---
  result = result.replace(/<blockquote(?![^>]*class)/g, '<blockquote class="forum-quote"');
  result = result.replace(/<pre(?![^>]*class)/g, '<pre class="forum-code"');

  return result;
}

function normalizeNode(n: XFForum): ForumNode {
  return {
    nodeId: n.node_id,
    title: n.title,
    description: n.description,
    parentNodeId: n.parent_node_id,
    displayOrder: n.display_order,
    threadCount: n.type_data?.discussion_count ?? 0,
    messageCount: n.type_data?.message_count ?? 0,
    lastPostDate: n.type_data?.last_post_date ?? null,
    lastPostUsername: n.type_data?.last_post_username ?? null,
    lastThreadTitle: n.type_data?.last_thread_title ?? null,
    lastThreadId: n.type_data?.last_thread_id ?? null,
    nodeType: n.node_type_id,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const forumRouter = createTRPCRouter({

  // =========================================================================
  // READ ENDPOINTS
  // =========================================================================

  /**
   * Get recent threads across ALL forums (for Trending / New Posts views).
   */
  getRecentThreads: publicProcedure
    .input(
      z.object({
        order: z.enum(["last_post_date", "post_date", "reply_count", "view_count"]).default("last_post_date"),
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
    const data = await cachedFetch(
      cacheKey("forums"),
      "forums",
      () => xfFetch<XFForumsResponse>("/nodes/")
    );

    if (!data?.nodes) return { forums: [] };

    return {
      forums: data.nodes
        .filter((n) => n.node_type_id === "Forum" || n.node_type_id === "Category")
        .sort((a, b) => a.display_order - b.display_order)
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
        order: z.enum(["last_post_date", "post_date", "reply_count", "view_count"]).default("last_post_date"),
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
   * Get a single post.
   */
  getPost: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      const key = cacheKey("post", input.postId);
      const data = await cachedFetch(key, "post", () =>
        xfFetch<{ post: XFPost }>(`/posts/${input.postId}/`)
      );

      return data?.post ? normalizePost(data.post) : null;
    }),

  /**
   * Get a member's profile.
   */
  getMember: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
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
          thread: r.content_type === "thread" ? normalizeThread(r.content as unknown as XFThread) : null,
          post: r.content_type === "post" ? normalizePost(r.content as unknown as XFPost) : null,
        })),
        pagination: results?.pagination ?? null,
      };
    }),

  // NOTE: Forum alerts route through the global notification system (DynamicIsland).
  // Private messages are centralized in ThinkShare (/messages).
  // XenForo conversations and alerts are not exposed as separate endpoints.

  // =========================================================================
  // STASH ENDPOINTS (uses LoreStash system for forum content)
  // =========================================================================

  /**
   * Stash a forum thread for later.
   */
  stashThread: protectedProcedure
    .input(
      z.object({
        threadId: z.number(),
        title: z.string().min(1).max(500),
        stashId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      // Get or create the user's default stash
      let targetStashId = input.stashId;
      if (!targetStashId) {
        const defaultStash = await db.loreStash.findFirst({
          where: { userId: ctx.auth.userId, isDefault: true },
        });
        if (defaultStash) {
          targetStashId = defaultStash.id;
        } else {
          const created = await db.loreStash.create({
            data: { userId: ctx.auth.userId, name: "My Stash", isDefault: true },
          });
          targetStashId = created.id;
        }
      }

      const pageTitle = `forum:thread:${input.threadId}`;
      const pageSlug = `/forum/thread/${input.threadId}`;

      await db.loreStashItem.upsert({
        where: { stashId_pageTitle: { stashId: targetStashId, pageTitle } },
        create: {
          stashId: targetStashId,
          pageTitle,
          pageSlug,
          contentType: "forum_thread",
          contentId: input.threadId,
          note: input.title,
        },
        update: { updatedAt: new Date() },
      });

      return { success: true, stashId: targetStashId };
    }),

  /**
   * Remove a forum thread from stash.
   */
  unstashThread: protectedProcedure
    .input(
      z.object({
        threadId: z.number(),
        stashId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const pageTitle = `forum:thread:${input.threadId}`;

      if (input.stashId) {
        await db.loreStashItem.deleteMany({
          where: { stashId: input.stashId, pageTitle },
        });
      } else {
        // Remove from all user's stashes
        const userStashes = await db.loreStash.findMany({
          where: { userId: ctx.auth.userId },
          select: { id: true },
        });
        await db.loreStashItem.deleteMany({
          where: {
            stashId: { in: userStashes.map((s) => s.id) },
            pageTitle,
          },
        });
      }

      return { success: true };
    }),

  /**
   * Check if a thread is stashed.
   */
  isThreadStashed: protectedProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const pageTitle = `forum:thread:${input.threadId}`;
      const userStashes = await db.loreStash.findMany({
        where: { userId: ctx.auth.userId },
        select: { id: true, name: true, color: true },
      });

      const items = await db.loreStashItem.findMany({
        where: {
          stashId: { in: userStashes.map((s) => s.id) },
          pageTitle,
        },
        select: { stashId: true },
      });

      const stashedIn = items.map((item) => {
        const stash = userStashes.find((s) => s.id === item.stashId);
        return stash ? { id: stash.id, name: stash.name, color: stash.color } : null;
      }).filter(Boolean);

      return {
        stashed: stashedIn.length > 0,
        stashes: stashedIn,
      };
    }),

  /**
   * Get all stashed forum threads for the current user.
   */
  getStashedThreads: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const { db } = await import("~/server/db");
      const userStashes = await db.loreStash.findMany({
        where: { userId: ctx.auth.userId },
        select: { id: true },
      });

      const items = await db.loreStashItem.findMany({
        where: {
          stashId: { in: userStashes.map((s) => s.id) },
          contentType: "forum_thread",
        },
        orderBy: { savedAt: "desc" },
        take: input?.limit ?? 50,
      });

      return items.map((item) => ({
        id: item.id,
        threadId: item.contentId,
        title: item.note ?? item.pageTitle.replace("forum:thread:", "Thread #"),
        slug: item.pageSlug,
        savedAt: item.savedAt,
      }));
    }),

  // =========================================================================
  // WRITE ENDPOINTS (require linked forum account)
  // =========================================================================

  /**
   * Create a new thread.
   */
  createThread: protectedProcedure
    .input(
      z.object({
        forumId: z.number(),
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ thread: XFThread }>(
        "/threads/",
        {
          node_id: String(input.forumId),
          title: input.title,
          message: input.message,
        },
        xfUserId
      );

      if (!result?.thread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create thread",
        });
      }

      // Invalidate thread list cache for this forum
      cacheInvalidate(`forum:threadList:${input.forumId}`);

      // Global notification for new thread
      try {
        const { db } = await import("~/server/db");
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { forumUsername: true },
        });

        await notificationAPI.create({
          title: `New forum thread: ${input.title}`,
          message: `${user?.forumUsername ?? "Someone"} started a new discussion`,
          category: "social",
          priority: "low",
          source: "forum",
          href: `/forum/thread/${result.thread.thread_id}`,
          metadata: {
            threadId: result.thread.thread_id,
            forumId: input.forumId,
            authorName: user?.forumUsername,
          },
        });
      } catch {
        // Non-critical
      }

      return { thread: normalizeThread(result.thread) };
    }),

  /**
   * Reply to a thread.
   */
  createPost: protectedProcedure
    .input(
      z.object({
        threadId: z.number(),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ post: XFPost }>(
        "/posts/",
        {
          thread_id: String(input.threadId),
          message: input.message,
        },
        xfUserId
      );

      if (!result?.post) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create post",
        });
      }

      invalidateThread(input.threadId);

      // Notify thread followers via global notification system
      try {
        const { db } = await import("~/server/db");
        const user = await db.user.findUnique({
          where: { id: ctx.user.id },
          select: { forumUsername: true },
        });

        await notificationAPI.create({
          title: `New reply in forum thread`,
          message: `${user?.forumUsername ?? "Someone"} replied to a thread`,
          category: "social",
          priority: "low",
          source: "forum",
          href: `/forum/thread/${input.threadId}#post-${result.post.post_id}`,
          metadata: {
            threadId: input.threadId,
            postId: result.post.post_id,
            authorName: user?.forumUsername,
          },
        });
      } catch {
        // Non-critical — don't fail the mutation if notification fails
      }

      return { post: normalizePost(result.post) };
    }),

  /**
   * Edit a post.
   */
  editPost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        message: z.string().min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ post: XFPost }>(
        `/posts/${input.postId}/`,
        { message: input.message },
        xfUserId
      );

      if (!result?.post) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to edit post",
        });
      }

      invalidateThread(result.post.thread_id);

      return { post: normalizePost(result.post) };
    }),

  /**
   * Delete a post.
   */
  deletePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfDelete<{ success: boolean }>(
        `/posts/${input.postId}/${input.reason ? `?reason=${encodeURIComponent(input.reason)}` : ""}`,
        xfUserId
      );

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete post",
        });
      }

      cacheInvalidate("forum:thread:");
      return { success: true };
    }),

  /**
   * React to a post.
   */
  reactToPost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        reactionId: z.number().default(1), // 1 = Like in default XenForo
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ success: boolean }>(
        `/posts/${input.postId}/react`,
        { reaction_id: String(input.reactionId) },
        xfUserId
      );

      cacheInvalidate(`forum:post:${input.postId}`);
      cacheInvalidate("forum:thread:");

      return { success: result !== null };
    }),

  /**
   * Bookmark a post.
   */
  bookmarkPost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      const result = await xfPostAsUser<{ success: boolean }>(
        `/posts/${input.postId}/bookmark`,
        input.message ? { message: input.message } : {},
        xfUserId
      );

      return { success: result !== null };
    }),

  /**
   * Mark a forum/thread as read.
   */
  markForumRead: protectedProcedure
    .input(
      z.object({
        forumId: z.number().optional(),
        threadId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      if (input.threadId) {
        await xfPostAsUser(
          `/threads/${input.threadId}/mark-read`,
          {},
          xfUserId
        );
      } else if (input.forumId) {
        await xfPostAsUser(
          `/forums/${input.forumId}/mark-read`,
          {},
          xfUserId
        );
      }

      return { success: true };
    }),

  // Conversations removed — all private messaging is centralized in ThinkShare.

  // =========================================================================
  // MODERATION ENDPOINTS (require admin / system owner)
  // =========================================================================

  /**
   * Moderate a post (soft delete, undelete, or approve).
   */
  moderatePost: adminProcedure
    .input(
      z.object({
        postId: z.number(),
        action: z.enum(["soft_delete", "undelete", "approve"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      let body: Record<string, unknown>;
      switch (input.action) {
        case "soft_delete":
          body = { soft_delete: true, soft_delete_reason: "Moderated via IxStates" };
          break;
        case "undelete":
          body = { soft_delete: false };
          break;
        case "approve":
          body = { message_state: "visible" };
          break;
      }

      const result = await xfPostAsUser<{ post: XFPost }>(
        `/posts/${input.postId}/`,
        body,
        xfUserId
      );

      if (!result?.post) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ${input.action} post`,
        });
      }

      cacheInvalidate("forum:thread:");
      cacheInvalidate(`forum:post:${input.postId}`);

      return { success: true, post: normalizePost(result.post) };
    }),

  /**
   * Moderate a thread (lock, unlock, soft delete, undelete, sticky, unsticky).
   */
  moderateThread: adminProcedure
    .input(
      z.object({
        threadId: z.number(),
        action: z.enum(["lock", "unlock", "soft_delete", "undelete", "sticky", "unsticky"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const xfUserId = await requireForumUser(ctx.user.id);

      let body: Record<string, unknown>;
      switch (input.action) {
        case "lock":
          body = { discussion_open: false };
          break;
        case "unlock":
          body = { discussion_open: true };
          break;
        case "soft_delete":
          body = { soft_delete: true, soft_delete_reason: "Moderated via IxStates" };
          break;
        case "undelete":
          body = { soft_delete: false };
          break;
        case "sticky":
          body = { sticky: true };
          break;
        case "unsticky":
          body = { sticky: false };
          break;
      }

      const result = await xfPostAsUser<{ thread: XFThread }>(
        `/threads/${input.threadId}/`,
        body,
        xfUserId
      );

      if (!result?.thread) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ${input.action} thread`,
        });
      }

      invalidateThread(input.threadId);
      cacheInvalidate("forum:threadList:");

      return { success: true, thread: normalizeThread(result.thread) };
    }),

  // =========================================================================
  // ALERT SYNC (surface XenForo alerts in IxStates UI)
  // =========================================================================

  /**
   * Fetch the current user's XenForo alerts.
   * Does not create IxStates notifications — just surfaces them for the UI.
   */
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    const xfUserId = await requireForumUser(ctx.user.id);

    const data = await xfFetchAsUser<{
      alerts: Array<{
        alert_id: number;
        alert_text: string;
        content_type: string;
        content_id: number;
        action: string;
        user_id: number;
        username: string;
        read_date: number;
        event_date: number;
        view_date: number;
      }>;
    }>("/alerts/?page=1", xfUserId);

    if (!data?.alerts) return { alerts: [] };

    return {
      alerts: data.alerts.map((a) => ({
        id: a.alert_id,
        title: `${a.username} — ${a.action}`,
        message: a.alert_text,
        read: a.read_date > 0,
        date: a.event_date,
        link:
          a.content_type === "post"
            ? `/forum/thread/0#post-${a.content_id}`
            : a.content_type === "thread"
              ? `/forum/thread/${a.content_id}`
              : null,
      })),
    };
  }),

  // =========================================================================
  // ACCOUNT LINKING (existing endpoints, kept intact)
  // =========================================================================

  /**
   * Link the current user's IxStats account to their XenForo forum account.
   */
  linkAccount: protectedProcedure
    .input(z.object({ forumUsername: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await linkForumAccount(ctx.user.id, input.forumUsername);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to link forum account",
        });
      }

      return {
        success: true,
        forumUserId: result.forumUserId,
      };
    }),

  /**
   * Manually sync the current user's IxStats data to their XenForo forum profile.
   */
  syncProfile: protectedProcedure.mutation(async ({ ctx }) => {
    const synced = await syncUserToForum(ctx.user.id);
    return { synced };
  }),

  /**
   * Get the current user's forum link status.
   */
  getLinkStatus: protectedProcedure.query(async ({ ctx }) => {
    const { db } = await import("~/server/db");
    let user = await db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        forumUserId: true,
        forumUsername: true,
        lastForumSync: true,
      },
    });

    // Backfill: if forumUsername exists but forumUserId is missing, look it up
    if (user?.forumUsername && !user.forumUserId) {
      try {
        const { lookupForumUser } = await import("~/modules/forum");
        const xfUser = await lookupForumUser(user.forumUsername);
        if (xfUser) {
          await db.user.update({
            where: { id: ctx.user.id },
            data: { forumUserId: xfUser.userId },
          });
          return {
            linked: true,
            forumUserId: xfUser.userId,
            forumUsername: user.forumUsername,
            lastSynced: user.lastForumSync ?? null,
          };
        }
      } catch { /* non-critical */ }
    }

    return {
      linked: !!user?.forumUserId || !!user?.forumUsername,
      forumUserId: user?.forumUserId ?? null,
      forumUsername: user?.forumUsername ?? null,
      lastSynced: user?.lastForumSync ?? null,
    };
  }),

  /**
   * Unlink the current user's forum account.
   */
  unlinkAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const { db } = await import("~/server/db");
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        forumUserId: null,
        forumUsername: null,
        lastForumSync: null,
      },
    });
    return { success: true };
  }),

  /**
   * Admin: one-time setup to create IxStats custom user fields in XenForo.
   */
  setupCustomFields: adminProcedure.mutation(async () => {
    const result = await setupForumCustomFields();
    return result;
  }),
});
