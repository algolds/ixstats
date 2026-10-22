/** @jest-environment node */
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import type { BoardMessage } from "~/server/modules/thinkpages-forum/board-messages";
import {
  boardMessagePayload,
  publishBoardPost,
} from "~/server/modules/thinkpages-forum/board-live";
import {
  boardTypingName,
  canJoinRealmBoard,
  canTypeOnBoard,
} from "~/server/modules/thinkpages-forum/board-socket";
import {
  at,
  ban,
  boardPost,
  boardStore,
  personas,
  seed,
  users,
} from "~/tests/helpers/forum-board-fake";
import {
  boardLiveEventSchema,
  boardLiveMessageSchema,
  type BoardLiveMessage,
} from "~/lib/thinkpages-forum/board-live";

const broadcaster = () => ({ broadcastBoard: jest.fn<void, [BoardLiveEvent]>() });

const message = (extra: Partial<BoardMessage> = {}): BoardMessage => ({
  id: "p1",
  authorUserId: "u_member",
  authorPersonaId: null,
  importedAuthorName: null,
  author: {
    name: "member",
    handle: "member",
    avatarUrl: null,
    flagUrl: null,
    persona: false,
    personaType: null,
  },
  role: null,
  isVisitor: false,
  visitorRealm: null,
  contentHtml: "<p>hi</p>",
  createdAt: at(1),
  editedAt: null,
  reactions: {},
  myReaction: null,
  byViewer: true,
  canEdit: true,
  replyTo: null,
  continued: null,
  ...extra,
});

describe("boardMessagePayload", () => {
  it("never carries a moderator's verdicts", () => {
    const payload = boardMessagePayload(message({ moderable: true, sanctionable: true }));
    expect(JSON.stringify(payload)).not.toMatch(/moderable|sanctionable/);
  });

  it("is the persona-safe public shape: no viewer flags, ISO times", () => {
    expect(boardMessagePayload(message({ editedAt: at(2) }))).toEqual({
      type: "updated",
      message: {
        id: "p1",
        authorUserId: "u_member",
        authorPersonaId: null,
        importedAuthorName: null,
        author: {
          name: "member",
          handle: "member",
          avatarUrl: null,
          flagUrl: null,
          persona: false,
          personaType: null,
        },
        role: null,
        isVisitor: false,
        visitorRealm: null,
        contentHtml: "<p>hi</p>",
        reactions: {},
        createdAt: at(1).toISOString(),
        editedAt: at(2).toISOString(),
        replyTo: null,
        continued: null,
      },
    });
  });

  it("never carries the player behind a persona, even from a moderator's shape", () => {
    const persona = message({
      authorPersonaId: "pa_news",
      authorUserId: "u_member",
      author: {
        name: "Eurth Daily",
        handle: "eurthdaily",
        avatarUrl: null,
        flagUrl: null,
        persona: true,
        personaType: "media",
      },
      hidden: false,
    });
    const payload = boardMessagePayload(persona);
    expect(payload.type === "updated" && payload.message.authorUserId).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("u_member");
  });
});

const eurth = (posts = [boardPost("p1", 1)], threads: object[] = []) => {
  const base = seed();
  return boardStore(seed({ posts, threads: [...(base.threads ?? []), ...threads] as never }));
};

describe("publishBoardPost", () => {
  it("shows a persona whose account is gone as a bare persona, never its player", async () => {
    const store = eurth([
      boardPost("p1", 1, { authorPersonaId: "pa_gone", authorUserId: "u_member" }),
    ]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "message");
    const event = out.broadcastBoard.mock.calls[0]![0];
    expect(event.type === "board:message" && event.message.author).toMatchObject({
      name: "Persona",
      handle: null,
      avatarUrl: null,
      flagUrl: null,
      persona: true,
      personaType: null,
    });
    const wire = JSON.stringify(event);
    expect(wire).not.toContain("u_member");
    expect(wire).not.toContain("flags.example");
  });
  it("never broadcasts a hidden message: a hide is a removal, a new hidden one is nothing", async () => {
    const store = eurth([boardPost("p1", 1, { hidden: true, contentHtml: "<p>secret</p>" })]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "updated");
    expect(out.broadcastBoard.mock.calls[0]![0]).toEqual({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "removed", postId: "p1" },
    });
    await publishBoardPost(store.db as never, out, "p1", "message");
    expect(out.broadcastBoard).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(out.broadcastBoard.mock.calls)).not.toContain("secret");
  });

  it("shows a continued link only as the public may see it", async () => {
    const restricted = {
      id: "t_staff",
      categoryId: "cat_staff",
      title: "Staff only talk",
      authorUserId: "u_member",
      postCount: 3,
      hidden: false,
    };
    const base = seed();
    const store = boardStore(
      seed({
        categories: [
          ...(base.categories ?? []),
          { ...(base.categories ?? [])[1]!, id: "cat_staff", key: "staff", visibility: "staff" },
        ],
        posts: [boardPost("p1", 1, { continuedThreadId: "t_staff" })],
        threads: [...(base.threads ?? []), restricted] as never,
      })
    );
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "message");
    const wire = JSON.stringify(out.broadcastBoard.mock.calls[0]![0]);
    expect(wire).not.toContain("Staff only talk");
    expect(wire).toContain("Continued in a thread");
  });
  it("never fails the write: a throwing broadcaster or database is logged", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = eurth();
    const broken = {
      broadcastBoard: jest.fn(() => {
        throw new Error("redis down");
      }),
    };
    await expect(
      publishBoardPost(store.db as never, broken, "p1", "message")
    ).resolves.toBeUndefined();
    store.db.forumPost.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(
      publishBoardPost(store.db as never, broadcaster(), "p1", "message")
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
describe("canJoinRealmBoard", () => {
  const db = () =>
    boardStore(
      seed({
        users: [
          ...users,
          { id: "u_df", clerkUserId: "draft_founder", role: { name: "user", level: 100 } },
        ],
      })
    ).db as never;
  it("refuses a draft realm to the public and members, admits its founder and site admins", async () => {
    await expect(canJoinRealmBoard(db(), null, "r_draft")).resolves.toBe(false);
    await expect(canJoinRealmBoard(db(), "clerk_u_member", "r_draft")).resolves.toBe(false);
    await expect(canJoinRealmBoard(db(), "draft_founder", "r_draft")).resolves.toBe(true);
    await expect(canJoinRealmBoard(db(), "clerk_u_admin", "r_draft")).resolves.toBe(true);
  });
});

describe("boardTypingName", () => {
  const db = () => eurth().db as never;
  it("names the persona, not the player, for the player's own persona", async () => {
    await expect(boardTypingName(db(), "clerk_u_member", "pa_news")).resolves.toBe("Eurth Daily");
  });

  it("gives no name for the personal account named as a persona", async () => {
    const store = boardStore(seed(), {
      personas: [
        ...personas,
        {
          id: "pa_me",
          clerkUserId: "clerk_u_member",
          isActive: true,
          accountType: "personal",
          displayName: "Me",
        },
      ],
    });
    await expect(boardTypingName(store.db as never, "clerk_u_member", "pa_me")).resolves.toBeNull();
  });

  it("drops a persona that is not the user's own, or an unknown user", async () => {
    await expect(boardTypingName(db(), "clerk_u_member", "pa_visitor")).resolves.toBeNull();
    await expect(boardTypingName(db(), "clerk_nobody", null)).resolves.toBeNull();
  });
});

describe("canTypeOnBoard", () => {
  const store = () => {
    const s = eurth();
    s.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
    return s;
  };
  it("is false for a banned user", async () => {
    await expect(canTypeOnBoard(store().db as never, "clerk_u_banned", "r_eurth")).resolves.toBe(
      false
    );
  });
  it("is false in an archived realm, for an unknown user and for an unknown realm", async () => {
    const { db } = store();
    await expect(canTypeOnBoard(db as never, "clerk_u_member", "r_old")).resolves.toBe(false);
    await expect(canTypeOnBoard(db as never, "clerk_nobody", "r_eurth")).resolves.toBe(false);
    await expect(canTypeOnBoard(db as never, "clerk_u_member", "r_nope")).rejects.toBeDefined();
  });
});

describe("the live event schema", () => {
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
      expect(
        boardLiveEventSchema.safeParse({ type: "board:presence", realmId: "r1" }).success
      ).toBe(false);
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
});
