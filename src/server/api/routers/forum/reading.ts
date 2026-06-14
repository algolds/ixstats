// src/server/api/routers/forum.ts
// tRPC router for native XenForo forum integration.
// Proxies XenForo REST API calls, transforms BBCode server-side,
// and handles account linking + profile sync.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
  getXfApiKey,
  getXfApiUrl,
  transformBBCode,
  cachedFetch,
  cacheKey,
} from "~/server/modules/forum";

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
// eslint-disable-next-line unused-imports/no-unused-vars
async function requireForumUser(userId: string): Promise<number> {
  const { db } = await import("~/server/db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { forumUserId: true, forumUsername: true },
  });

  if (user?.forumUserId) return user.forumUserId;

  // Fallback: if forumUsername is set but forumUserId is missing, look it up and backfill
  if (user?.forumUsername) {
    const { lookupForumUser } = await import("~/server/modules/forum");
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
    message:
      "You must link your forum account first. Go to Profile → IxnayID to connect your accounts.",
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
  result = result.replace(/<img(?![^>]*referrerpolicy)/g, '<img referrerpolicy="no-referrer"');

  // Add lazy loading to images that don't have it
  result = result.replace(/<img(?![^>]*loading=)/g, '<img loading="lazy"');

  // Add decoding="async" for better rendering
  result = result.replace(/<img(?![^>]*decoding=)/g, '<img decoding="async"');

  // Add forum-img class for proper styling (responsive max-width)
  result = result.replace(/<img(?![^>]*class="[^"]*forum-img)/g, '<img class="forum-img"');

  // XenForo wraps attachment images in <a> — make the images clickable/expandable
  // Fix attachment URLs that use relative paths
  result = result.replace(/src="\/data\//g, 'src="https://forum.ixwiki.com/data/');
  result = result.replace(/srcset="\/data\//g, 'srcset="https://forum.ixwiki.com/data/');
  // Fix srcset entries that have relative paths after commas
  result = result.replace(/srcset="([^"]*?)\/data\//g, 'srcset="$1https://forum.ixwiki.com/data/');

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
   * Get a single post.
   */
  getPost: publicProcedure.input(z.object({ postId: z.number() })).query(async ({ input }) => {
    const key = cacheKey("post", input.postId);
    const data = await cachedFetch(key, "post", () =>
      xfFetch<{ post: XFPost }>(`/posts/${input.postId}/`)
    );

    return data?.post ? normalizePost(data.post) : null;
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

  // =========================================================================
  // STASH ENDPOINTS (uses LoreStash system for forum content)
  // =========================================================================

  // =========================================================================
  // WRITE ENDPOINTS (require linked forum account)
  // =========================================================================

  // Conversations removed — all private messaging is centralized in ThinkShare.

  // =========================================================================
  // MODERATION ENDPOINTS (require admin / system owner)
  // =========================================================================

  // =========================================================================
  // ALERT SYNC (surface XenForo alerts in IxStates UI)
  // =========================================================================

  // =========================================================================
  // ACCOUNT LINKING (existing endpoints, kept intact)
  // =========================================================================
});
