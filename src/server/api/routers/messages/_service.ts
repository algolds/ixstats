import { TRPCError } from "@trpc/server";
import { createMessagingService } from "~/server/modules/messaging";
import { notificationAPI } from "~/lib/notifications/api";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";
import { forumBridge } from "~/server/modules/forum";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";

/** The messaging service wired to the request's database and the platform bridges. */
export function messagingFor(ctx: { db: Parameters<typeof createMessagingService>[0]["db"] }) {
  return createMessagingService({
    db: ctx.db,
    notifications: notificationAPI,
    websocket: getThinkPagesBroadcaster(),
    forumBridge,
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
    if (err.name === "MessagingForbiddenError") {
      throw new TRPCError({ code: "FORBIDDEN", message: messages.forbidden });
    }
    throw err;
  }
}
