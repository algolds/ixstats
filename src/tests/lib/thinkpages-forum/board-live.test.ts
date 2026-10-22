import {
  boardLiveEventSchema,
  boardLiveMessageSchema,
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
  it("drops a viewer's own reaction if one is sent", () => {
    const parsed = boardLiveMessageSchema.parse({ ...message, myReaction: "like" });
    expect(parsed).not.toHaveProperty("myReaction");
  });
});
