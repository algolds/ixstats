/**
 * Whether a Clerk user may open /admin, for the proxy, which has no tRPC context: the system owner, or a user whose
 * database role passes the admin rule (`isAdminRole`, the rule adminProcedure applies). The answer is remembered per
 * Clerk id for 60 s, so admin page loads do not each read the database; a role change takes up to that long to show.
 */
import { isSystemOwner } from "~/lib/auth/system-owner-constants";
import { isAdminRole } from "~/lib/auth/admin-rule";
import { db } from "~/server/db";

const TTL_MS = 60 * 1000;
// ponytail: per-process cache, like clerk-public-profile; only users who reach /admin are kept.
const cache = new Map<string, { at: number; allowed: boolean }>();

/** True for the system owner (no database read) or an admin-rule role; false on any database error. */
export async function isAdminClerkUser(clerkUserId: string): Promise<boolean> {
  if (isSystemOwner(clerkUserId)) return true;
  const now = Date.now();
  const hit = cache.get(clerkUserId);
  if (hit && now - hit.at < TTL_MS) return hit.allowed;
  try {
    const user = await db.user.findUnique({
      where: { clerkUserId },
      select: { role: { select: { name: true, level: true } } },
    });
    const allowed = isAdminRole(user?.role);
    cache.set(clerkUserId, { at: now, allowed });
    return allowed;
  } catch (error) {
    console.error(`[admin-access] Role lookup failed for ${clerkUserId}; denying /admin:`, error);
    return false;
  }
}
