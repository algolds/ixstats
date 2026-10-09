import { TRPCError } from "@trpc/server";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

/** The messaging service wired to the request's database and the wiki talk bridge. */
export function messagingFor(ctx: { db: Parameters<typeof createMessagingService>[0]["db"] }) {
  return createMessagingService({
    db: ctx.db,
    notifications: notificationAPI,
    websocket: getThinkPagesBroadcaster(),
    wikiBridge: wikiTalkBridge,
  });
}

/** Run a messaging call, turning the service's not-found / forbidden errors into TRPCErrors. */
export async function mapMessagingErrors<T>(
  call: () => Promise<T>,
  messages: { forbidden: string; notFound?: string }
): Promise<T> {
  try {
    return await call();
  } catch (err: any) {
    if (err.name === "MessagingNotFoundError" && messages.notFound) {
      throw new TRPCError({ code: "NOT_FOUND", message: messages.notFound });
    }
    if (err.name === "MessagingBlockedError") {
      throw new TRPCError({ code: "FORBIDDEN", message: err.message });
    }
    if (err.name === "MessagingForbiddenError") {
      throw new TRPCError({ code: "FORBIDDEN", message: messages.forbidden });
    }
    throw err;
  }
}
