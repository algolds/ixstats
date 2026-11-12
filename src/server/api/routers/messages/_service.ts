import { TRPCError } from "@trpc/server";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { isAdminRole } from "~/lib/auth/admin-rule";
import { isSystemOwner } from "~/lib/auth/system-owner-constants";

/** Whether the caller acts as an administrator (the system owner or an admin role), not while playing as someone else. */
export function actsAsAdmin(ctx: {
  auth: { userId: string };
  impersonatorId?: string;
  user?: { role?: { name: string | null; level: number | null } | null } | null;
}): boolean {
  if (ctx.impersonatorId) return false;
  return isSystemOwner(ctx.auth.userId) || isAdminRole(ctx.user?.role);
}

/** The messaging service wired to the request's database and the wiki talk bridge. */
export function messagingFor(ctx: { db: Parameters<typeof createMessagingService>[0]["db"] }) {
  return createMessagingService({
    db: ctx.db,
    notifications: notificationAPI,
    websocket: getThinkPagesBroadcaster(),
    wikiBridge: wikiTalkBridge,
  });
}

/** Run a messaging call, turning the service's not-found / forbidden / invalid errors into TRPCErrors. */
export async function mapMessagingErrors<T>(
  call: () => Promise<T>,
  messages: { forbidden: string; notFound?: string }
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    if (err.name === "MessagingNotFoundError" && messages.notFound) {
      throw new TRPCError({ code: "NOT_FOUND", message: messages.notFound });
    }
    if (err.name === "MessagingBlockedError") {
      throw new TRPCError({ code: "FORBIDDEN", message: err.message });
    }
    if (err.name === "MessagingForbiddenError") {
      throw new TRPCError({ code: "FORBIDDEN", message: messages.forbidden });
    }
    if (err.name === "MessagingValidationError") {
      throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
    }
    throw err;
  }
}
