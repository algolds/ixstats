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
  ctx: { auth: { userId: "user_clerk_heku" }, user: { id: "u-heku", clerkUserId: "user_clerk_heku" } },
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
