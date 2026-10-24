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
    /** The passport handle; null until picked. */
    handle?: string | null;
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
  /** The passport handle; null until picked. */
  handle: string | null;
  /** Active country name if affiliated. */
  countryName: string | null;
}

/** The refusal for a save by a player who has not picked a passport handle yet. */
export const HANDLE_REQUIRED_MESSAGE = "Pick a passport handle before you save.";

/** The name a player's edits are signed with: their passport handle (design decision 9), else null. */
export function wikiAuthorName(ctx: WikiAuthContext): string | null {
  return ctx.user?.handle?.trim() || null;
}

/**
 * The passport handle a player's save is signed with. Throws PRECONDITION_FAILED until they pick one, so an
 * edit is never saved under a country name or an account id.
 */
export function requireWikiAuthorName(ctx: WikiAuthContext): string {
  const name = wikiAuthorName(ctx);
  if (!name) throw new TRPCError({ code: "PRECONDITION_FAILED", message: HANDLE_REQUIRED_MESSAGE });
  return name;
}

/** Read the current identity. */
export function getWikiAuth(ctx: WikiAuthContext): WikiAuthIdentity {
  return {
    internalUserId: ctx.user?.id ?? null,
    userId: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? null,
    handle: wikiAuthorName(ctx),
    countryName: ctx.user?.country?.name ?? null,
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
 * The name an action is logged under: the passport handle, else "anonymous". Never an account id: logs are public
 * (`getLog`), and the actor's id is stored beside the name.
 */
export function getWikiActorLabel(ctx: WikiAuthContext): string {
  return wikiAuthorName(ctx) ?? "anonymous";
}

/**
 * Whether the current user is a wiki administrator: they hold the `editprotected` right, which
 * comes from the sysop group (explicit, or through their IxStates role). The rights engine is loaded
 * lazily: it reads this seam's `getWikiAuth`, so a static import would be circular.
 */
export async function isWikiAdmin(ctx: WikiAuthContext): Promise<boolean> {
  const { getWikiPermissions } = await import("~/lib/wiki-os/rights");
  return (await getWikiPermissions(ctx)).rights.has("editprotected");
}
