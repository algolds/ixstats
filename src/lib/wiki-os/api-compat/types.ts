/**
 * types.ts — the shapes the api.php modules share (plan 410).
 *
 * Every module is a function of `(request context, deps)`; `deps` is the data store and the
 * existing WikiOS services it may call, so a test hands a module fakes. `session` is who is asking.
 */

import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import type { Right, WikiPermissions } from "~/lib/wiki-os/rights";
import type { EditConflict } from "~/lib/wiki-os/core/edit-conflict";
import type { MovePageOptions, MovePageResult, PageActor } from "~/lib/wiki-os/core/page-management-service";
import type { RestrictionChange } from "~/lib/wiki-os/core/rights-admin-service";
import type { WikiAction } from "~/lib/wiki-os/permissions";
import type { WikitextSave } from "~/lib/wiki-os/services/edit-service";
import type { WikitextDiff } from "~/lib/wiki-os/transformers/wikitext-diff";
import type { SizeBudget } from "./budget";
import type { FormatVersion, JsonValue } from "./format";
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
  /** After a login: delete every expired session, and all but the `keep` newest of this bot password's. */
  pruneSessions(botPasswordId: string, now: Date, keep: number): Promise<void>;
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

/** A render of some text: the HTML, and the titles it transcludes (`Template:Foo`) and the file names it uses. */
export interface RenderedText {
  html: string;
  templates: string[] | null;
  images: string[] | null;
}

/**
 * The existing WikiOS services api.php writes through. Permission checks, saves, moves, deletions and
 * protections are never re-implemented here: each is the function the tRPC routers call.
 */
export interface ApiServices {
  /**
   * MediaWiki's render of wikitext, without storing anything (`action=parse&text=`): its HTML and
   * what it reported the text transcludes and uses (null when the answer did not carry them). Null
   * when the private renderer is unreachable or answers nothing. There is no fallback to the
   * in-process compiler: api.php answers `renderunavailable` instead, because that compiler is not
   * linear on the text a caller chooses.
   */
  renderWikitext(wikitext: string, title: string): Promise<RenderedText | null>;
  /** `action=purge`: mark the page's rendering stale, forget its caches and queue a render. */
  purgePage(article: { id: string; title: string }): Promise<void>;
  /** Make sure the page's stored rendering is fresh: the render service's single-flight, capped render (waits a few seconds at most). */
  ensureRendered(articleId: string): Promise<void>;
  /** The server diff (`diffWikitext`, plan 413): hunks of `context` unchanged lines around each change; throws `DiffTooLargeError` for a text over 2 MB. */
  diff(oldText: string, newText: string, options: { context: number }): WikitextDiff;
  /** May the caller edit (or create) `title`? Throws the permission refusals. */
  assertCanEdit(ctx: WikiAuthContext, title: string): Promise<void>;
  authorize(ctx: WikiAuthContext, action: WikiAction, title: string): Promise<void>;
  requireRight(ctx: WikiAuthContext, right: Right): Promise<void>;
  authorizeMove(
    ctx: WikiAuthContext,
    from: string,
    to: string,
    options: { moveTalk: boolean; leaveRedirect: boolean }
  ): Promise<void>;
  authorizeProtection(
    ctx: WikiAuthContext,
    title: string,
    levels: ReadonlyArray<"autoconfirmed" | "sysop" | null>
  ): Promise<void>;
  /** The text a rollback may save from `revision` (refuses a parked revision, a placeholder, another page's revision, a blanking). */
  requireRestorableWikitext(
    ctx: WikiAuthContext,
    title: string,
    revision: { wikitext: string | null; title: string; parked: boolean }
  ): Promise<string>;
  /** `detectEditConflict`: has the page moved on from the revision `baseRef` names? */
  detectEditConflict(title: string, baseRef: string | undefined): Promise<EditConflict | null>;
  /** Save a revision (PostgreSQL, then the MediaWiki mirror and the cache purge); answers the new revision's row id. */
  saveWikitext(ctx: WikiAuthContext, save: WikitextSave): Promise<{ revisionRowId: string }>;
  movePage(
    from: string,
    to: string,
    reason: string,
    actor: PageActor,
    options: MovePageOptions
  ): Promise<MovePageResult>;
  archivePage(title: string, reason: string, actor: PageActor): Promise<void>;
  restorePage(title: string, reason: string, actor: PageActor): Promise<void>;
  protectPage(params: {
    title: string;
    changes: readonly RestrictionChange[];
    reason: string;
    actor: PageActor;
  }): Promise<void>;
}

/** What a module needs from the outside world: the data store, the existing services, the clock. */
export interface ApiDeps {
  auth: AuthStore;
  loadPermissions: PermissionLoader;
  rateLimit: RateLimitCheck;
  store: ApiStore;
  services: ApiServices;
  search: SearchFn;
  /** The public origin, without a trailing slash: `https://ixwiki.com`. */
  siteUrl: string;
  now: () => Date;
}

/** What an action answers with: an object, or (`opensearch`) a bare array. */
export type ApiResult = { [key: string]: JsonValue } | JsonValue[];

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
  /** How much page content this response may still hold. */
  budget: SizeBudget;
}
