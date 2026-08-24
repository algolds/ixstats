import { messagesConversationsRouter } from "~/server/api/routers/messages/conversations";
import { messagesMessagingRouter } from "~/server/api/routers/messages/messaging";
import { messagesParticipantsRouter } from "~/server/api/routers/messages/participants";
import { thinkpagesMessagingConversationsRouter } from "~/server/api/routers/thinkpages/messaging/conversations";
import { thinkpagesMessagingMessagesRouter } from "~/server/api/routers/thinkpages/messaging/messages";
import { thinkpagesMessagingPresenceRouter } from "~/server/api/routers/thinkpages/messaging/presence";

describe("Messaging API Parity & Contract Invariants (Plan 163)", () => {
  test("api.messages contains the exact 15 public procedure names", () => {
    const convProcedures = Object.keys(messagesConversationsRouter._def.procedures);
    const msgProcedures = Object.keys(messagesMessagingRouter._def.procedures);
    const partProcedures = Object.keys(messagesParticipantsRouter._def.procedures);

    const allMessagesProcedures = [...convProcedures, ...msgProcedures, ...partProcedures].sort();

    const expectedCurrent = [
      "addParticipant",
      "addReaction",
      "clearAllSystemNotifications",
      "createConversation",
      "deleteMessage",
      "editMessage",
      "getConversation",
      "getConversationMessages",
      "getConversationsByFolder",
      "getFolderCounts",
      "leaveConversation",
      "markAllAsRead",
      "markMessagesAsRead",
      "removeReaction",
      "searchUsers",
      "sendAdminBroadcast",
      "sendAdminMessage",
      "sendMessage",
      "syncDiscussions",
    ].sort();

    expect(allMessagesProcedures).toEqual(expectedCurrent);
    expect(allMessagesProcedures).toHaveLength(19);
  });

  test("api.thinkpages messaging contains the exact 8 legacy procedure names", () => {
    const legacyConvProcedures = Object.keys(
      thinkpagesMessagingConversationsRouter._def.procedures
    );
    const legacyMsgProcedures = Object.keys(
      thinkpagesMessagingMessagesRouter._def.procedures
    );
    const legacyPresenceProcedures = Object.keys(
      thinkpagesMessagingPresenceRouter._def.procedures
    );

    const allLegacyProcedures = [
      ...legacyConvProcedures,
      ...legacyMsgProcedures,
      ...legacyPresenceProcedures,
    ].sort();

    const expectedLegacy = [
      "createConversation",
      "createConversationByCountries",
      "getConversationMessages",
      "getConversations",
      "getPresenceForUsers",
      "markMessagesAsRead",
      "sendMessage",
      "updatePresence",
    ].sort();

    expect(allLegacyProcedures).toEqual(expectedLegacy);
    expect(allLegacyProcedures).toHaveLength(8);
  });
});
