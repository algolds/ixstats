// XenForo forum REST API client and recent-activity feeds for the unified activity hub.

interface ForumActivityItem {
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

export interface XFPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface ForumThread {
  threadId: number;
  title: string;
  author: string;
  timestamp: Date;
  url: string;
  forumName?: string;
  replyCount: number;
  viewCount: number;
}

export function getXfApiKey(): string | undefined {
  return process.env.XENFORO_API_KEY;
}

export function getXfApiUrl(): string {
  return process.env.XENFORO_API_URL || "https://forum.ixwiki.com/api";
}

interface XfRequestOptions {
  body?: Record<string, string>;
  /** Act as this XenForo user (XF-Api-User header; needs a super admin API key). */
  xfUserId?: number;
}

async function xfRequest<T>(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  { body, xfUserId }: XfRequestOptions = {}
): Promise<T | null> {
  const apiKey = getXfApiKey();
  if (!apiKey) return null;

  const label = method === "GET" ? "" : `${method} `;
  const asUser = xfUserId ? ` as user ${xfUserId}` : "";

  try {
    const response = await fetch(`${getXfApiUrl()}${endpoint}`, {
      ...(method !== "GET" && { method }),
      headers: {
        "XF-Api-Key": apiKey,
        ...(xfUserId && { "XF-Api-User": String(xfUserId) }),
        ...(body && { "Content-Type": "application/x-www-form-urlencoded" }),
        Accept: "application/json",
      },
      ...(body && { body: new URLSearchParams(body) }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(
        `[XenForo] ${label}HTTP ${response.status} for ${endpoint}${xfUserId ? ` (as user ${xfUserId})` : ""}`
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(
      `[XenForo] Failed to ${method === "GET" ? "fetch" : method} ${endpoint}${asUser}:`,
      error
    );
    return null;
  }
}

export const xfFetch = <T>(endpoint: string) => xfRequest<T>("GET", endpoint);

/** POST to a XenForo API endpoint (creating/updating resources such as custom fields). */
export const xfPost = <T>(endpoint: string, body: Record<string, string>) =>
  xfRequest<T>("POST", endpoint, { body });

/** GET from the XenForo API, acting as a specific user. */
export const xfFetchAsUser = <T>(endpoint: string, xfUserId: number) =>
  xfRequest<T>("GET", endpoint, { xfUserId });

/** POST to the XenForo API, acting as a specific user. */
export const xfPostAsUser = <T>(endpoint: string, body: Record<string, string>, xfUserId: number) =>
  xfRequest<T>("POST", endpoint, { body, xfUserId });

/** DELETE from the XenForo API, optionally acting as a specific user. */
export const xfDelete = <T>(endpoint: string, xfUserId?: number) =>
  xfRequest<T>("DELETE", endpoint, { xfUserId });

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FORUM_BASE_URL = "https://forum.ixwiki.com";

/** Builds a 1-hour-cached "latest threads" reader; empty when no API key is configured or the API is unreachable. */
function cachedThreadFeed<T>(
  toItem: (thread: XFThread) => T,
  finalize: (items: T[]) => T[] = (i) => i
) {
  let cache: { data: T[]; fetchedAt: number } | null = null;

  return async (limit = 15): Promise<T[]> => {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data.slice(0, limit);
    if (!getXfApiKey()) return [];

    const data = await xfFetch<XFThreadsResponse>(
      `/threads/?order=last_post_date&direction=desc&limit=${limit}`
    );
    const items = finalize((data?.threads ?? []).map(toItem));
    cache = { data: items, fetchedAt: Date.now() };
    return items.slice(0, limit);
  };
}

const toForumThread = (t: XFThread): ForumThread => ({
  threadId: t.thread_id,
  title: t.title,
  author: t.username,
  timestamp: new Date(t.post_date * 1000),
  url: `${FORUM_BASE_URL}/threads/${t.thread_id}/`,
  forumName: t.Forum?.title,
  replyCount: t.reply_count,
  viewCount: t.view_count,
});

/** Forum threads with engagement data for the trending algorithm. */
export const getForumTrendingThreads = cachedThreadFeed(toForumThread);

/** Recent forum activity for the unified activity hub (XenForo has no GET /posts/, so threads only). */
export const getForumActivity = cachedThreadFeed(
  (t): ForumActivityItem => {
    const { threadId, ...rest } = toForumThread(t);
    return { id: `xf-thread-${threadId}`, type: "thread", ...rest };
  },
  (items) => items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
);
