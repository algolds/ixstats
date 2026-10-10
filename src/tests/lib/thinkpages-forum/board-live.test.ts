import {
  BOARD_POLL_MS,
  BOARD_TYPING_EXPIRY_MS,
  boardLiveEventSchema,
  boardRefetchInterval,
  boardRoomOf,
  removeBoardMessage,
  upsertBoardMessage,
  type BoardLiveEvent,
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
  createdAt,
  editedAt: null,
  replyTo: null,
  continued: null,
});

const item = (id: string, minute: number) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 9, 10, 12, minute)),
});

describe("board live constants", () => {
  it("names the room after the realm and polls every 10s only without a live connection", () => {
    expect(boardRoomOf("r_eurth")).toBe("realm-board:r_eurth");
    expect(BOARD_POLL_MS).toBe(10_000);
    expect(BOARD_TYPING_EXPIRY_MS).toBe(5_000);
    expect(boardRefetchInterval(false)).toBe(10_000);
    expect(boardRefetchInterval(true)).toBe(false);
  });
});

describe("boardLiveEventSchema", () => {
  const events: BoardLiveEvent[] = [
    { type: "board:message", realmId: "r1", message: live("p1") },
    { type: "board:updated", realmId: "r1", change: { type: "updated", message: live("p1") } },
    { type: "board:updated", realmId: "r1", change: { type: "removed", postId: "p1" } },
    {
      type: "board:settings",
      realmId: "r1",
      settings: { visitorsAllowed: false, slowModeSeconds: 30 },
    },
    { type: "board:typing", realmId: "r1", name: "Eurth Daily" },
    { type: "board:presence", realmId: "r1", count: 3 },
  ];

  it.each(events)("round trips %j through JSON", (event) => {
    expect(boardLiveEventSchema.parse(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

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

  it("inserts a newer message at the top", () => {
    expect(upsertBoardMessage(list, item("p6", 6), { complete: false }).map((m) => m.id)).toEqual([
      "p6",
      "p5",
      "p3",
      "p1",
    ]);
  });

  it("replaces by id without duplicating, keeping the place", () => {
    const next = upsertBoardMessage(list, { ...item("p3", 3), extra: 1 } as never, {
      complete: false,
    });
    expect(next.map((m) => m.id)).toEqual(["p5", "p3", "p1"]);
    expect(next[1]).toMatchObject({ extra: 1 });
  });

  it("orders ties by id, newest id first", () => {
    const next = upsertBoardMessage([item("a", 3)], item("b", 3), { complete: false });
    expect(next.map((m) => m.id)).toEqual(["b", "a"]);
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

  it("starts an empty list", () => {
    expect(upsertBoardMessage([], item("p1", 1), { complete: false })).toEqual([item("p1", 1)]);
  });
});

describe("removeBoardMessage", () => {
  it("drops the post and returns the same list when it is not there", () => {
    const list = [item("p2", 2), item("p1", 1)];
    expect(removeBoardMessage(list, "p2").map((m) => m.id)).toEqual(["p1"]);
    expect(removeBoardMessage(list, "nope")).toBe(list);
  });
});
