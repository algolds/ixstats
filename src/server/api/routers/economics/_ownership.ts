import { TRPCError } from "@trpc/server";
import { isSystemOwner } from "~/lib/system-owner-constants";

const PRIVILEGED_ROLES = ["admin", "owner", "staff", "system-owner"];

/**
 * Authorize a write to a country's economic data.
 *
 * Mirrors the ownership logic proven in countries/management/update.ts:
 *  1. fast path — the user's linked country matches;
 *  2. admin / owner / system-owner bypass;
 *  3. fresh DB lookup fallback — `ctx.user` can be stale or missing `countryId`
 *     even for a legitimate owner, which previously caused autosave/sync calls
 *     to throw FORBIDDEN while the main save succeeded (broken persistence).
 */
export async function assertCountryAccess(ctx: any, countryId: string): Promise<void> {
  if (ctx.user?.countryId && ctx.user.countryId === countryId) return;

  const cachedRole = (ctx.user as any)?.role?.name;
  if (
    (ctx.auth?.userId && isSystemOwner(ctx.auth.userId)) ||
    (typeof cachedRole === "string" && PRIVILEGED_ROLES.includes(cachedRole))
  ) {
    return;
  }

  if (ctx.auth?.userId) {
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.auth.userId },
      include: { role: true },
    });
    const freshRole = user?.role?.name;
    if (
      user?.countryId === countryId ||
      (typeof freshRole === "string" && PRIVILEGED_ROLES.includes(freshRole))
    ) {
      return;
    }
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Cannot access other countries' economic data",
  });
}
