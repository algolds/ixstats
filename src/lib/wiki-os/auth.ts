// src/lib/wiki-os/auth.ts
// WikiOS SERVER auth seam (Workstream C2 & IxnayID Unified Auth).
//
// WikiOS routers read identity through these helpers, never the raw
// (Clerk-shaped) tRPC context. A different deployer maps their auth provider
// into these fields here — WikiOS feature code stays unchanged.
// See plans/wikios-workstream-c-packaging.md.

import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/auth";

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
  } | null;
}

export interface WikiAuthIdentity {
  /** Internal PostgreSQL User ID (cuid). */
  internalUserId: string | null;
  /** Stable account id from the auth provider (Clerk user id). */
  userId: string | null;
  /** MediaWiki username, either explicitly linked or resolved via Smart Hierarchy. */
  wikiUsername: string | null;
  /** Active country name if affiliated. */
  countryName: string | null;
  /** Whether the user is system owner / wiki admin. */
  isAdmin: boolean;
}

/** Sanitize a string to be a safe MediaWiki username. */
export function sanitizeMediaWikiUsername(input: string): string {
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
  const isAdmin = !!userId && isSystemOwner(userId);

  return {
    internalUserId,
    userId,
    wikiUsername,
    countryName,
    isAdmin,
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

/** Attribution label for edit summaries: wiki username, else account id, else "anonymous". */
export function getWikiActorLabel(ctx: WikiAuthContext): string {
  const { wikiUsername, userId } = getWikiAuth(ctx);
  return wikiUsername ?? userId ?? "anonymous";
}

/**
 * Whether the current user has wiki-admin privileges.
 */
export function isWikiAdmin(ctx: WikiAuthContext): boolean {
  const { isAdmin } = getWikiAuth(ctx);
  return isAdmin;
}
