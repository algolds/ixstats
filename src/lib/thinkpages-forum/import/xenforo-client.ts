/**
 * Read-only XenForo 2.2 REST client for the phase 4 export (the XenForo forum → native forum). `fetch` is
 * injected (required), as are, optionally, `sleep` and the clock, so tests make no network calls. Every request
 * carries `XF-Api-Key`, `Accept: application/json` and a `User-Agent`, never `XF-Api-User` (no impersonation).
 * With a super-user key, reads add `api_bypass_permissions=1` (read-only: the key sees private forums, moderated
 * and deleted content and every attachment instead of running as a guest). The key never appears in logs or
 * errors. Requests are paced (`requestsPerSecond`); 429 (honouring `Retry-After`, capped), 5xx and network errors
 * are retried up to `maxRetries` times after the first attempt with a 1 s · 2^n backoff; 401/403 and other 4xx
 * fail at once. All endpoint strings live in this file.
 */
import type {
  XfAttachment,
  XfIndexResponse,
  XfNode,
  XfNodesResponse,
  XfPagination,
  XfPost,
  XfPostsResponse,
  XfThread,
  XfThreadsResponse,
  XfUserLite,
  XfUserResponse,
} from "./xenforo-types";

/** Recorded in the snapshot's meta.json and sent in the User-Agent. */
export const XENFORO_EXPORT_CLIENT_VERSION = "1.0";

export interface XenForoClientOptions {
  apiUrl: string;
  apiKey: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Default 4. */
  requestsPerSecond?: number;
  /** Retries after the first attempt (default 5: at most 6 attempts), backoff 1 s · 2^n, on 429, 5xx and network errors. */
  maxRetries?: number;
  /** Per request, body included. Default 30 000. */
  timeoutMs?: number;
  /** For attachment downloads. Default 120 000. */
  attachmentTimeoutMs?: number;
  /** Default `IxStats-ForumExport/<version>`. */
  userAgent?: string;
  /**
   * Send `api_bypass_permissions=1` on reads. "auto" (default): on unless `index()` reports a key type other than
   * "super" (on when the type is unknown).
   */
  bypassPermissions?: boolean | "auto";
  log?: (line: string) => void;
}

export class XenForoExportError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = "XenForoExportError";
  }
}

export interface XenForoClientStats {
  requests: number;
  retries: number;
  waitedMs: number;
}

export interface XenForoRequestContext {
  /** The key type `index()` reported ("super", "user", "guest"), or null when unknown. */
  keyType: string | null;
  bypassPermissions: boolean;
}

export interface XenForoClient {
  index(): Promise<{ scopes: string[]; superUser: boolean; keyType: string | null }>;
  nodes(): Promise<XfNode[]>;
  threadsOf(nodeId: number): AsyncGenerator<XfThread>;
  postsOf(threadId: number): AsyncGenerator<XfPost>;
  /** null on 404 and on 403 (a key without user:read). */
  user(userId: number): Promise<XfUserLite | null>;
  /** null on 404; a 403 throws (`status: 403`). `contentType` is the raw Content-Type header ("" when absent). */
  attachmentData(attachmentId: number): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  stats(): XenForoClientStats;
  context(): XenForoRequestContext;
}

const ENDPOINTS = {
  index: () => "/index",
  nodes: () => "/nodes/",
  threads: (nodeId: number, page: number) =>
    `/forums/${nodeId}/threads?page=${page}&order=post_date&direction=asc`,
  posts: (threadId: number, page: number) =>
    `/threads/${threadId}/posts?page=${page}&order=natural`,
  user: (userId: number) => `/users/${userId}/`,
  attachmentData: (attachmentId: number) => `/attachments/${attachmentId}/data`,
};

const BACKOFF_BASE_MS = 1000;
const MAX_RETRY_AFTER_MS = 120_000;
const BYPASS_PARAM = "api_bypass_permissions=1";

/** `Retry-After` in ms (seconds or an HTTP date), capped; 0 when absent or unparsable. */
function retryAfterMs(header: string | null, nowMs: number): number {
  if (!header) return 0;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - nowMs;
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : 0;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

function pickNode(n: XfNode): XfNode {
  const typeData = n.type_data && !Array.isArray(n.type_data) ? n.type_data : undefined;
  return {
    node_id: n.node_id,
    title: n.title,
    description: n.description,
    node_type_id: n.node_type_id,
    parent_node_id: n.parent_node_id,
    display_order: n.display_order,
    ...(typeData && {
      type_data: {
        discussion_count: typeData.discussion_count,
        message_count: typeData.message_count,
      },
    }),
  };
}

function pickThread(t: XfThread): XfThread {
  return {
    thread_id: t.thread_id,
    node_id: t.node_id,
    title: t.title,
    user_id: t.user_id,
    username: t.username,
    post_date: t.post_date,
    last_post_date: t.last_post_date,
    reply_count: t.reply_count,
    view_count: t.view_count,
    first_post_id: t.first_post_id,
    discussion_open: t.discussion_open,
    sticky: t.sticky,
    discussion_state: t.discussion_state,
    ...(t.discussion_type !== undefined && { discussion_type: t.discussion_type }),
    prefix_id: t.prefix_id,
  };
}

function pickAttachment(a: XfAttachment): XfAttachment {
  return {
    attachment_id: a.attachment_id,
    filename: a.filename,
    file_size: a.file_size,
    content_type: a.content_type,
    ...(a.width !== undefined && { width: a.width }),
    ...(a.height !== undefined && { height: a.height }),
  };
}

function pickPost(p: XfPost): XfPost {
  return {
    post_id: p.post_id,
    thread_id: p.thread_id,
    user_id: p.user_id,
    username: p.username,
    post_date: p.post_date,
    ...(p.last_edit_date ? { last_edit_date: p.last_edit_date } : {}),
    message: p.message,
    message_state: p.message_state,
    position: p.position,
    attach_count: p.attach_count,
    is_first_post: p.is_first_post,
    ...(p.Attachments?.length ? { Attachments: p.Attachments.map(pickAttachment) } : {}),
  };
}

function pickUser(u: XfUserLite): XfUserLite {
  return {
    user_id: u.user_id,
    username: u.username,
    register_date: u.register_date,
    is_staff: u.is_staff,
    message_count: u.message_count,
  };
}

interface Page<T> {
  items: T[];
  pagination?: XfPagination;
}

export function createXenForoClient(options: XenForoClientOptions): XenForoClient {
  const doFetch = options.fetch;
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const intervalMs = 1000 / (options.requestsPerSecond ?? 4);
  const maxRetries = options.maxRetries ?? 5;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const attachmentTimeoutMs = options.attachmentTimeoutMs ?? 120_000;
  const userAgent = options.userAgent ?? `IxStats-ForumExport/${XENFORO_EXPORT_CLIENT_VERSION}`;
  const bypassOption = options.bypassPermissions ?? "auto";
  let keyType: string | null = null;
  const bypass = () =>
    bypassOption === "auto" ? keyType === null || keyType === "super" : bypassOption;
  const log = options.log ?? (() => undefined);
  const baseUrl = options.apiUrl.replace(/\/+$/, "");
  const apiKey = options.apiKey;
  const stats: XenForoClientStats = { requests: 0, retries: 0, waitedMs: 0 };
  let nextSlot = 0;

  const redact = (text: string) => (apiKey ? text.split(apiKey).join("[redacted]") : text);

  async function pace(): Promise<void> {
    const at = now();
    if (at < nextSlot) {
      const wait = nextSlot - at;
      stats.waitedMs += wait;
      await sleep(wait);
    }
    nextSlot = Math.max(at, nextSlot) + intervalMs;
  }

  async function attempt(endpoint: string, timeout: number): Promise<Response> {
    await pace();
    stats.requests += 1;
    return doFetch(`${baseUrl}${endpoint}`, {
      headers: { "XF-Api-Key": apiKey, Accept: "application/json", "User-Agent": userAgent },
      signal: AbortSignal.timeout(timeout),
    });
  }

  async function backoff(
    endpoint: string,
    retry: number,
    reason: string,
    retryAfter = 0
  ): Promise<void> {
    const wait = Math.max(BACKOFF_BASE_MS * 2 ** retry, retryAfter);
    stats.retries += 1;
    stats.waitedMs += wait;
    log(`[xenforo] ${endpoint}: ${reason}; retry ${retry + 1}/${maxRetries} in ${wait} ms`);
    await sleep(wait);
  }

  /** GET `endpoint` (with the bypass parameter when `read` and bypass is on). */
  async function request(path: string, read = true, timeout = timeoutMs): Promise<Response> {
    const endpoint =
      read && bypass() ? `${path}${path.includes("?") ? "&" : "?"}${BYPASS_PARAM}` : path;
    for (let retry = 0; ; retry += 1) {
      let response: Response;
      try {
        response = await attempt(endpoint, timeout);
      } catch (error) {
        const reason = redact(error instanceof Error ? error.message : String(error));
        if (retry >= maxRetries) {
          throw new XenForoExportError(
            `XenForo GET ${endpoint} failed: ${reason}`,
            undefined,
            endpoint
          );
        }
        await backoff(endpoint, retry, reason);
        continue;
      }
      if (response.ok) return response;
      if (!isRetryable(response.status) || retry >= maxRetries) {
        throw new XenForoExportError(
          `XenForo GET ${endpoint} failed: HTTP ${response.status}`,
          response.status,
          endpoint
        );
      }
      const retryAfter =
        response.status === 429 ? retryAfterMs(response.headers.get("retry-after"), now()) : 0;
      await backoff(endpoint, retry, `HTTP ${response.status}`, retryAfter);
    }
  }

  /** The response, or null when the server answers one of `missing` (default 404). */
  async function requestOrMissing(
    path: string,
    missing: number[] = [404],
    timeout = timeoutMs
  ): Promise<Response | null> {
    try {
      return await request(path, true, timeout);
    } catch (error) {
      if (error instanceof XenForoExportError && missing.includes(error.status ?? 0)) return null;
      throw error;
    }
  }

  async function getJson<T>(endpoint: string, read = true): Promise<T> {
    const body: T = await (await request(endpoint, read)).json();
    return body;
  }

  async function* paginate<T>(
    endpointFor: (page: number) => string,
    load: (endpoint: string) => Promise<Page<T>>,
    idOf: (item: T) => number
  ): AsyncGenerator<T> {
    const firstIds = new Set<number>();
    const yielded = new Set<number>();
    for (let page = 1; ; page += 1) {
      const endpoint = endpointFor(page);
      const { items, pagination } = await load(endpoint);
      const first = items[0];
      if (first !== undefined) {
        if (firstIds.has(idOf(first))) {
          throw new XenForoExportError(
            `XenForo GET ${endpoint}: repeated page`,
            undefined,
            endpoint
          );
        }
        firstIds.add(idOf(first));
      }
      for (const item of items) {
        if (yielded.has(idOf(item))) continue;
        yielded.add(idOf(item));
        yield item;
      }
      if (!pagination || page >= pagination.last_page) return;
    }
  }

  return {
    async index() {
      const body = await getJson<XfIndexResponse>(ENDPOINTS.index(), false);
      const key = body.key ?? {};
      keyType = key.type ?? null;
      return {
        scopes: key.allow_all_scopes ? ["*"] : (key.scopes ?? []),
        superUser: key.type === "super",
        keyType,
      };
    },

    async nodes() {
      const body = await getJson<XfNodesResponse>(ENDPOINTS.nodes());
      return body.nodes.map(pickNode);
    },

    threadsOf(nodeId) {
      return paginate(
        (page) => ENDPOINTS.threads(nodeId, page),
        async (endpoint) => {
          const body = await getJson<XfThreadsResponse>(endpoint);
          const items = [...body.threads, ...(body.sticky ?? [])].map(pickThread);
          return { items, pagination: body.pagination };
        },
        (thread) => thread.thread_id
      );
    },

    postsOf(threadId) {
      return paginate(
        (page) => ENDPOINTS.posts(threadId, page),
        async (endpoint) => {
          const body = await getJson<XfPostsResponse>(endpoint);
          return { items: body.posts.map(pickPost), pagination: body.pagination };
        },
        (post) => post.post_id
      );
    },

    async user(userId) {
      const response = await requestOrMissing(ENDPOINTS.user(userId), [403, 404]);
      if (!response) {
        log(`[xenforo] user ${userId}: not readable (404 or 403), recorded as unavailable`);
        return null;
      }
      const body: XfUserResponse = await response.json();
      return pickUser(body.user);
    },

    async attachmentData(attachmentId) {
      const response = await requestOrMissing(
        ENDPOINTS.attachmentData(attachmentId),
        [404],
        attachmentTimeoutMs
      );
      if (!response) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, contentType: response.headers.get("content-type") ?? "" };
    },

    stats: () => ({ ...stats }),
    context: () => ({ keyType, bypassPermissions: bypass() }),
  };
}
