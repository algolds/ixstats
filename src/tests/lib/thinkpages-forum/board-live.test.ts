import {
  boardLiveEventSchema,
  boardLiveMessageSchema,
  upsertBoardMessage,
  type BoardLiveMessage,
} from "~/lib/thinkpages-forum/board-live";

const live = (id: string, createdAt = "2026-10-10T12:00:00.000Z"): BoardLiveMessage => ({
  id,
  authorUserId: "u1",
  authorPersonaId: null,
  importedAuthorName: null,
  author: { name: "member", handle: "member", avatarUrl: null, flagUrl: null, persona: false },
  role: null,
  isVisitor: false,
  visitorRealm: null,
  contentHtml: "<p>hi</p>",
  reactions: {},
  createdAt,
  editedAt: null,
  replyTo: null,
  continued: null,
});

const item = (id: string, minute: number) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 9, 10, 12, minute)),
});
describe("boardLiveEventSchema", () => {
  it("rejects a malformed event and an unknown type", () => {
    expect(boardLiveEventSchema.safeParse({ type: "board:presence", realmId: "r1" }).success).toBe(
      false
    );
    expect(boardLiveEventSchema.safeParse({ type: "board:other", realmId: "r1" }).success).toBe(
      false
    );
  });

  it("has no place for viewer-specific or moderator-only fields", () => {
    const parsed = boardLiveEventSchema.parse({
      type: "board:message",
      realmId: "r1",
      message: { ...live("p1"), byViewer: true, canEdit: true, hidden: true },
    });
    expect(parsed.type === "board:message" && "byViewer" in parsed.message).toBe(false);
    expect(parsed.type === "board:message" && "hidden" in parsed.message).toBe(false);
    expect(parsed.type === "board:message" && "canEdit" in parsed.message).toBe(false);
  });
});

describe("upsertBoardMessage", () => {
  const list = [item("p5", 5), item("p3", 3), item("p1", 1)];
  it("replaces by id without duplicating, keeping the place", () => {
    const next = upsertBoardMessage(list, { ...item("p3", 3), extra: 1 } as never, {
      complete: false,
    });
    expect(next.map((m) => m.id)).toEqual(["p5", "p3", "p1"]);
    expect(next[1]).toMatchObject({ extra: 1 });
  });
  it("slots an older message in only when the list holds every older one", () => {
    expect(upsertBoardMessage(list, item("p2", 2), { complete: true }).map((m) => m.id)).toEqual([
      "p5",
      "p3",
      "p2",
      "p1",
    ]);
    // Older than everything loaded, with earlier pages still to load: leave it to the page that holds it.
    expect(upsertBoardMessage(list, item("p0", 0), { complete: false })).toBe(list);
    expect(upsertBoardMessage(list, item("p2", 2), { complete: false }).map((m) => m.id)).toEqual([
      "p5",
      "p3",
      "p2",
      "p1",
    ]);
  });
});
describe("boardLiveMessageSchema reactions", () => {
  const message = {
    id: "p1",
    authorUserId: null,
    authorPersonaId: null,
    importedAuthorName: null,
    author: { name: "kir", handle: "kir", avatarUrl: null, flagUrl: null, persona: false },
    role: null,
    isVisitor: false,
    visitorRealm: null,
    contentHtml: "<p>hi</p>",
    createdAt: "2026-10-10T12:00:00.000Z",
    editedAt: null,
    replyTo: null,
    continued: null,
  };
  it("rejects a count that is zero, negative or fractional, as the server reader would not count it", () => {
    for (const count of [0, -1, 1.5]) {
      expect(
        boardLiveMessageSchema.safeParse({ ...message, reactions: { like: count } }).success
      ).toBe(false);
    }
  });

  it("drops a key that is not a reaction type, and keeps the valid ones", () => {
    const parsed = boardLiveMessageSchema.parse({
      ...message,
      reactions: { like: 2, "not a type": 1, "discord:": 3, sad: 4, "discord:pog:12": 5 },
    });
    expect(parsed.reactions).toEqual({ like: 2, "discord:pog:12": 5 });
  });

  it("drops a viewer's own reaction if one is sent", () => {
    const parsed = boardLiveMessageSchema.parse({ ...message, myReaction: "like" });
    expect(parsed).not.toHaveProperty("myReaction");
  });
});
