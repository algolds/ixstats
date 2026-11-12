/** @jest-environment node */
import {
  appendIncoming,
  clusterMessages,
  flattenPages,
  isTempMessageId,
  mapFirstPage,
  mapPages,
  memberMentionItems,
  mentionIdsFor,
  newTempMessageId,
  replaceOptimistic,
  seenMessageId,
  sortByTime,
  typingAccountIds,
  typingLabel,
  withReaction,
} from "~/lib/messages/thread";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 12, minutes));
const msg = (id: string, accountId: string, minutes: number, content = id) => ({
  id,
  accountId,
  content,
  ixTimeTimestamp: at(minutes),
  account: { name: accountId } as { name: string } | undefined,
  replyTo: undefined as unknown,
});

describe("sortByTime", () => {
  it("orders oldest first without touching the input", () => {
    const input = [msg("b", "x", 5), msg("a", "x", 1)];
    expect(sortByTime(input).map((m) => m.id)).toEqual(["a", "b"]);
    expect(input[0]!.id).toBe("b");
  });
});

describe("clusterMessages", () => {
  it("joins one sender's messages within five minutes", () => {
    const out = clusterMessages([msg("1", "a", 0), msg("2", "a", 2), msg("3", "a", 4)]);
    expect(out.map((c) => [c.startsCluster, c.endsCluster])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
  });

  it("breaks on another sender and on a long gap", () => {
    const out = clusterMessages([
      msg("1", "a", 0),
      msg("2", "b", 1),
      msg("3", "b", 10),
      msg("4", "a", 11),
    ]);
    expect(out.map((c) => [c.startsCluster, c.endsCluster])).toEqual([
      [true, true],
      [true, true],
      [true, true],
      [true, true],
    ]);
  });

  it("handles an empty list", () => {
    expect(clusterMessages([])).toEqual([]);
  });
});

describe("optimistic send", () => {
  it("gives temp ids that are recognised and unique", () => {
    const a = newTempMessageId();
    expect(isTempMessageId(a)).toBe(true);
    expect(a).not.toBe(newTempMessageId());
    expect(isTempMessageId("cm123")).toBe(false);
  });

  it("replaces the optimistic message with the saved one in place", () => {
    const list = [msg("a", "me", 0), msg("temp-1", "me", 1), msg("b", "x", 2)];
    const out = replaceOptimistic(list, "temp-1", { id: "real", ixTimeTimestamp: at(3) });
    expect(out.map((m) => m.id)).toEqual(["a", "real", "b"]);
    expect(out[1]!.ixTimeTimestamp).toEqual(at(3));
  });

  it("drops the optimistic message when the realtime echo already added the real one", () => {
    const list = [msg("real", "me", 3), msg("temp-1", "me", 1)];
    const out = replaceOptimistic(list, "temp-1", { id: "real", ixTimeTimestamp: at(3) });
    expect(out.map((m) => m.id)).toEqual(["real"]);
  });
});

describe("appendIncoming", () => {
  it("adds a new message once", () => {
    const list = [msg("a", "x", 0)];
    const incoming = msg("b", "x", 1);
    const once = appendIncoming(list, incoming, "me");
    expect(once.map((m) => m.id)).toEqual(["b", "a"]);
    expect(appendIncoming(once, incoming, "me")).toBe(once);
  });

  it("lets the echo of my own send take the optimistic message's place, keeping its reply and sender", () => {
    const pending = { ...msg("temp-1", "me", 1, "hello"), replyTo: { id: "q" } as unknown };
    const echo = { ...msg("real", "me", 1, "hello"), account: undefined, replyTo: undefined };
    const out = appendIncoming([pending], echo, "me");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "real", account: { name: "me" }, replyTo: { id: "q" } });
  });

  it("does not merge someone else's identical text into my pending message", () => {
    const out = appendIncoming([msg("temp-1", "me", 1, "hi")], msg("other", "x", 2, "hi"), "me");
    expect(out.map((m) => m.id)).toEqual(["other", "temp-1"]);
  });
});

describe("pages", () => {
  const data = {
    pages: [
      { messages: [msg("n1", "a", 5)], nextCursor: "c" },
      { messages: [msg("o1", "a", 1)], nextCursor: null },
    ],
    pageParams: [null, "c"],
  };

  it("maps every page or only the newest", () => {
    const upper = (ms: ReturnType<typeof msg>[]) =>
      ms.map((m) => ({ ...m, id: m.id.toUpperCase() }));
    expect(mapPages(data, upper).pages.map((p) => p.messages[0]!.id)).toEqual(["N1", "O1"]);
    expect(mapFirstPage(data, upper).pages.map((p) => p.messages[0]!.id)).toEqual(["N1", "o1"]);
    expect(mapFirstPage(data, upper).pageParams).toEqual([null, "c"]);
  });

  it("flattens to one list, oldest first", () => {
    expect(flattenPages(data).map((m) => m.id)).toEqual(["o1", "n1"]);
    expect(flattenPages(undefined)).toEqual([]);
  });
});

describe("seenMessageId", () => {
  const list = [msg("a", "me", 0), msg("b", "x", 1), msg("c", "me", 2), msg("d", "me", 6)];

  it("is the newest own message read by then", () => {
    expect(seenMessageId(list, at(3), "me")).toBe("c");
    expect(seenMessageId(list, at(6), "me")).toBe("d");
  });

  it("is null when nothing is read, receipts are off, or only pending messages qualify", () => {
    expect(seenMessageId(list, null, "me")).toBeNull();
    expect(seenMessageId(list, undefined, "me")).toBeNull();
    expect(seenMessageId([msg("temp-9", "me", 0)], at(9), "me")).toBeNull();
  });
});

describe("mentions", () => {
  const members = [
    { accountId: "u1", account: { username: "ana_k", displayName: "Ana Kova" } },
    { accountId: "u2", account: { username: "ben", displayName: "Ben Ito" } },
  ];

  it("maps @handles to member ids, once each, case-insensitively", () => {
    expect(mentionIdsFor("hi @Ana_K and @ben, @ana_k again, @nobody", members)).toEqual([
      "u1",
      "u2",
    ]);
  });

  it("ignores an @ inside a word or an address", () => {
    expect(mentionIdsFor("mail me at ben@ben.com or @@ben", members)).toEqual([]);
  });

  it("suggests members whose handle or name contains the query", () => {
    expect(memberMentionItems(members, "kov").map((i) => i.name)).toEqual(["ana_k"]);
    expect(memberMentionItems(members, "").map((i) => i.name)).toEqual(["ana_k", "ben"]);
    expect(memberMentionItems(members, "@BE")[0]).toMatchObject({
      kind: "user",
      label: "Ben Ito",
      avatarUrl: null,
    });
  });
});

describe("withReaction", () => {
  const base = { reactions: { a: 2 } as Record<string, number>, myReactions: [] as string[] };

  it("adds mine once", () => {
    const once = withReaction(base, "a", true);
    expect(once).toEqual({ reactions: { a: 3 }, myReactions: ["a"] });
    expect(withReaction(once, "a", true)).toBe(once);
  });

  it("removes mine and drops an emoji that reaches zero", () => {
    const mine = { reactions: { a: 1 }, myReactions: ["a"] };
    expect(withReaction(mine, "a", false)).toEqual({ reactions: {}, myReactions: [] });
    expect(withReaction(base, "a", false)).toBe(base);
  });
});

describe("typing", () => {
  const indicators = new Map([
    ["c1_a", { accountId: "a", conversationId: "c1" }],
    ["c1_me", { accountId: "me", conversationId: "c1" }],
    ["c2_b", { accountId: "b", conversationId: "c2" }],
    ["c1_a2", { accountId: "a", conversationId: "c1" }],
  ]);

  it("lists others typing in this thread only, once each", () => {
    expect(typingAccountIds(indicators, "c1", "me")).toEqual(["a"]);
  });

  it("words one, two and many typers", () => {
    expect(typingLabel([])).toBeNull();
    expect(typingLabel(["Ana"])).toBe("Ana is typing…");
    expect(typingLabel(["Ana", "Ben"])).toBe("Ana and Ben are typing…");
    expect(typingLabel(["Ana", "Ben", "Cy"])).toBe("Ana and 2 others are typing…");
  });
});
