import { persistMessageTx } from "../../../../server/modules/messages/services/message-mutations";

class MockMessagePrismaTxState {
  participants: any[] = [];
  conversations: any[] = [];
  messages: any[] = [];

  failOnConversationUpdate = false;

  getDb() {
    const self = this;
    const createTxClient = () => ({
      conversationParticipant: {
        findFirst: async ({ where }: any) => {
          return self.participants.find(
            (p) =>
              p.conversationId === where.conversationId &&
              p.userId === where.userId &&
              (where.isActive === undefined || p.isActive === where.isActive)
          );
        },
        findMany: async ({ where }: any) => {
          return self.participants.filter(
            (p) =>
              p.conversationId === where.conversationId &&
              (where.userId?.not === undefined || p.userId !== where.userId.not) &&
              (where.isActive === undefined || p.isActive === where.isActive)
          );
        },
      },
      thinkshareConversation: {
        findUnique: async ({ where }: any) => {
          return self.conversations.find((c) => c.id === where.id);
        },
        update: async ({ where, data }: any) => {
          if (self.failOnConversationUpdate) {
            throw new Error("Simulated thinkshareConversation update failure");
          }
          const idx = self.conversations.findIndex((c) => c.id === where.id);
          if (idx === -1) throw new Error("Conversation not found");
          const updated = { ...self.conversations[idx], ...data };
          self.conversations[idx] = updated;
          return updated;
        },
      },
      thinkshareMessage: {
        create: async ({ data }: any) => {
          const msg = { id: `msg_${self.messages.length + 1}`, createdAt: new Date(), ...data };
          self.messages.push(msg);
          return msg;
        },
      },
    });

    return {
      $transaction: async (cb: (tx: any) => Promise<any>) => {
        const snapshot = {
          participants: JSON.parse(JSON.stringify(self.participants)),
          conversations: JSON.parse(JSON.stringify(self.conversations)),
          messages: JSON.parse(JSON.stringify(self.messages)),
        };

        try {
          const txClient = createTxClient();
          return await cb(txClient);
        } catch (err) {
          self.participants = snapshot.participants;
          self.conversations = snapshot.conversations;
          self.messages = snapshot.messages;
          throw err;
        }
      },
    };
  }
}

describe("Plan 156: Message Persistence Transactional Correctness", () => {
  let harness: MockMessagePrismaTxState;
  let db: any;

  beforeEach(() => {
    harness = new MockMessagePrismaTxState();
    db = harness.getDb();

    harness.conversations.push({
      id: "conv-1",
      name: "General Discussion",
      source: "thinkshare",
      lastActivity: new Date("2026-01-01T00:00:00Z"),
    });

    harness.participants.push(
      { conversationId: "conv-1", userId: "user-1", isActive: true },
      { conversationId: "conv-1", userId: "user-2", isActive: true }
    );
  });

  it("persists message and updates conversation lastActivity atomically on success", async () => {
    const result = await persistMessageTx(db, {
      conversationId: "conv-1",
      principalId: "user-1",
      content: "Hello world",
      messageType: "STANDARD",
    });

    expect(result.message.id).toBe("msg_1");
    expect(result.message.content).toBe("Hello world");
    expect(result.otherParticipants).toHaveLength(1);
    expect(result.otherParticipants[0].userId).toBe("user-2");
    expect(harness.messages).toHaveLength(1);
    expect(new Date(harness.conversations[0].lastActivity).getTime()).toBeGreaterThan(
      new Date("2026-01-01T00:00:00Z").getTime()
    );
  });

  it("rejects non-participants before writing message", async () => {
    await expect(
      persistMessageTx(db, {
        conversationId: "conv-1",
        principalId: "intruder-99",
        content: "I am not in this conversation",
        messageType: "STANDARD",
      })
    ).rejects.toThrow("You are not a participant in this conversation");

    expect(harness.messages).toHaveLength(0);
  });

  it("rolls back message creation when conversation lastActivity update fails", async () => {
    harness.failOnConversationUpdate = true;

    await expect(
      persistMessageTx(db, {
        conversationId: "conv-1",
        principalId: "user-1",
        content: "This will fail on update",
        messageType: "STANDARD",
      })
    ).rejects.toThrow("Simulated thinkshareConversation update failure");

    expect(harness.messages).toHaveLength(0);
  });
});
