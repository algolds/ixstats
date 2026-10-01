/**
 * dispatch.ts — one api.php request, from parameters to response body (plan 410).
 *
 * The route handler (`src/app/w/api.php/route.ts`) only reads the HTTP request and writes the
 * response; everything between lives here: the format version, who is calling, rate limits,
 * `assert`, the action table and turning any failure into MediaWiki's error envelope (always HTTP 200).
 */

import { resolveSession } from "./auth";
import { toApiError } from "./error-map";
import {
  ApiError,
  badValue,
  badValues,
  missingParam,
  mustBePosted,
} from "./errors";
import {
  ERROR_FORMATS,
  ResponseBuilder,
  errorBody,
  type ErrorFormat,
  type FormatVersion,
  type JsonValue,
} from "./format";
import { parseRequestParams, type ApiParams } from "./params";
import { runCompare } from "./modules/compare";
import { runEdit } from "./modules/edit";
import { runLogin, runLogout } from "./modules/login";
import { runOpenSearch } from "./modules/opensearch";
import { runDelete, runMove, runProtect, runRollback, runUndelete } from "./modules/page-ops";
import { runParse } from "./modules/parse";
import { runQuery } from "./modules/query";
import type { ApiContext, ApiDeps, ApiResult, ApiSession, CookieSpec } from "./types";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

export interface ApiRequestInput {
  method: "GET" | "POST";
  query: URLSearchParams;
  /** The form body of a POST (`application/x-www-form-urlencoded` or `multipart/form-data` text fields). */
  body: Iterable<readonly [string, string]> | null;
  sessionCookie: string | undefined;
  loginNonceCookie: string | undefined;
  /** The Clerk id of a signed-in browser user, if any. */
  webAuthId: string | null;
  /** The caller's rate-limit identity (`user:`/`ip:` from `resolveRateLimitIdentifier`) and name. */
  clientKey: string;
  anonymousName: string;
  cookiePath: string;
}

export interface ApiResponseOutput {
  /** The JSON body, already in the requested format version's shape. */
  body: JsonValue;
  setCookies: CookieSpec[];
  /** The error code, for the `MediaWiki-API-Error` header; null on success. */
  errorCode: string | null;
}

type ActionHandler = (rc: ApiContext) => Promise<ApiResult>;

interface ActionSpec {
  run: ActionHandler;
  /** The module changes state, so it needs POST. */
  post: boolean;
}

const ACTIONS: Readonly<Record<string, ActionSpec>> = {
  query: { run: runQuery, post: false },
  parse: { run: runParse, post: false },
  opensearch: { run: runOpenSearch, post: false },
  compare: { run: runCompare, post: false },
  login: { run: runLogin, post: true },
  logout: { run: runLogout, post: true },
  edit: { run: runEdit, post: true },
  move: { run: runMove, post: true },
  delete: { run: runDelete, post: true },
  undelete: { run: runUndelete, post: true },
  protect: { run: runProtect, post: true },
  rollback: { run: runRollback, post: true },
};

/** Requests per minute: anonymous, signed in, and for writes (a bot with `noratelimit` is not counted). */
const READ_LIMIT = { anonymous: 120, signedIn: 600 } as const;
const WRITE_LIMIT = 120;
const WINDOW_MS = 60_000;

const FORMATS = ["json", "jsonfm"] as const;

function formatVersionOf(params: ApiParams): FormatVersion {
  const raw = params.string("formatversion", "1");
  if (raw === "1") return 1;
  if (raw === "2" || raw === "latest") return 2;
  throw badValue("formatversion", raw);
}

function assertSession(params: ApiParams, session: ApiSession): void {
  const kind = params.oneOf("assert", ["anon", "user", "bot"]);
  if (kind === "anon" && session.kind !== "anonymous") {
    throw new ApiError("assertanonfailed", "Assertion that the user is logged out failed.");
  }
  if (kind === "user" && session.kind === "anonymous") {
    throw new ApiError("assertuserfailed", "Assertion that the user is logged in failed.");
  }
  if (kind === "bot" && !session.permissions.rights.has("bot")) {
    throw new ApiError("assertbotfailed", 'Assertion that the user has the "bot" right failed.');
  }
  const named = params.string("assertuser");
  if (named !== undefined && normalizeWikiUsername(named) !== session.name) {
    throw new ApiError("assertnameduserfailed", `Assertion that the user is "${named}" failed.`);
  }
}

async function enforceRateLimit(rc: ApiContext, spec: ActionSpec): Promise<void> {
  if (rc.session.permissions.rights.has("noratelimit")) return;
  const signedIn = rc.session.kind !== "anonymous";
  const read = await rc.deps.rateLimit(rc.clientKey, "wiki_api", {
    maxRequests: signedIn ? READ_LIMIT.signedIn : READ_LIMIT.anonymous,
    windowMs: WINDOW_MS,
  });
  const write = spec.post
    ? await rc.deps.rateLimit(rc.clientKey, "wiki_api_write", {
        maxRequests: WRITE_LIMIT,
        windowMs: WINDOW_MS,
      })
    : read;
  if (!read.success || !write.success) {
    throw new ApiError(
      "ratelimited",
      "You've exceeded your rate limit. Please wait some time and try again."
    );
  }
}

function actionOf(params: ApiParams): [string, ActionSpec] {
  const name = params.string("action");
  if (name === undefined) throw missingParam("action");
  const spec = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
  if (!spec) throw badValue("action", name);
  return [name, spec];
}

/** Run one request. Never throws: every failure is an error body. */
export async function handleApiRequest(
  input: ApiRequestInput,
  deps: ApiDeps
): Promise<ApiResponseOutput> {
  const response = new ResponseBuilder();
  const params = parseRequestParams(input.query, input.body, response.addWarning);
  const setCookies: CookieSpec[] = [];
  let version: FormatVersion = 1;
  let errorFormat: ErrorFormat = "bc";

  try {
    version = formatVersionOf(params);
    errorFormat = params.oneOf("errorformat", ERROR_FORMATS, "bc");
    params.oneOf("format", FORMATS, "json");
    if (params.has("callback")) throw badValues("callback", ["JSONP is not supported"]);
    const [actionName, spec] = actionOf(params);
    if (spec.post && input.method !== "POST") throw mustBePosted(actionName);

    const now = deps.now();
    const session = await resolveSession(
      {
        sessionCookie: input.sessionCookie,
        webAuthId: input.webAuthId,
        anonymousName: input.anonymousName,
      },
      deps.auth,
      deps.loadPermissions,
      now
    );
    const rc: ApiContext = {
      params,
      version,
      method: input.method,
      session,
      deps,
      now,
      loginNonce: input.loginNonceCookie,
      cookiePath: input.cookiePath,
      // A signed-in caller is limited by account, an anonymous one by address.
      clientKey: session.ctx.user?.id ? `user:${session.ctx.user.id}` : input.clientKey,
      setCookies,
      highLimits: session.permissions.rights.has("apihighlimits"),
    };
    assertSession(params, session);
    await enforceRateLimit(rc, spec);
    const result = await spec.run(rc);
    return { body: response.finish(result, version), setCookies, errorCode: null };
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const apiError = toApiError(error) ?? internalError(error);
    return {
      body: response.finish(errorBody(apiError, version, errorFormat), version),
      setCookies,
      errorCode: apiError.code,
    };
  }
}

function internalError(error: Error): ApiError {
  console.error("[api.php] unexpected failure:", error);
  return new ApiError("internal_api_error", "Exception caught while handling the request.");
}
