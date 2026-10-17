import { TRPCError } from "@trpc/server";

/** The admin acting: DB id for the rows they change, Clerk id for the audit row. */
export interface CardAdminActor {
  dbId: string;
  clerkId: string;
}

/**
 * The signed-in admin as the card modules take them; adminProcedure guarantees both, this refuses otherwise.
 * Shared by the card, Loreward and wiki admin routers.
 */
export function adminActor(ctx: {
  user: { id: string } | null;
  auth: { userId: string | null } | null;
}): CardAdminActor {
  const clerkId = ctx.auth?.userId;
  if (!ctx.user || !clerkId)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in as an admin." });
  return { dbId: ctx.user.id, clerkId };
}
