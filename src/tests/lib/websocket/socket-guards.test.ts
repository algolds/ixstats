import {
  createRateLimiter,
  parseReceiptPayload,
  parseTypingPayload,
} from "~/lib/websocket/socket-guards";

describe("parseTypingPayload", () => {
  it("keeps only the allowed fields", () => {
    expect(
      parseTypingPayload({ conversationId: "c_1", isTyping: false, accountId: "x", extra: 1 })
    ).toEqual({ conversationId: "c_1", isTyping: false });
  });

  it.each([
    undefined,
    "text",
    {},
    { isTyping: true },
    { conversationId: "c1" },
    { conversationId: "c1", isTyping: "true" },
    { conversationId: "c1", groupId: "g1", isTyping: true },
    { conversationId: "a b", isTyping: true },
    { conversationId: "x".repeat(65), isTyping: true },
    { conversationId: { $gt: "" }, isTyping: true },
  ])("rejects %j", (payload) => {
    expect(parseTypingPayload(payload)).toBeNull();
  });
});

describe("parseReceiptPayload", () => {
  it("accepts a group receipt and drops extras", () => {
    expect(parseReceiptPayload({ groupId: "g1", messageId: "m1", readAt: 5 })).toEqual({
      groupId: "g1",
      messageId: "m1",
    });
  });

  it("needs a message id and one room", () => {
    expect(parseReceiptPayload({ conversationId: "c1" })).toBeNull();
    expect(parseReceiptPayload({ messageId: "m1" })).toBeNull();
    expect(
      parseReceiptPayload({ conversationId: "c1", groupId: "g1", messageId: "m1" })
    ).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("allows the limit per window and drops the rest, then resets", () => {
    let t = 1_000;
    const allow = createRateLimiter(3, 1_000, () => t);
    expect([1, 2, 3, 4, 5].map(() => allow())).toEqual([true, true, true, false, false]);
    t += 1_000;
    expect(allow()).toBe(true);
  });
});
