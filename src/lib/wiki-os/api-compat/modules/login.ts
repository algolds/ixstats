/**
 * login.ts — `action=login` and `action=logout` (plan 410).
 *
 * Only bot passwords log in: `lgname` is `<wiki username>@<AppId>`. The login token is an HMAC of a
 * nonce the caller keeps in a short-lived cookie, so a login form on another site cannot log a
 * browser in as someone else. A wrong password is `Failed` with a `reason`, as in MediaWiki.
 */

import {
  clearedSessionCookie,
  isLoginNonce,
  loginNonceCookie,
  loginToken,
  loginWithBotPassword,
  logoutSession,
  newLoginNonce,
  tokenIsValid,
} from "../auth";
import { ApiError, missingParam } from "../errors";
import type { JsonObject } from "../format";
import type { ApiContext } from "../types";

/** Failed logins one client may try (name included) in `LOGIN_WINDOW_MS`. */
const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

/** The caller's login token, issuing the nonce cookie on first use. */
export function loginTokenFor(rc: ApiContext): string {
  if (!isLoginNonce(rc.loginNonce)) {
    rc.loginNonce = newLoginNonce();
    rc.setCookies.push(loginNonceCookie(rc.loginNonce, rc.cookiePath));
  }
  return loginToken(rc.loginNonce);
}

export async function runLogin(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("lg", "login");
  const name = p.required("name");
  const password = p.required("password");
  const given = p.string("token");

  const hadNonce = isLoginNonce(rc.loginNonce);
  const expected = loginTokenFor(rc);
  if (!given || !hadNonce) {
    if (!given) p.addWarning("Fetching a token via action=login is deprecated. Use action=query&meta=tokens&type=login instead.");
    return { login: { result: "NeedToken", token: expected } };
  }
  if (given !== expected) return { login: { result: "WrongToken" } };

  const throttle = await rc.deps.rateLimit(`${rc.clientKey}|${name.toLowerCase()}`, "wiki_api_login", {
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
