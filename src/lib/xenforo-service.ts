// src/lib/xenforo-service.ts
// Fetches recent activity from the XenForo forum REST API for the unified activity hub.

export interface ForumActivityItem {
  id: string;
  type: "thread" | "post";
  title: string;
  author: string;
  timestamp: Date;
  url: string;
  forumName?: string;
  replyCount?: number;
  viewCount?: number;
  excerpt?: string;
}

interface XFThreadsResponse {
  threads: Array<{
    thread_id: number;
    title: string;
    username: string;
    post_date: number;
    reply_count: number;
    view_count: number;
    Forum?: { title: string };
  }>;
}

interface XFPostsResponse {
  posts: Array<{
    post_id: number;
    thread_id: number;
    username: string;
    post_date: number;
    message: string;
    is_first_post: boolean;
    Thread?: { title: string };
  }>;
}

export interface ForumThread {
  threadId: number;
  title: string;
  author: string;
  timestamp: Date;
  url: string;
  forumName?: string;
  replyCount: number;
  viewCount: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cached: { data: ForumActivityItem[]; fetchedAt: number } | null = null;
let cachedThreads: { data: ForumThread[]; fetchedAt: number } | null = null;

function getApiKey(): string | undefined {
  return process.env.XENFORO_API_KEY;
}

function getApiUrl(): string {
  return process.env.XENFORO_API_URL || "https://forum.ixwiki.com/api";
}

function stripBBCode(text: string): string {
  return text.replace(/\[\/?\w+(?:=[^\]]*)?]/g, "").trim();
}

async function xfFetch<T>(endpoint: string): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      headers: {
        "XF-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XenForo] HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[XenForo] Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

/**
 * Fetch forum threads with engagement data for trending algorithm.
 */
export async function getForumTrendingThreads(limit = 15): Promise<ForumThread[]> {
  if (cachedThreads && Date.now() - cachedThreads.fetchedAt < CACHE_TTL) {
    return cachedThreads.data.slice(0, limit);
  }

  if (!getApiKey()) return [];

  const baseUrl = "https://forum.ixwiki.com";
  const data = await xfFetch<XFThreadsResponse>(`/threads/?order=last_post_date&direction=desc&limit=${limit}`);

  const threads: ForumThread[] = (data?.threads ?? []).map((t) => ({
    threadId: t.thread_id,
    title: t.title,
    author: t.username,
    timestamp: new Date(t.post_date * 1000),
    url: `${baseUrl}/threads/${t.thread_id}/`,
    forumName: t.Forum?.title,
    replyCount: t.reply_count,
    viewCount: t.view_count,
  }));

  cachedThreads = { data: threads, fetchedAt: Date.now() };
  return threads.slice(0, limit);
}

/**
 * Fetch recent forum activity (threads + posts) from XenForo.
 * Returns empty array silently if no API key is configured or API is unreachable.
 */
export async function getForumActivity(limit = 15): Promise<ForumActivityItem[]> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data.slice(0, limit);
  }

  if (!getApiKey()) return [];

  const baseUrl = "https://forum.ixwiki.com";

  const [threadsData, postsData] = await Promise.all([
    xfFetch<XFThreadsResponse>(`/threads/?order=last_post_date&direction=desc&limit=${limit}`),
    xfFetch<XFPostsResponse>(`/posts/?order=post_date&direction=desc&limit=${limit}`),
  ]);

  const items: ForumActivityItem[] = [];

  for (const thread of threadsData?.threads ?? []) {
    items.push({
      id: `xf-thread-${thread.thread_id}`,
      type: "thread",
      title: thread.title,
      author: thread.username,
      timestamp: new Date(thread.post_date * 1000),
      url: `${baseUrl}/threads/${thread.thread_id}/`,
      forumName: thread.Forum?.title,
      replyCount: thread.reply_count,
      viewCount: thread.view_count,
    });
  }

  // Skip first posts (already represented by thread entries)
  for (const post of postsData?.posts ?? []) {
    if (post.is_first_post) continue;

    const plainText = stripBBCode(post.message).slice(0, 120);
    items.push({
      id: `xf-post-${post.post_id}`,
      type: "post",
      title: post.Thread?.title ?? `Post #${post.post_id}`,
      author: post.username,
      timestamp: new Date(post.post_date * 1000),
      url: `${baseUrl}/posts/${post.post_id}/`,
      excerpt: plainText.length === 120 ? plainText + "..." : plainText,
    });
  }

  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const uniqueItems = items.slice(0, limit);

  cached = { data: uniqueItems, fetchedAt: Date.now() };
  return uniqueItems;
}
