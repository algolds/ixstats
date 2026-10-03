import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isSystemOwner } from "~/lib/auth";

const ADMIN_ROLES = ["admin", "owner", "staff"];

/**
 * Clerk guard for admin-only route handlers: the signed-in admin's `userId`, or the 401/403
 * response the handler should return as is.
 */
export async function requireAdminSession(
  forbiddenMessage = "Admin access required"
): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isSystemOwner(session.userId)) {
    const role = (session.sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: forbiddenMessage }, { status: 403 });
    }
  }
  return { userId: session.userId };
}
