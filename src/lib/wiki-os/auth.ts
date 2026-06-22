// src/lib/wiki-os/auth.ts
// WikiOS SERVER auth seam (Workstream C2).
//
// WikiOS routers read identity through these helpers, never the raw
// (Clerk-shaped) tRPC context. A different deployer maps their auth provider
// into these fields here — WikiOS feature code stays unchanged.
// See plans/wikios-workstream-c-packaging.md.

import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/system-owner-constants";

/** Minimal structural shape WikiOS needs from the request context. */
export interface WikiAuthContext {
  auth?: { userId?: string | null } | null;
  user?: { wikiUsername?: string | null } | null;
}

export interface WikiAuthIdentity {
  /** Stable account id from the auth provider (Clerk user id today). */
  userId: string | null;
  /** MediaWiki username, when linked. */
  wikiUsername: string | null;
}

/** Read the current identity. The one place WikiOS server code reads provider shape. */
export function getWikiAuth(ctx: WikiAuthContext): WikiAuthIdentity {
  return {
    userId: ctx.auth?.userId ?? null,
    wikiUsername: ctx.user?.wikiUsername ?? null,
  };
}

/** Require a signed-in user; throws UNAUTHORIZED otherwise. */
export function requireWikiUserId(ctx: WikiAuthContext): string {
  const userId = ctx.auth?.userId ?? null;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return userId;
}

/** Attribution label for edit summaries: wiki username, else account id, else "anonymous". */
export function getWikiActorLabel(ctx: WikiAuthContext): string {
  const { userId, wikiUsername } = getWikiAuth(ctx);
  return wikiUsername ?? userId ?? "anonymous";
}

/**
 * Whether the current user has wiki-admin privileges. The one place WikiOS maps
 * the deployer's admin/RBAC model (IxStats: system owner) — swap it here.
 */
export function isWikiAdmin(ctx: WikiAuthContext): boolean {
  const { userId } = getWikiAuth(ctx);
  return !!userId && isSystemOwner(userId);
}
