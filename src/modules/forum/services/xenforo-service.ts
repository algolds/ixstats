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

// ---------------------------------------------------------------------------
// XenForo API Response Types
// ---------------------------------------------------------------------------

export interface XFUser {
  user_id: number;
  username: string;
  user_title: string;
  message_count: number;
  reaction_score: number;
  trophy_points: number;
  register_date: number;
  last_activity: number;
  is_staff: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  avatar_urls: {
    o?: string;
    h?: string;
    l?: string;
    m?: string;
    s?: string;
  };
  custom_fields?: Record<string, string>;
  location?: string;
  about?: string;
}

export interface XFThread {
  thread_id: number;
  node_id: number;
  title: string;
  username: string;
  user_id: number;
  post_date: number;
  reply_count: number;
  view_count: number;
  first_post_id: number;
  last_post_date: number;
  last_post_id: number;
  last_post_username: string;
  discussion_open: boolean;
  sticky: boolean;
  discussion_state: string;
  prefix_id: number;
  Forum?: { node_id: number; title: string };
  User?: XFUser;
  FirstPost?: XFPost;
}

export interface XFPost {
  post_id: number;
  thread_id: number;
  user_id: number;
  username: string;
  post_date: number;
  message: string;
  message_state: string;
  is_first_post: boolean;
  reaction_score: number;
  position: number;
  attach_count: number;
  User?: XFUser;
  Thread?: XFThread;
  Attachments?: XFAttachment[];
  reactions?: Array<{ reaction_id: number; count: number }>;
}

export interface XFAttachment {
  attachment_id: number;
  filename: string;
  file_size: number;
  width?: number;
  height?: number;
  thumbnail_url?: string;
  direct_url?: string;
  content_type: string;
}

export interface XFForum {
  node_id: number;
  title: string;
  description: string;
  type_data: {
    discussion_count: number;
    message_count: number;
    last_post_date: number;
    last_post_id: number;
    last_post_username: string;
    last_thread_title?: string;
    last_thread_id?: number;
  };
  breadcrumb?: Array<{ node_id: number; title: string }>;
  display_order: number;
  parent_node_id: number;
  node_type_id: string;
}

export interface XFConversation {
  conversation_id: number;
  title: string;
  user_id: number;
  username: string;
  start_date: number;
  reply_count: number;
  last_message_date: number;
  last_message_user_id: number;
  last_message_username: string;
  is_unread: boolean;
  recipients?: XFUser[];
}

export interface XFConversationMessage {
  message_id: number;
  conversation_id: number;
  user_id: number;
  username: string;
  message_date: number;
  message: string;
  User?: XFUser;
  Attachments?: XFAttachment[];
}

export interface XFAlert {
  alert_id: number;
  alerted_user_id: number;
  user_id: number;
  username: string;
  content_type: string;
  content_id: number;
  action: string;
  event_date: number;
  read_date: number;
  view_date: number;
  alert_text?: string;
}

export interface XFSearchResult {
  content_type: string;
  content_id: number;
  Thread?: XFThread;
  Post?: XFPost;
}

// Response wrappers
export interface XFThreadsResponse {
  threads: XFThread[];
  pagination?: XFPagination;
}

export interface XFThreadResponse {
  thread: XFThread;
}

export interface XFPostsResponse {
  posts: XFPost[];
  pagination?: XFPagination;
}

export interface XFForumsResponse {
  nodes: XFForum[];
}

export interface XFForumResponse {
  node: XFForum;
  threads?: XFThread[];
  sticky_threads?: XFThread[];
  pagination?: XFPagination;
}

export interface XFConversationsResponse {
  conversations: XFConversation[];
  pagination?: XFPagination;
}

export interface XFAlertsResponse {
  alerts: XFAlert[];
  pagination?: XFPagination;
}

export interface XFSearchResponse {
  results: XFSearchResult[];
  pagination?: XFPagination;
}

export interface XFPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
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

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cached: { data: ForumActivityItem[]; fetchedAt: number } | null = null;
let cachedThreads: { data: ForumThread[]; fetchedAt: number } | null = null;

export function getXfApiKey(): string | undefined {
  return process.env.XENFORO_API_KEY;
}

export function getXfApiUrl(): string {
  return process.env.XENFORO_API_URL || "https://forum.ixwiki.com/api";
}

// Internal aliases for backward compat within this file
function getApiKey(): string | undefined { return getXfApiKey(); }
function getApiUrl(): string { return getXfApiUrl(); }

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
 * POST to XenForo API endpoint.
 * Used for creating/updating resources (custom fields, user profiles).
 */
export async function xfPost<T>(
  endpoint: string,
  body: Record<string, string>
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      method: "POST",
      headers: {
        "XF-Api-Key": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XenForo] POST HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[XenForo] Failed to POST ${endpoint}:`, error);
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
 * Search forum threads by title for card/article tie-in.
 * Returns matching threads sorted by last post date.
 */
export async function searchForumThreads(query: string, limit = 5): Promise<ForumThread[]> {
  if (!getApiKey()) return [];

  const baseUrl = "https://forum.ixwiki.com";
  const data = await xfFetch<XFThreadsResponse>(
    `/threads/?title=${encodeURIComponent(query)}&order=last_post_date&direction=desc&limit=${limit}`
  );

  return (data?.threads ?? []).map((t) => ({
    threadId: t.thread_id,
    title: t.title,
    author: t.username,
    timestamp: new Date(t.post_date * 1000),
    url: `${baseUrl}/threads/${t.thread_id}/`,
    forumName: t.Forum?.title,
    replyCount: t.reply_count,
    viewCount: t.view_count,
  }));
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

  // XenForo's /posts/ GET endpoint doesn't exist — use threads only for activity
  const threadsData = await xfFetch<XFThreadsResponse>(
    `/threads/?order=last_post_date&direction=desc&limit=${limit}`
  );

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

  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const uniqueItems = items.slice(0, limit);

  cached = { data: uniqueItems, fetchedAt: Date.now() };
  return uniqueItems;
}

// ---------------------------------------------------------------------------
// Per-user API methods (for write operations using XF-Api-User header)
// ---------------------------------------------------------------------------

/**
 * GET from XenForo API acting as a specific user.
 * Uses XF-Api-User header to impersonate the user (requires super admin API key).
 */
export async function xfFetchAsUser<T>(
  endpoint: string,
  xfUserId: number
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      headers: {
        "XF-Api-Key": apiKey,
        "XF-Api-User": String(xfUserId),
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XenForo] HTTP ${response.status} for ${endpoint} (as user ${xfUserId})`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[XenForo] Failed to fetch ${endpoint} as user ${xfUserId}:`, error);
    return null;
  }
}

/**
 * POST to XenForo API acting as a specific user.
 */
export async function xfPostAsUser<T>(
  endpoint: string,
  body: Record<string, string>,
  xfUserId: number
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      method: "POST",
      headers: {
        "XF-Api-Key": apiKey,
        "XF-Api-User": String(xfUserId),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XenForo] POST HTTP ${response.status} for ${endpoint} (as user ${xfUserId})`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[XenForo] Failed to POST ${endpoint} as user ${xfUserId}:`, error);
    return null;
  }
}

/**
 * DELETE from XenForo API, optionally acting as a specific user.
 */
export async function xfDelete<T>(
  endpoint: string,
  xfUserId?: number
): Promise<T | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const headers: Record<string, string> = {
    "XF-Api-Key": apiKey,
    Accept: "application/json",
  };
  if (xfUserId) headers["XF-Api-User"] = String(xfUserId);

  try {
    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      method: "DELETE",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[XenForo] DELETE HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[XenForo] Failed to DELETE ${endpoint}:`, error);
    return null;
  }
}
