/**
 * auth.ts — who is calling api.php, and the proof they may write (plan 410).
 *
 * Bots log in with a bot password (`action=login`, `lgname = User@AppId`): the password is checked
 * against its scrypt hash and a session cookie `wikios_api_session` = `<sessionId>.<HMAC>` follows.
 * Every write also needs the session's CSRF token (`meta=tokens`), which is an HMAC of the session id
 * and ends in `+\` like MediaWiki's. A browser user signed in through Clerk may read but never write;
 * an anonymous caller may only read. Effective rights = the user's rights ∩ the bot password's grants.
 */

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import { sessionSecretMissing } from "./errors";
import { rightsForGrants } from "./grants";
import type {
  ApiSession,
  AuthStore,
  CookieSpec,
  PermissionLoader,
  SessionUser,
} from "./types";
import type { WikiPermissions } from "~/lib/wiki-os/rights";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";

export const SESSION_COOKIE = "wikios_api_session";
export const LOGIN_NONCE_COOKIE = "wikios_api_login";
/** MediaWiki tokens end in `+\`; an anonymous caller's whole token is this suffix. */
export const TOKEN_SUFFIX = "+\\";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** A session is extended (24 h sliding) once less than this much of its life is left, to spare writes. */
const SESSION_REFRESH_BELOW_MS = 23 * 60 * 60 * 1000;
/** A login token is good for ten minutes after the nonce cookie that backs it was issued. */
const LOGIN_NONCE_TTL_MS = 10 * 60 * 1000;
/** A nonce stamped later than this beyond now is not one this server made. */
const LOGIN_NONCE_SKEW_MS = 60 * 1000;
/** Sessions one bot password keeps: logging in again beyond this ends the oldest. */
export const MAX_SESSIONS_PER_BOT_PASSWORD = 20;

export const APP_ID_PATTERN = /^[a-zA-Z0-9_ -]{1,32}$/;
export type TokenType = "csrf" | "login" | "watch" | "rollback" | "patrol";
export const TOKEN_TYPES: readonly TokenType[] = ["csrf", "login", "watch", "rollback", "patrol"];

// ---------------------------------------------------------------------------
// Secret and HMACs
// ---------------------------------------------------------------------------

/** `src/env.ts` enforces this when the secret is set; checked again here, as the validation can be skipped. */
const MIN_SECRET_LENGTH = 32;
let warnedAboutMissingSecret = false;

/**
 * The key sessions, login nonces and tokens are signed with. There is no fallback, in development
 * either: without a key (or with one under 32 characters) nothing is signed and nothing is verified,
 * the caller gets the `sessionsecretmissing` error, and one warning is logged at the first use.
 * Requests that need no signature (anonymous reads) never get here.
 */
function signingSecret(): string {
  const configured = env.WIKIOS_API_SESSION_SECRET;
  if (configured && configured.length >= MIN_SECRET_LENGTH) return configured;
  if (!warnedAboutMissingSecret) {
    warnedAboutMissingSecret = true;
    console.warn(
      "[api.php] WIKIOS_API_SESSION_SECRET is not set (or is shorter than 32 characters): logins, login tokens and " +
        "session cookies are refused with sessionsecretmissing until it is; anonymous reads keep working."
    );
  }
  throw sessionSecretMissing();
}

function hmac(label: string, value: string): Buffer {
  return createHmac("sha256", signingSecret()).update(`${label}:${value}`).digest();
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// Bot passwords
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

/** 32 random base32 characters (160 bits). */
export function generateBotPassword(): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

function scryptKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key)
    );
  });
}

/** `scrypt$<salt b64>$<hash b64>`. */
export async function hashBotPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const key = await scryptKey(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Whether `password` matches a stored `scrypt$...` hash; a malformed hash never matches. */
export async function verifyBotPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptKey(password, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummyHash: Promise<string> | null = null;

/** Checking a password against nothing takes as long as checking it against a real hash (no user enumeration by timing). */
function burnPasswordCheck(password: string): Promise<boolean> {
  dummyHash ??= hashBotPassword(randomBytes(16).toString("hex"));
  return dummyHash.then((hash) => verifyBotPassword(password, hash));
}

// ---------------------------------------------------------------------------
// Cookies and tokens
// ---------------------------------------------------------------------------

export function signSessionId(sessionId: string): string {
  return `${sessionId}.${hmac("session", sessionId).toString("base64url")}`;
}

/** The session id in a `wikios_api_session` cookie value, or null when the signature is wrong. */
export function readSessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  return safeEqual(value, signSessionId(sessionId)) ? sessionId : null;
}

/** A token of `type` for the session: an HMAC of its id, in MediaWiki's shape (32 hex digits and `+\`). */
export function sessionToken(sessionId: string, type: TokenType): string {
  return `${hmac(`token:${type}`, sessionId).toString("hex").slice(0, 32)}${TOKEN_SUFFIX}`;
}

/** The login token for a login nonce (kept in a short-lived cookie). */
export function loginToken(nonce: string): string {
  return sessionToken(nonce, "login");
}

/**
 * A login nonce: when it was issued, a random part and a signature over both, so the server can tell
 * its own nonces apart and expire them without storing anything.
 */
export function newLoginNonce(now: Date): string {
  const body = `${Math.floor(now.getTime() / 1000).toString(36)}.${randomBytes(16).toString("hex")}`;
  return `${body}.${hmac("login-nonce", body).toString("base64url")}`;
}

/** The nonce in a cookie value when this server signed it and it is under ten minutes old; otherwise null. */
export function readLoginNonce(value: string | undefined, now: Date): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [issued, random, signature] = parts as [string, string, string];
  if (!safeEqual(signature, hmac("login-nonce", `${issued}.${random}`).toString("base64url"))) return null;
  const age = now.getTime() - Number.parseInt(issued, 36) * 1000;
  return age <= LOGIN_NONCE_TTL_MS && age >= -LOGIN_NONCE_SKEW_MS ? value : null;
}

export function loginNonceCookie(nonce: string, path: string): CookieSpec {
  return { name: LOGIN_NONCE_COOKIE, value: nonce, path, maxAgeSeconds: LOGIN_NONCE_TTL_MS / 1000 };
}

export function sessionCookie(sessionId: string, path: string): CookieSpec {
  return {
    name: SESSION_COOKIE,
    value: signSessionId(sessionId),
    path,
    maxAgeSeconds: SESSION_TTL_MS / 1000,
  };
}

export function clearedSessionCookie(path: string): CookieSpec {
  return { name: SESSION_COOKIE, value: "", path, maxAgeSeconds: 0 };
}

/** The `Set-Cookie` header value: HttpOnly, SameSite=Lax, and Secure in production. */
export function serializeCookie(spec: CookieSpec): string {
  const parts = [
    `${spec.name}=${encodeURIComponent(spec.value)}`,
    `Path=${spec.path}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  if (spec.maxAgeSeconds !== null) parts.push(`Max-Age=${spec.maxAgeSeconds}`);
  return parts.join("; ");
}

/** The value of cookie `name` in a `Cookie` request header. */
export function readCookie(header: string | null, name: string): string | undefined {
  for (const piece of (header ?? "").split(";")) {
    const equals = piece.indexOf("=");
    if (equals > 0 && piece.slice(0, equals).trim() === name) {
      try {
        return decodeURIComponent(piece.slice(equals + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Whether `given` is the session's token of `type`; an anonymous or browser caller's only token is `+\`. */
export function tokenIsValid(session: ApiSession, type: TokenType, given: string): boolean {
  const expected =
    session.kind === "bot" && session.sessionId
      ? sessionToken(session.sessionId, type)
      : TOKEN_SUFFIX;
  return safeEqual(expected, given);
}

/** The token a caller must send for a write of `type`. */
export function expectedToken(session: ApiSession, type: TokenType): string {
  return session.kind === "bot" && session.sessionId
    ? sessionToken(session.sessionId, type)
    : TOKEN_SUFFIX;
}

// ---------------------------------------------------------------------------
// Login and sessions
// ---------------------------------------------------------------------------

export interface LoginAttempt {
  /** `lgname`: `<wiki username>@<AppId>`. */
  name: string;
  password: string;
  now: Date;
}

export type LoginOutcome =
  | {
      result: "Success";
      userId: number;
      username: string;
      cookie: CookieSpec;
    }
  | { result: "Failed"; reason: string };

const WRONG_CREDENTIALS: LoginOutcome = {
  result: "Failed",
  reason: "Incorrect username or password entered. Please try again.",
};

/** `User@AppId` split at its last `@`: usernames and app ids cannot hold one. */
export function splitBotLogin(name: string): { username: string; appId: string } | null {
  const at = name.lastIndexOf("@");
  if (at <= 0) return null;
  const appId = name.slice(at + 1);
  return APP_ID_PATTERN.test(appId) ? { username: name.slice(0, at), appId } : null;
}

/** Check a bot-password login and, when it holds, start the session. */
export async function loginWithBotPassword(
  store: AuthStore,
  attempt: LoginAttempt,
  cookiePath: string
): Promise<LoginOutcome> {
  const login = splitBotLogin(attempt.name);
  const found = login ? await store.findBotPassword(login.username, login.appId) : null;
  const matches = found
    ? await verifyBotPassword(attempt.password, found.botPassword.passwordHash)
    : await burnPasswordCheck(attempt.password);
  if (!found || !matches) return WRONG_CREDENTIALS;

  const sessionId = randomBytes(24).toString("base64url");
  await store.createSession({
    id: sessionId,
    botPasswordId: found.botPassword.id,
    userId: found.botPassword.userId,
    expiresAt: new Date(attempt.now.getTime() + SESSION_TTL_MS),
  });
  await store.touchBotPassword(found.botPassword.id, attempt.now);
  await store.pruneSessions(found.botPassword.id, attempt.now, MAX_SESSIONS_PER_BOT_PASSWORD);
  return {
    result: "Success",
    userId: found.user.mwUserId,
    username: found.user.name,
    cookie: sessionCookie(sessionId, cookiePath),
  };
}

export async function logoutSession(store: AuthStore, sessionId: string | null): Promise<void> {
  if (sessionId) await store.deleteSession(sessionId);
}

// ---------------------------------------------------------------------------
// Resolving the caller
// ---------------------------------------------------------------------------

export interface CallerIdentity {
  /** The `wikios_api_session` cookie value, if sent. */
  sessionCookie: string | undefined;
  /** The Clerk id of a signed-in browser user, if any. */
  webAuthId: string | null;
  /** How an anonymous caller is named (their address). */
  anonymousName: string;
}

function toSession(
  kind: ApiSession["kind"],
  user: SessionUser,
  permissions: WikiPermissions,
  extra: Pick<ApiSession, "sessionId" | "grants">
): ApiSession {
  return { kind, name: user.name, userId: user.mwUserId, ctx: user.ctx, permissions, ...extra };
}

async function botSession(
  store: AuthStore,
  sessionId: string,
  loadPermissions: PermissionLoader,
  now: Date
): Promise<ApiSession | null> {
  const found = await store.findSession(sessionId);
  if (!found || found.session.expiresAt <= now) return null;
  if (found.session.expiresAt.getTime() - now.getTime() < SESSION_REFRESH_BELOW_MS) {
    await store.extendSession(sessionId, new Date(now.getTime() + SESSION_TTL_MS));
  }
  const { grants } = found.session;
  const permissions = await loadPermissions(found.user.ctx, rightsForGrants(grants));
  return toSession("bot", found.user, permissions, { sessionId, grants });
}

/** The caller: a bot-password session, else a signed-in browser user (read-only), else anonymous. */
export async function resolveSession(
  identity: CallerIdentity,
  store: AuthStore,
  loadPermissions: PermissionLoader,
  now: Date
): Promise<ApiSession> {
  const sessionId = readSessionCookie(identity.sessionCookie);
  if (sessionId) {
    const bot = await botSession(store, sessionId, loadPermissions, now);
    if (bot) return bot;
  }
  const web = identity.webAuthId ? await store.findWebUser(identity.webAuthId) : null;
  if (web) {
    const permissions = await loadPermissions(web.ctx, null);
    return toSession("web", web, permissions, { sessionId: null, grants: null });
  }
  const ctx: WikiAuthContext = { auth: null, user: null };
  return {
    kind: "anonymous",
    name: identity.anonymousName,
    userId: 0,
    ctx,
    permissions: await loadPermissions(ctx, null),
    sessionId: null,
    grants: null,
  };
}
