import "server-only";

import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { db } from "~/server/db";
import { readConfigKeys } from "~/server/shared/config-kv";
import { isSystemOwner } from "~/lib/auth/system-owner-constants";
import { labsAccessDecision, type LabsAccess } from "~/lib/navigation/labs-gate";

const ADMIN_ROLE_LEVEL = 10;
const LABS_PERMISSION = "labs.access";

/**
 * The server-side Labs gate (SL-27): the signed-in user's access to `/labs/*`, decided by the
 * same rule the navigation shell uses (`labsAccessDecision`). A failed lookup denies access.
 */
export async function getLabsAccess(): Promise<LabsAccess> {
  try {
    const { userId } = await auth();
    if (!userId) return "signed-out";

    const [user, config] = await Promise.all([
      db.user.findUnique({
        where: { clerkUserId: userId },
        select: {
          role: {
            select: {
              level: true,
              rolePermissions: { select: { permission: { select: { name: true } } } },
            },
          },
        },
      }),
      readConfigKeys(db, ["showLabsTab"]),
    ]);

    const roleLevel = user?.role?.level;
    const permissions = user?.role?.rolePermissions.map((rp) => rp.permission.name) ?? [];
    return labsAccessDecision({
      signedIn: true,
      isAdmin: isSystemOwner(userId) || (roleLevel !== undefined && roleLevel <= ADMIN_ROLE_LEVEL),
      hasLabsAccess:
        permissions.includes(LABS_PERMISSION) || process.env.NODE_ENV === "development",
      showLabsTab: config.showLabsTab === undefined ? undefined : config.showLabsTab === "true",
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[labs-gate] Access check failed:", error);
    return "denied";
  }
}
