/**
 * login.ts — `action=login` and `action=logout` (plan 410).
 *
 * Only bot passwords log in: `lgname` is `<wiki username>@<AppId>`. The login token is an HMAC of a
 * nonce the caller keeps in a short-lived cookie, so a login form on another site cannot log a
 * browser in as someone else. A wrong password is `Failed` with a `reason`, as in MediaWiki.
 */

import { createHash } from "node:crypto";
import {
  clearedSessionCookie,
  loginNonceCookie,
  loginToken,
  loginWithBotPassword,
  logoutSession,
  newLoginNonce,
  readLoginNonce,
  safeEqual,
  tokenIsValid,
} from "../auth";
import { ApiError, missingParam } from "../errors";
import type { JsonObject } from "../format";
import type { ApiContext } from "../types";

/** Failed logins one client may try (name included) in `LOGIN_WINDOW_MS`. */
const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

/** MediaWiki's longest user name; a bot password's password is 32 characters, so 1024 is generous. */
const MAX_LOGIN_NAME_CHARS = 255;
const MAX_LOGIN_PASSWORD_CHARS = 1024;

const WRONG_CREDENTIALS = {
  login: { result: "Failed", reason: "Incorrect username or password entered. Please try again." },
} as const;

/** The caller's login token, issuing a fresh nonce cookie when they hold none (or an expired or forged one). */
export function loginTokenFor(rc: ApiContext): string {
  const nonce = readLoginNonce(rc.loginNonce, rc.now) ?? issueNonce(rc);
  return loginToken(nonce);
}

function issueNonce(rc: ApiContext): string {
  const nonce = newLoginNonce(rc.now);
  rc.loginNonce = nonce;
  rc.setCookies.push(loginNonceCookie(nonce, rc.cookiePath));
  return nonce;
}

/** The throttle key of a login: the client and a hash of the name, so a name of any length is a fixed-size key. */
const throttleKey = (rc: ApiContext, name: string) =>
  `${rc.clientKey}|${createHash("sha256").update(name.toLowerCase()).digest("hex")}`;

export async function runLogin(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("lg", "login");
  const name = p.required("name");
  const password = p.required("password");
  // Before anything is hashed, stored or compared: nobody has a name or a password this long.
  if (name.length > MAX_LOGIN_NAME_CHARS || password.length > MAX_LOGIN_PASSWORD_CHARS) return WRONG_CREDENTIALS;
  const given = p.string("token");

  const hadNonce = readLoginNonce(rc.loginNonce, rc.now) !== null;
  const expected = loginTokenFor(rc);
  if (!given || !hadNonce) {
    if (!given) p.addWarning("Fetching a token via action=login is deprecated. Use action=query&meta=tokens&type=login instead.");
    return { login: { result: "NeedToken", token: expected } };
  }
  if (!safeEqual(expected, given)) return { login: { result: "WrongToken" } };

  const throttle = await rc.deps.rateLimit(throttleKey(rc, name), "wiki_api_login", {
    maxRequests: LOGIN_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });
  if (!throttle.success) {
    const wait = Math.max(1, Math.ceil((throttle.resetAt.getTime() - rc.now.getTime()) / 1000));
    return { login: { result: "Throttled", wait } };
  }

  const outcome = await loginWithBotPassword(
    rc.deps.auth,
    { name, password, now: rc.now },
    rc.cookiePath
  );
  if (outcome.result === "Failed") return { login: { result: "Failed", reason: outcome.reason } };

  rc.setCookies.push(outcome.cookie);
  return {
    login: { result: "Success", lguserid: outcome.userId, lgusername: outcome.username },
  };
}

/** `action=logout`: ends the caller's session. A bot session needs its token, so a page cannot log a bot out. */
export async function runLogout(rc: ApiContext): Promise<JsonObject> {
  const { session } = rc;
  if (session.kind === "bot") {
    const token = rc.params.string("token");
    if (token === undefined) throw missingParam("token");
    if (!tokenIsValid(session, "csrf", token)) {
      throw new ApiError("badtoken", "Invalid CSRF token.");
    }
    await logoutSession(rc.deps.auth, session.sessionId);
  }
  rc.setCookies.push(clearedSessionCookie(rc.cookiePath));
  return {};
}
