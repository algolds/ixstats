/**
 * Test harness for the api.php modules (plan 410): in-memory deps, a request builder and a tiny
 * "bot" that keeps its cookies between calls, the way Pywikibot does.
 */
import { hashBotPassword } from "~/lib/wiki-os/api-compat/auth";
import { handleApiRequest, type ApiRequestInput, type ApiResponseOutput } from "~/lib/wiki-os/api-compat/dispatch";
import type { JsonObject } from "~/lib/wiki-os/api-compat/format";
import type { ApiStore } from "~/lib/wiki-os/api-compat/store-types";
import type {
  ApiDeps,
  ApiServices,
  ApiSessionRecord,
  AuthStore,
  BotPasswordRecord,
  PermissionLoader,
  SessionUser,
} from "~/lib/wiki-os/api-compat/types";
import { rightsForGroups, type Group, type Right } from "~/lib/wiki-os/rights";

export const NOW = new Date("2026-09-30T12:00:00Z");

export const HEKU: SessionUser = {
  name: "Heku",
  mwUserId: 7,
  ctx: { auth: { userId: "user_clerk_heku" }, user: { id: "u-heku", clerkUserId: "user_clerk_heku", wikiUsername: "Heku" } },
};

export interface FakeAuth extends AuthStore {
  sessions: Map<string, ApiSessionRecord>;
}

/** An in-memory bot-password table with one bot password `Heku@Bot`. */
export async function fakeAuthStore(
  password = "bot-secret",
  grants: string[] = ["basic", "editpage"]
): Promise<FakeAuth> {
  const botPassword: BotPasswordRecord = {
    id: "bp1",
    userId: "u-heku",
    appId: "Bot",
    passwordHash: await hashBotPassword(password),
    grants,
  };
  const sessions = new Map<string, ApiSessionRecord>();
  return {
    sessions,
    findBotPassword: async (name, appId) =>
      name === "Heku" && appId === "Bot" ? { botPassword, user: HEKU } : null,
    touchBotPassword: async () => undefined,
    createSession: async (input) => {
      sessions.set(input.id, { ...input, grants: botPassword.grants });
    },
    findSession: async (id) => {
      const session = sessions.get(id);
      return session ? { session, user: HEKU } : null;
    },
    extendSession: async () => undefined,
    pruneSessions: async () => undefined,
    deleteSession: async (id) => {
      sessions.delete(id);
    },
    findWebUser: async () => null,
  };
}

/** Permissions for the fake user: the groups' rights, capped by the bot password's grants when there is a ceiling. */
export function fakeLoader(groups: Group[] = ["*", "user", "sysop"]): PermissionLoader {
  return async (ctx, ceiling) => {
    const signedIn = Boolean(ctx.auth?.userId);
    const effective = signedIn ? groups : (["*"] as Group[]);
    const all = rightsForGroups(effective);
    const rights = ceiling ? new Set([...all].filter((right) => ceiling.has(right))) : all;
    return { groups: effective, rights: rights as Set<Right>, block: null, verifiedWikiUsername: null };
  };
}

export function fakeStore(overrides: Partial<ApiStore> = {}): ApiStore {
  const unexpected = (name: string) => () => {
    throw new Error(`unexpected store call: ${name}`);
  };
  const base = new Proxy(
    {},
    { get: (_target, name) => unexpected(String(name)) }
  ) as ApiStore;
  return { ...base, ...overrides };
}

export async function makeDeps(overrides: Partial<ApiDeps> = {}): Promise<ApiDeps> {
  return {
    auth: await fakeAuthStore(),
    loadPermissions: fakeLoader(),
    rateLimit: async () => ({ success: true, resetAt: new Date(NOW.getTime() + 60_000) }),
    search: async () => ({ hits: [], total: 0 }),
    services: new Proxy({}, { get: (_t, name) => () => { throw new Error(`unexpected service call: ${String(name)}`); } }) as ApiServices,
    store: fakeStore({
      statistics: async () => ({ pages: 10, articles: 8, edits: 50, images: 2, users: 3, activeUsers: 1, admins: 1 }),
      userStats: async () => ({ editCount: 12, registration: new Date("2020-01-02T03:04:05Z") }),
    }),
    siteUrl: "https://ixwiki.com",
    now: () => NOW,
    ...overrides,
  };
}

export interface CallOptions {
  method?: "GET" | "POST";
  body?: Record<string, string>;
  cookies?: Record<string, string>;
}

export function inputFor(query: string, options: CallOptions = {}): ApiRequestInput {
  const method = options.method ?? (options.body ? "POST" : "GET");
  return {
    method,
    query: new URLSearchParams(query),
    body: options.body ? Object.entries(options.body) : null,
    sessionCookie: options.cookies?.wikios_api_session,
    loginNonceCookie: options.cookies?.wikios_api_login,
    webAuthId: null,
    clientKey: "ip:203.0.113.9",
    anonymousName: "203.0.113.9",
    cookiePath: "/w/",
  };
}

/** One request; returns the response. */
export function call(deps: ApiDeps, query: string, options: CallOptions = {}): Promise<ApiResponseOutput> {
  return handleApiRequest(inputFor(query, options), deps);
}

/** A client with a cookie jar: each call sends the cookies earlier responses set. */
export class Bot {
  readonly jar: Record<string, string> = {};
  readonly log: Array<{ params: string; body: JsonObject }> = [];

  constructor(readonly deps: ApiDeps) {}

  async request(params: Record<string, string>, post = false): Promise<JsonObject> {
    const search = new URLSearchParams(params).toString();
    const output = await call(this.deps, post ? "" : search, {
      method: post ? "POST" : "GET",
      body: post ? params : undefined,
      cookies: this.jar,
    });
    for (const cookie of output.setCookies) {
      if (cookie.maxAgeSeconds === 0) delete this.jar[cookie.name];
      else this.jar[cookie.name] = cookie.value;
    }
    this.log.push({ params: search, body: output.body });
    return output.body;
  }

  get(params: Record<string, string>) {
    return this.request(params, false);
  }

  post(params: Record<string, string>) {
    return this.request(params, true);
  }

  /** The Pywikibot login sequence: login token, then action=login. */
  async login(name = "Heku@Bot", password = "bot-secret", extra: Record<string, string> = {}) {
    const tokens = (await this.get({ action: "query", meta: "tokens", type: "login", format: "json", ...extra })) as {
      query: { tokens: { logintoken: string } };
    };
    return this.post({
      action: "login",
      lgname: name,
      lgpassword: password,
      lgtoken: tokens.query.tokens.logintoken,
      format: "json",
      ...extra,
    });
  }
}

// ---------------------------------------------------------------------------
// An in-memory wiki behind ApiStore
// ---------------------------------------------------------------------------

export interface FakePage {
  pageId: number;
  title: string;
  namespace?: number;
  /** Canonical title of the redirect target. */
  redirect?: string;
  redirectFragment?: string;
  wikitext?: string;
  touched?: string;
  deleted?: boolean;
}

export interface FakeRevision {
  revId: number;
  page: string;
  timestamp: string;
  user?: string | null;
  comment?: string;
  minor?: boolean;
  content?: string;
  textHidden?: boolean;
  commentHidden?: boolean;
  userHidden?: boolean;
  sha1?: string;
}

export interface FakeLog {
  logId: number;
  type: string;
  action: string;
  title: string;
  actor: string;
  comment?: string;
  params?: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface FakeWikiData {
  /** page title -> the stored fresh HTML */
  html?: Record<string, string>;
  logs?: FakeLog[];
  users?: Array<{ name: string; userId: number; groups?: string[]; editCount?: number; registration?: string }>;
  blocks?: Array<{ target: string; reason?: string; expiresAt?: string | null; blockedBy?: string; createdAt: string }>;
  protectedTitles?: Array<{ id: string; title: string; level: string; timestamp: string; user?: string; comment?: string; expiresAt?: string | null }>;
  /** category name -> page title -> sort key */
  sortKeys?: Record<string, Record<string, string>>;
  pages?: FakePage[];
  revisions?: FakeRevision[];
  /** page title -> target titles it links to */
  links?: Record<string, string[]>;
  /** page title -> category names */
  categories?: Record<string, string[]>;
  restrictions?: Record<string, Array<{ action: string; level: string; expiresAt?: string | null }>>;
}

const byteLength = (text: string) => Buffer.byteLength(text, "utf8");

/** A MediaWiki-style (base 36, 31 digit) revision hash that differs per revision. */
export const fakeSha1 = (revId: number) => revId.toString(36).padStart(31, "0");
export const fakeSha1Hex = (revId: number) => BigInt(`0x${revId.toString(16)}`).toString(16).padStart(40, "0");

/** An `ApiStore` over plain arrays, with the same ordering and cursor rules as the Prisma store. */
export function fakeWiki(data: FakeWikiData, extra: Partial<ApiStore> = {}): ApiStore {
  const state = { get pages() { return (data.pages ?? []).filter((page) => !page.deleted); } };
  const revisions = (data.revisions ??= []);
  const articleId = (title: string) => `art:${title}`;
  const titleOfArticle = (id: string) => id.slice("art:".length);

  const revisionsOf = (title: string) =>
    revisions
      .filter((rev) => rev.page === title)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.revId - b.revId);

  const pageRow = (page: FakePage) => {
    const head = revisionsOf(page.title).at(-1);
    return {
      articleId: articleId(page.title),
      pageId: page.pageId,
      title: page.title,
      namespace: page.namespace ?? 0,
      isRedirect: page.redirect !== undefined,
      redirectTitle: page.redirect ?? null,
      redirectFragment: page.redirectFragment ?? null,
      touched: new Date(page.touched ?? head?.timestamp ?? "2026-01-01T00:00:00Z"),
      wordCount: 10,
      headRevId: head?.revId ?? null,
      headTimestamp: head ? new Date(head.timestamp) : null,
      length: head ? byteLength(head.content ?? "") : 0,
    };
  };

  const revisionRow = (rev: FakeRevision, withContent: boolean) => {
    const page = state.pages.find((p) => p.title === rev.page)!;
    const history = revisionsOf(rev.page);
    const index = history.findIndex((r) => r.revId === rev.revId);
    return {
      revId: rev.revId,
      ref: String(rev.revId),
      parentId: index > 0 ? history[index - 1]!.revId : 0,
      pageId: page.pageId,
      title: page.title,
      namespace: page.namespace ?? 0,
      timestamp: new Date(rev.timestamp),
      user: rev.user === undefined ? "Heku" : rev.user,
      userId: 7,
      comment: rev.comment ?? "",
      minor: rev.minor ?? false,
      size: byteLength(rev.content ?? ""),
      sizeDiff: byteLength(rev.content ?? "") - (index > 0 ? byteLength(history[index - 1]!.content ?? "") : 0),
      sha1: rev.sha1 ?? fakeSha1(rev.revId),
      content: rev.textHidden || !withContent ? null : (rev.content ?? ""),
      textHidden: rev.textHidden ?? false,
      commentHidden: rev.commentHidden ?? false,
      userHidden: rev.userHidden ?? false,
      isHead: history.at(-1)?.revId === rev.revId,
    };
  };

  const base: Partial<ApiStore> = {
    pagesByTitle: async (titles) => state.pages.filter((p) => titles.includes(p.title)).map(pageRow),
    pagesById: async (ids) => state.pages.filter((p) => ids.includes(p.pageId)).map(pageRow),
    revisionsById: async (ids, withContent) =>
      ids.flatMap((id) => {
        const rev = revisions.find((r) => r.revId === id);
        return rev && state.pages.some((p) => p.title === rev.page) ? [revisionRow(rev, withContent)] : [];
      }),
    findRevisions: async (query) => {
      const target = query.articleId ? titleOfArticle(query.articleId) : undefined;
      const newer = query.dir === "newer";
      const sign = newer ? 1 : -1;
      const key = (r: { timestamp: string; revId: number }) => [r.timestamp, r.revId] as const;
      const cmp = (a: readonly [string, number], b: readonly [string, number]) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1];
      const point = (bound: { timestamp: Date; revId?: number }) =>
        [bound.timestamp.toISOString(), bound.revId ?? (newer ? -Infinity : Infinity)] as const;
      const rows = revisions
        .filter((rev) => state.pages.some((p) => p.title === rev.page))
        .filter((rev) => (target ? rev.page === target : true))
        .filter((rev) => (query.namespaces ? query.namespaces.includes(state.pages.find((p) => p.title === rev.page)?.namespace ?? 0) : true))
        .filter((rev) => (query.users ? query.users.includes(rev.user ?? "Heku") : true))
        .filter((rev) => (query.excludeUser ? (rev.user ?? "Heku") !== query.excludeUser : true))
        .filter((rev) => (query.minor === undefined ? true : (rev.minor ?? false) === query.minor))
        .filter((rev) => {
          const k = [new Date(rev.timestamp).toISOString(), rev.revId] as const;
          const afterFrom = (b?: { timestamp: Date; revId?: number }) =>
            !b || sign * cmp(k, point(b)) >= 0;
          const beforeTo = (b?: { timestamp: Date; revId?: number }) =>
            !b || sign * cmp(k, point(b)) <= 0;
          return afterFrom(query.from) && afterFrom(query.cursor) && beforeTo(query.to);
        })
        .sort((a, b) => sign * cmp(key({ timestamp: new Date(a.timestamp).toISOString(), revId: a.revId }), key({ timestamp: new Date(b.timestamp).toISOString(), revId: b.revId })))
        .slice(0, query.limit + 1);
      return rows.map((rev) => revisionRow(rev, query.withContent));
    },
    restrictionsByTitle: async (titles) =>
      new Map(
        titles.flatMap((title) => {
          const list = data.restrictions?.[title];
          return list
            ? [[title, list.map((r) => ({ action: r.action, level: r.level, expiresAt: r.expiresAt ? new Date(r.expiresAt) : null }))] as const]
            : [];
        })
      ),
    linksFrom: async (query) => {
      const rows = query.articleIds
        .map((id) => titleOfArticle(id))
        .flatMap((source) => {
          const page = state.pages.find((p) => p.title === source);
          return page ? (data.links?.[source] ?? []).map((target) => ({ pageId: page.pageId, title: target, key: target.toLowerCase().replace(/ /g, "_") })) : [];
        })
        .filter((row) => !query.titles || query.titles.includes(row.title))
        .sort((a, b) => (query.dir === "ascending" ? 1 : -1) * (a.pageId - b.pageId || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)))
        .filter((row) => {
          const c = query.cursor;
          if (!c) return true;
          const order = a2(row.pageId, row.key, c.pageId, c.key);
          return query.dir === "ascending" ? order >= 0 : order <= 0;
        });
      const page = rows.slice(0, query.limit);
      const next = rows[query.limit];
      return {
        rows: page
          .map((row) => ({ pageId: row.pageId, title: row.title, namespace: row.title.includes(":") ? 10 : 0 }))
          .filter((row) => !query.namespaces || query.namespaces.includes(row.namespace)),
        next: next ? { pageId: next.pageId, key: next.key } : null,
      };
    },
    categoriesOf: async (query) => {
      if (query.hidden === true) return { rows: [], next: null };
      const rows = query.articleIds
        .map((id) => titleOfArticle(id))
        .flatMap((source) => {
          const page = state.pages.find((p) => p.title === source);
          return page ? (data.categories?.[source] ?? []).map((name) => ({ pageId: page.pageId, name })) : [];
        })
        .filter((row) => !query.titles || query.titles.includes(`Category:${row.name}`))
        .sort((a, b) => (query.dir === "ascending" ? 1 : -1) * (a.pageId - b.pageId || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
        .filter((row) => {
          const c = query.cursor;
          if (!c) return true;
          const order = a2(row.pageId, row.name, c.pageId, c.key);
          return query.dir === "ascending" ? order >= 0 : order <= 0;
        });
      const next = rows[query.limit];
      return {
        rows: rows.slice(0, query.limit).map((row) => ({
          pageId: row.pageId,
          title: `Category:${row.name}`,
          sortKey: null,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          hidden: false,
        })),
        next: next ? { pageId: next.pageId, key: next.name } : null,
      };
    },
    listPages: async (q) => {
      const asc = q.dir === "ascending";
      const [lower, upper] = asc ? [q.start, q.end] : [q.end, q.start];
      const rows = state.pages
        .filter((p) => (p.namespace ?? 0) === q.namespace)
        .filter((p) => !q.prefix || p.title.startsWith(q.prefix))
        .filter((p) => !lower || p.title >= lower)
        .filter((p) => !upper || p.title <= upper)
        .filter((p) => (q.filterRedirects === "redirects" ? p.redirect !== undefined : q.filterRedirects === "nonredirects" ? p.redirect === undefined : true))
        .sort((a, b) => (asc ? 1 : -1) * (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
        .slice(0, q.limit + 1);
      return rows.map((p) => ({ pageId: p.pageId, title: p.title, namespace: p.namespace ?? 0, isRedirect: p.redirect !== undefined }));
    },
    listCategoryMembers: async (q) => {
      const name = q.category.slice("Category:".length);
      const asc = q.dir === "ascending";
      const rows = state.pages
        .filter((p) => (data.categories?.[p.title] ?? []).includes(name))
        .filter((p) => !q.namespaces || q.namespaces.includes(p.namespace ?? 0))
        .filter((p) => {
          const ns = p.namespace ?? 0;
          const type = ns === 14 ? "subcat" : ns === 6 ? "file" : "page";
          return q.types.includes(type);
        })
        .map((p) => {
          const sortKey = data.sortKeys?.[name]?.[p.title] ?? null;
          const addedAt = new Date(`2026-02-0${(p.pageId % 9) + 1}T00:00:00Z`);
          return { pageId: p.pageId, title: p.title, namespace: p.namespace ?? 0, isRedirect: p.redirect !== undefined, sortKey, addedAt, sortValue: q.sort === "timestamp" ? addedAt.toISOString() : (sortKey ?? p.title).toUpperCase() };
        })
        .filter((row) => !q.cursor || (asc ? 1 : -1) * a2(0, `${row.sortValue}`, 0, q.cursor.sortValue) > 0 || (row.sortValue === q.cursor.sortValue && (asc ? row.pageId >= q.cursor.pageId : row.pageId <= q.cursor.pageId)))
        .sort((a, b) => (asc ? 1 : -1) * (a.sortValue < b.sortValue ? -1 : a.sortValue > b.sortValue ? 1 : a.pageId - b.pageId));
      return rows.slice(0, q.limit + 1);
    },
    listBacklinks: async (q) => {
      const rows = state.pages
        .filter((p) => (data.links?.[p.title] ?? []).includes(q.target))
        .filter((p) => !q.namespaces || q.namespaces.includes(p.namespace ?? 0))
        .filter((p) => (q.filterRedirects === "redirects" ? p.redirect !== undefined : q.filterRedirects === "nonredirects" ? p.redirect === undefined : true))
        .filter((p) => q.cursor === undefined || p.pageId >= q.cursor)
        .sort((a, b) => a.pageId - b.pageId);
      return rows.slice(0, q.limit + 1).map((p) => ({ pageId: p.pageId, title: p.title, namespace: p.namespace ?? 0, isRedirect: p.redirect !== undefined }));
    },
    randomPages: async (q) =>
      state.pages
        .filter((p) => q.namespaces.includes(p.namespace ?? 0))
        .filter((p) => (q.filterRedirects === "redirects" ? p.redirect !== undefined : q.filterRedirects === "nonredirects" ? p.redirect === undefined : true))
        .slice(0, q.limit)
        .map((p) => ({ pageId: p.pageId, title: p.title, namespace: p.namespace ?? 0, isRedirect: p.redirect !== undefined })),
    listCategories: async (q) => {
      const counts = new Map<string, number>();
      for (const names of Object.values(data.categories ?? {})) for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
      const asc = q.dir === "ascending";
      const [lower, upper] = asc ? [q.start, q.end] : [q.end, q.start];
      return [...counts.entries()]
        .filter(([n]) => !q.prefix || n.startsWith(q.prefix))
        .filter(([n]) => !lower || n >= lower)
        .filter(([n]) => !upper || n <= upper)
        .sort(([a], [b]) => (asc ? 1 : -1) * (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, q.limit + 1)
        .map(([name, members]) => ({ name, members }));
    },
    findLogs: async (q) => {
      const newer = q.dir === "newer";
      const sign = newer ? 1 : -1;
      const rows = (data.logs ?? [])
        .filter((l) => !q.type || l.type === q.type)
        .filter((l) => !q.action || l.action === q.action)
        .filter((l) => !q.title || l.title === q.title)
        .filter((l) => !q.user || l.actor === q.user)
        .filter((l) => !q.excludeUser || l.actor !== q.excludeUser)
        .filter((l) => {
          const t = new Date(l.timestamp).getTime();
          const key = [t, l.logId] as const;
          const ge = (b?: { t: number; id?: number }) => !b || sign * ((t - b.t) || (l.logId - (b.id ?? (newer ? -Infinity : Infinity)))) >= 0;
          const le = (b?: { t: number; id?: number }) => !b || sign * ((t - b.t) || (l.logId - (b.id ?? (newer ? Infinity : -Infinity)))) <= 0;
          void key;
          return ge(q.from ? { t: q.from.getTime() } : undefined) && ge(q.cursor ? { t: q.cursor.timestamp.getTime(), id: q.cursor.logId } : undefined) && le(q.to ? { t: q.to.getTime() } : undefined);
        })
        .sort((a, b) => sign * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || a.logId - b.logId))
        .slice(0, q.limit + 1);
      return rows.map((l) => ({
        logId: l.logId,
        type: l.type,
        action: l.action,
        title: l.title,
        namespace: l.title.includes(":") ? ({ User: 2, Template: 10 } as Record<string, number>)[l.title.split(":")[0]!] ?? 0 : 0,
        pageId: state.pages.find((p) => p.title === l.title)?.pageId ?? 0,
        actor: l.actor,
        comment: l.comment ?? null,
        params: l.params ?? null,
        timestamp: new Date(l.timestamp),
      }));
    },
    listUsers: async (q) => {
      const asc = q.dir === "ascending";
      const [lower, upper] = asc ? [q.start, q.end] : [q.end, q.start];
      return (data.users ?? [])
        .filter((u) => !q.prefix || u.name.startsWith(q.prefix))
        .filter((u) => !lower || u.name >= lower)
        .filter((u) => !upper || u.name <= upper)
        .filter((u) => !q.group || (u.groups ?? []).includes(q.group))
        .filter((u) => !q.excludeGroup || !(u.groups ?? []).includes(q.excludeGroup))
        .sort((a, b) => (asc ? 1 : -1) * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, q.limit + 1)
        .map((u) => ({ name: u.name, userId: u.userId, registration: u.registration ? new Date(u.registration) : null, editCount: u.editCount ?? 0, groups: u.groups ?? [] }));
    },
    listBlocks: async (limit, cursor) => {
      const all = data.blocks ?? [];
      // A real cursor is a row id (letters and digits, 8 or more characters).
      const start = cursor ? Number(cursor.replace("block-id-", "")) : 0;
      const slice = all.slice(start, start + limit);
      return {
        blocks: slice.map((b) => ({ target: b.target, reason: b.reason ?? null, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null, allowUserTalk: true, blockedBy: b.blockedBy ?? null, createdAt: new Date(b.createdAt) })),
        nextCursor: start + limit < all.length ? `block-id-${start + limit}` : null,
      };
    },
    listProtectedTitles: async (q) => {
      const newer = q.dir === "newer";
      const sign = newer ? 1 : -1;
      return (data.protectedTitles ?? [])
        .filter((r) => !q.level || r.level === q.level)
        .filter((r) => !q.cursor || sign * ((new Date(r.timestamp).getTime() - q.cursor.timestamp.getTime()) || (r.id < q.cursor.id ? -1 : r.id > q.cursor.id ? 1 : 0)) >= 0)
        .sort((a, b) => sign * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || (a.id < b.id ? -1 : 1)))
        .slice(0, q.limit + 1)
        .map((r) => ({ id: r.id, title: r.title, namespace: 0, level: r.level, timestamp: new Date(r.timestamp), user: r.user ?? null, comment: r.comment ?? null, expiresAt: r.expiresAt ? new Date(r.expiresAt) : null }));
    },
    revisionByRowId: async (rowId) => {
      const rev = revisions.find((r) => `row-${r.revId}` === rowId);
      return rev ? revisionRow(rev, false) : null;
    },
    revisionCountOf: async (title) => revisions.filter((r) => r.page === title).length,
    pageHtml: async (id) => {
      const page = (data.pages ?? []).find((p) => `art:${p.title}` === id);
      return page ? { html: data.html?.[page.title] ?? null, fresh: data.html?.[page.title] !== undefined } : null;
    },
    wikitextByArticle: async (ids) =>
      new Map(
        ids.map((id) => {
          const title = titleOfArticle(id);
          const page = state.pages.find((p) => p.title === title);
          return [id, page?.wikitext ?? revisionsOf(title).at(-1)?.content ?? ""] as const;
        })
      ),
  };
  return fakeStore({ ...base, ...extra });
}

function a2(pageA: number, keyA: string, pageB: number, keyB: string): number {
  return pageA - pageB || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0);
}


// ---------------------------------------------------------------------------
// Fake services for the writing actions
// ---------------------------------------------------------------------------

export interface ServiceCall {
  name: string;
  args: unknown[];
}

/** `ApiServices` that record what they were asked and apply saves to the fake wiki's data. */
export function fakeServices(data: FakeWikiData, overrides: Partial<ApiServices> = {}) {
  const calls: ServiceCall[] = [];
  const record =
    <A extends unknown[], R>(name: string, fn: (...args: A) => R) =>
    (...args: A): R => {
      calls.push({ name, args });
      return fn(...args);
    };
  let nextRevId = 9000;
  const services: ApiServices = {
    renderWikitext: record("renderWikitext", async (wikitext: string, title: string) => `<p>rendered(${title}): ${wikitext}</p>`),
    ensureRendered: record("ensureRendered", async (articleId: string) => {
      // The render service stores the rendering: the page then has a fresh HTML.
      const title = articleId.slice("art:".length);
      const page = (data.pages ?? []).find((p) => p.title === title);
      (data.html ??= {})[title] = `<p>rendered(${title}): ${page?.wikitext ?? ""}</p>`;
    }),
    purgePage: record("purgePage", async () => undefined),
    diff: record("diff", (a: string, b: string) => `<tr><td>${a}</td><td>${b}</td></tr>`),
    assertCanEdit: record("assertCanEdit", async () => undefined),
    authorize: record("authorize", async () => undefined),
    requireRight: record("requireRight", async () => undefined),
    authorizeMove: record("authorizeMove", async () => undefined),
    authorizeProtection: record("authorizeProtection", async () => undefined),
    requireRestorableWikitext: record("requireRestorableWikitext", async (_ctx, _title, revision) => revision.wikitext ?? ""),
    detectEditConflict: record("detectEditConflict", async (title: string, baseRef: string | undefined) => {
      const head = (data.revisions ?? []).filter((r) => r.page === title).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.revId - b.revId).at(-1);
      return head && baseRef === String(head.revId) ? null : { currentWikitext: head?.content ?? "", currentRevisionRef: head ? String(head.revId) : null };
    }),
    saveWikitext: record("saveWikitext", async (_ctx, save) => {
      const pages = (data.pages ??= []);
      if (!pages.some((p) => p.title === save.title)) {
        pages.push({ pageId: Math.max(0, ...pages.map((p) => p.pageId)) + 1, title: save.title, namespace: 0 });
      }
      const revId = nextRevId++;
      (data.revisions ??= []).push({ revId, page: save.title, timestamp: "2026-09-30T12:00:00Z", user: "Heku", comment: save.summary, minor: save.minor, content: save.wikitext });
      return { revisionRowId: `row-${revId}` };
    }),
    movePage: record("movePage", async (from: string, to: string) => ({
      success: true, oldTitle: from, newTitle: to, oldSlug: "", newSlug: "", redirectArticleId: "redirect-1", movedArticleId: "a", linksUpdated: 0, talk: null,
    })),
    archivePage: record("archivePage", async () => undefined),
    restorePage: record("restorePage", async () => undefined),
    protectPage: record("protectPage", async () => undefined),
    ...overrides,
  };
  return { services, calls };
}

/** Deps over a fake wiki, with a logged-in bot's grants, recording every service call. */
export async function makeWikiDeps(data: FakeWikiData, options: { services?: Partial<ApiServices>; grants?: string[]; groups?: Group[]; extra?: Partial<ApiDeps> } = {}) {
  const { services, calls } = fakeServices(data, options.services);
  const deps = await makeDeps({
    store: fakeWiki(data),
    services,
    auth: await fakeAuthStore("bot-secret", options.grants ?? ["basic", "editpage", "createeditmovepage", "delete", "protect", "rollback"]),
    loadPermissions: fakeLoader(options.groups ?? ["*", "user", "sysop"]),
    ...options.extra,
  });
  const bot = new Bot(deps);
  return { deps, calls, bot, data };
}

/** Log a bot in and fetch the token a write of `type` needs. */
export async function loggedIn(bot: Bot, type = "csrf"): Promise<string> {
  const login = (await bot.login()) as { login?: { result: string } };
  if (login.login?.result !== "Success") throw new Error(`login failed: ${JSON.stringify(login)}`);
  const tokens = (await bot.get({ action: "query", meta: "tokens", type, formatversion: "2" })) as { query: { tokens: Record<string, string> } };
  return tokens.query.tokens[`${type}token`]!;
}
