import type { CardAdminActor } from "~/server/modules/cards/cards.audit";

/** The signed-in admin as the card modules take them. */
export const adminActor = (ctx: {
  user: { id: string };
  auth: { userId: string };
}): CardAdminActor => ({
  dbId: ctx.user.id,
  clerkId: ctx.auth.userId,
});
