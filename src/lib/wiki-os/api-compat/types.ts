/**
 * types.ts — the shapes the api.php modules share (plan 410).
 *
 * Every module is a function of `(request context, deps)`; `deps` is the data store and the
 * existing WikiOS services it may call, so a test hands a module fakes. `session` is who is asking.
 */

import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import type { Right, WikiPermissions } from "~/lib/wiki-os/rights";
import type { FormatVersion } from "./format";
import type { ApiParams } from "./params";
import type { ApiStore } from "./store-types";

/** A WikiOS user as the api.php endpoint sees them: the context the permission services read, and the wiki name. */
export interface SessionUser {
  ctx: WikiAuthContext;
  /** The verified wiki username. */
  name: string;
  /** The user's MediaWiki user id when known (`WikiAccountLink.wikiUserId`), else 0. */
  mwUserId: number;
}

export interface BotPasswordRecord {
  id: string;
  userId: string;
  appId: string;
  passwordHash: string;
  grants: string[];
}

export interface ApiSessionRecord {
  id: string;
  botPasswordId: string;
  userId: string;
  expiresAt: Date;
  grants: string[];
}

/** The tables behind bot-password logins (`WikiBotPassword`, `WikiApiSession`) and the user they name. */
export interface AuthStore {
  /** The bot password `appId` of the user whose verified wiki account is `wikiUsername`, and that user. */
  findBotPassword(
    wikiUsername: string,
    appId: string
  ): Promise<{ botPassword: BotPasswordRecord; user: SessionUser } | null>;
  touchBotPassword(id: string, usedAt: Date): Promise<void>;
  createSession(input: {
    id: string;
    botPasswordId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void>;
  findSession(id: string): Promise<{ session: ApiSessionRecord; user: SessionUser } | null>;
  extendSession(id: string, expiresAt: Date): Promise<void>;
  deleteSession(id: string): Promise<void>;
  /** The signed-in browser user (Clerk id) with a verified wiki link, or null. */
  findWebUser(authId: string): Promise<SessionUser | null>;
}

export type SessionKind = "anonymous" | "web" | "bot";

/** Who is asking. Only a bot-password session may write. */
export interface ApiSession {
  kind: SessionKind;
  /** The wiki username; for an anonymous caller, their address or "anonymous". */
  name: string;
  /** The MediaWiki user id (0 for anonymous callers and users without one). */
  userId: number;
  ctx: WikiAuthContext;
  /** Rights are already capped by the bot password's grants. */
  permissions: WikiPermissions;
  sessionId: string | null;
  grants: readonly string[] | null;
}

export interface CookieSpec {
  name: string;
  value: string;
  path: string;
  /** null = a session cookie; 0 deletes it. */
  maxAgeSeconds: number | null;
}

/** How a caller's rights are loaded; a bot session's are capped at its grants' rights. */
export type PermissionLoader = (
  ctx: WikiAuthContext,
  ceiling: ReadonlySet<Right> | null
) => Promise<WikiPermissions>;

export interface RateLimitResult {
  success: boolean;
  resetAt: Date;
}

/** `check(identity, bucket, limits)`: counts one request against `identity`'s window of `bucket`. */
export type RateLimitCheck = (
  identity: string,
  bucket: string,
  limits: { maxRequests: number; windowMs: number }
) => Promise<RateLimitResult>;

export interface SearchHit {
  title: string;
  /** Plain text (never markup). */
  snippet: string;
}

/** `list=search`: `what` is the text or only the titles; one page of hits starting at `offset`, and how many matched. */
export type SearchFn = (
  query: string,
  what: "text" | "title",
  limit: number,
  offset: number
) => Promise<{ hits: SearchHit[]; total: number }>;

/** What a module needs from the outside world: the data store, the existing services, the clock. */
export interface ApiDeps {
  auth: AuthStore;
  loadPermissions: PermissionLoader;
  rateLimit: RateLimitCheck;
  store: ApiStore;
  search: SearchFn;
  /** The public origin, without a trailing slash: `https://ixwiki.com`. */
  siteUrl: string;
  now: () => Date;
}

/** One request, as every module sees it. */
export interface ApiContext {
  params: ApiParams;
  version: FormatVersion;
  method: "GET" | "POST";
  session: ApiSession;
  deps: ApiDeps;
  now: Date;
  /** The one-time login nonce the caller's cookie jar holds, if any. */
  loginNonce: string | undefined;
  /** The path api.php's cookies are scoped to (`/w/`). */
  cookiePath: string;
  /** The caller's rate-limit identity. */
  clientKey: string;
  /** Cookies the response must set; modules push onto it. */
  setCookies: CookieSpec[];
  /** Whether the caller holds `apihighlimits`. */
  highLimits: boolean;
}
