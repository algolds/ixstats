// src/lib/wiki-os/auth.ts
// WikiOS SERVER auth seam (Workstream C2 & IxnayID Unified Auth).
//
// WikiOS routers read identity through these helpers, never the raw
// (Clerk-shaped) tRPC context. A different deployer maps their auth provider
// into these fields here — WikiOS feature code stays unchanged.
// See plans/wikios-workstream-c-packaging.md.

import { TRPCError } from "@trpc/server";

/** Minimal structural shape WikiOS needs from the request context. */
export interface WikiAuthContext {
  auth?: { userId?: string | null } | null;
  user?: {
    id?: string | null;
    clerkUserId?: string | null;
    wikiUsername?: string | null;
    wikiUserId?: number | null;
    countryId?: string | null;
    country?: { id?: string; name?: string | null; flag?: string | null } | null;
    role?: { id?: string; name?: string | null; level?: number | null } | null;
    createdAt?: Date | string | null;
  } | null;
}

export interface WikiAuthIdentity {
  /** Internal PostgreSQL User ID (cuid). */
  internalUserId: string | null;
  /** Stable account id from the auth provider (Clerk user id). */
  userId: string | null;
  /** MediaWiki username, either explicitly linked or resolved via Smart Hierarchy. */
  wikiUsername: string | null;
  /**
   * Whether `User.wikiUsername` is set. NOT proof of a linked wiki account: the column can hold a
   * display fallback, so it must never gate authorization. Use `getVerifiedWikiLink` (storage.ts),
   * which reads the verified `WikiAccountLink`, for anything security-relevant.
   */
  hasLegacyWikiUsername: boolean;
  /** Active country name if affiliated. */
  countryName: string | null;
}

/** Sanitize a string to be a safe MediaWiki username. */
function sanitizeMediaWikiUsername(input: string): string {
  // MediaWiki usernames cannot contain # < > [ ] | { } / @ : =
  let clean = input
    .replace(/[#<>[\]|{}/@:=]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  if (!clean) clean = "User";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Smart Hierarchy resolution for Wiki author name:
 * 1. User.wikiUsername (if set/linked)
 * 2. Country name (user.country.name)
 * 3. Sanitized Clerk user ID / handle
 */
export function resolveWikiUsername(ctx: WikiAuthContext): string | null {
  if (ctx.user?.wikiUsername && ctx.user.wikiUsername.trim() !== "") {
    return ctx.user.wikiUsername.trim();
  }

  // Country name fallback
  if (ctx.user?.country?.name && ctx.user.country.name.trim() !== "") {
    return sanitizeMediaWikiUsername(ctx.user.country.name.trim());
  }

  // Fallback to clerk user ID or internal ID
  const authId = ctx.auth?.userId || ctx.user?.clerkUserId || ctx.user?.id;
  if (authId) {
    const shortId = authId.replace(/^user_/, "");
    return sanitizeMediaWikiUsername(`User_${shortId.slice(0, 8)}`);
  }

  return null;
}

/** Read the current identity with Smart Hierarchy. */
export function getWikiAuth(ctx: WikiAuthContext): WikiAuthIdentity {
  const userId = ctx.auth?.userId ?? ctx.user?.clerkUserId ?? null;
  const internalUserId = ctx.user?.id ?? null;
  const countryName = ctx.user?.country?.name ?? null;
  const wikiUsername = resolveWikiUsername(ctx);
  const hasLegacyWikiUsername = Boolean(ctx.user?.wikiUsername?.trim());

  return {
    internalUserId,
    userId,
    wikiUsername,
    hasLegacyWikiUsername,
    countryName,
  };
}

/** Require a signed-in user; throws UNAUTHORIZED otherwise. */
export function requireWikiUserId(ctx: WikiAuthContext): string {
  const userId = ctx.user?.id ?? ctx.auth?.userId ?? null;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return userId;
}

/**
 * Every id the signed-in user's WikiOS rows may be keyed by: the internal User id that
 * requireWikiUserId returns, plus the Clerk id that it returned before 2026-08-22 (rows
 * written earlier, such as stashes and watchlists, still carry it). Read with
 * `userId: { in: ids }` and check ownership with `ids.includes(...)`; write new rows with
 * requireWikiUserId. Throws UNAUTHORIZED when signed out.
 */
export function requireWikiUserIds(ctx: WikiAuthContext): string[] {
  const primary = requireWikiUserId(ctx);
  const ids = [primary, ctx.auth?.userId, ctx.user?.clerkUserId].filter(
    (id): id is string => typeof id === "string" && id.length > 0
  );
  return [...new Set(ids)];
}

/** Require a signed-in user and return the auth provider's (Clerk) user id. */
export function requireWikiAuthId(ctx: WikiAuthContext): string {
  const authId = ctx.auth?.userId ?? ctx.user?.clerkUserId ?? null;
  if (!authId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return authId;
}

/**
 * Whether the current user is a wiki administrator: they hold the `editprotected` right, which
 * comes from the sysop group (explicit, or through their IxStates role). The rights engine is loaded
 * lazily: it reads this seam's `getWikiAuth`, so a static import would be circular.
 */
/** The name an action is logged under: the linked wiki username, else the IxStates user id. */
export function getWikiActorLabel(ctx: WikiAuthContext): string {
  const { wikiUsername, userId } = getWikiAuth(ctx);
  return wikiUsername ?? userId ?? "anonymous";
}

export async function isWikiAdmin(ctx: WikiAuthContext): Promise<boolean> {
  const { getWikiPermissions } = await import("~/lib/wiki-os/rights");
  return (await getWikiPermissions(ctx)).rights.has("editprotected");
}
