import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminClerkUser } from "~/server/shared/admin-access";

/**
 * Clerk guard for admin-only route handlers: the signed-in admin's `userId`, or the 401/403
 * response the handler should return as is. Admin = the database role (see `isAdminClerkUser`).
 */
export async function requireAdminSession(
  forbiddenMessage = "Admin access required"
): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!(await isAdminClerkUser(session.userId))) {
    return NextResponse.json({ error: forbiddenMessage }, { status: 403 });
  }
  return { userId: session.userId };
}
