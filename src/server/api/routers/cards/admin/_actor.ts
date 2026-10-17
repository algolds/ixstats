import { TRPCError } from "@trpc/server";
import type { CardAdminActor } from "~/server/modules/cards/cards.audit";

/** The signed-in admin as the card modules take them; adminProcedure guarantees both, this refuses otherwise. */
export function adminActor(ctx: {
  user: { id: string } | null;
  auth: { userId: string | null } | null;
}): CardAdminActor {
  const clerkId = ctx.auth?.userId;
  if (!ctx.user || !clerkId)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in as an admin." });
  return { dbId: ctx.user.id, clerkId };
}
