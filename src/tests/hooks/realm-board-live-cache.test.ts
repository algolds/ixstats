import { toCachedMessage } from "~/hooks/realm-board-live-cache";
import type { BoardLiveMessage } from "~/lib/thinkpages-forum/board-live";

const live = (personaType?: "media" | null): BoardLiveMessage => ({
  id: "p1",
  authorUserId: null,
  authorPersonaId: "pa1",
  importedAuthorName: null,
  author: {
    name: "Eurth Daily",
    handle: "eurthdaily",
    avatarUrl: null,
    flagUrl: null,
    persona: true,
    ...(personaType === undefined ? {} : { personaType }),
  },
  role: null,
  isVisitor: false,
  visitorRealm: null,
  contentHtml: "<p>hi</p>",
  reactions: {},
  createdAt: "2026-10-10T12:00:00.000Z",
  editedAt: null,
  replyTo: null,
  continued: null,
});

describe("toCachedMessage persona type", () => {
  it("keeps the persona type a live message carries", () => {
    expect(toCachedMessage(live("media"), undefined, false).author.personaType).toBe("media");
  });

  it("reads a payload from a server that sends none as no type", () => {
    expect(toCachedMessage(live(), undefined, false).author.personaType).toBeNull();
  });
});
