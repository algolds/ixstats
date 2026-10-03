/**
 * Sports league access — who may run a league's season and simulations.
 *
 * Mirrors the rule the league UI already applies (`LeagueRouter` `canManageLeague`)
 * and `leagues/crud.ts` update/delete: the league's creator or a system owner.
 */

import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/auth";

interface LeagueManagerCaller {
  user: { id: string };
  auth: { userId: string };
}

function canManageLeague(
  caller: LeagueManagerCaller,
  league: { createdByUserId: string }
): boolean {
  return league.createdByUserId === caller.user.id || isSystemOwner(caller.auth.userId);
}

/** For public queries: whether the (possibly signed-out) viewer manages the league. */
export function viewerCanManageLeague(
  viewer: { user?: { id: string } | null; auth?: { userId?: string | null } | null },
  league: { createdByUserId: string }
): boolean {
  const userId = viewer.user?.id;
  const clerkUserId = viewer.auth?.userId;
  if (!userId || !clerkUserId) return false;
  return canManageLeague({ user: { id: userId }, auth: { userId: clerkUserId } }, league);
}

export function assertCanManageLeague(
  caller: LeagueManagerCaller,
  league: { createdByUserId: string }
): void {
  if (!canManageLeague(caller, league)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this league" });
  }
}
