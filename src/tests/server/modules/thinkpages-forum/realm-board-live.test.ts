/** @jest-environment node */
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import type { BoardMessage } from "~/server/modules/thinkpages-forum/board-messages";
import {
  boardMessagePayload,
  publishBoardPost,
  publishBoardRemoval,
  publishBoardSettings,
} from "~/server/modules/thinkpages-forum/board-live";
import { boardTypingName, canJoinRealmBoard } from "~/server/modules/thinkpages-forum/board-socket";
import { at, boardPost, boardStore, seed, users } from "~/tests/helpers/forum-board-fake";

const broadcaster = () => ({ broadcastBoard: jest.fn<void, [BoardLiveEvent]>() });

const message = (extra: Partial<BoardMessage> = {}): BoardMessage => ({
  id: "p1",
  authorUserId: "u_member",
  authorPersonaId: null,
  importedAuthorName: null,
  author: { name: "member", handle: "member", avatarUrl: null, flagUrl: null, persona: false },
  role: null,
  isVisitor: false,
  visitorRealm: null,
  contentHtml: "<p>hi</p>",
  createdAt: at(1),
  editedAt: null,
  byViewer: true,
  canEdit: true,
  replyTo: null,
  continued: null,
  ...extra,
});

describe("boardMessagePayload", () => {
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
        },
        role: null,
        isVisitor: false,
        visitorRealm: null,
        contentHtml: "<p>hi</p>",
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
      },
      hidden: false,
    });
    const payload = boardMessagePayload(persona);
    expect(payload.type === "updated" && payload.message.authorUserId).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("u_member");
  });

  it("turns a hidden message into a removal that names only the post", () => {
    expect(boardMessagePayload(message({ hidden: true }))).toEqual({
      type: "removed",
      postId: "p1",
    });
  });
});

const eurth = (posts = [boardPost("p1", 1)], threads: object[] = []) => {
  const base = seed();
  return boardStore(seed({ posts, threads: [...(base.threads ?? []), ...threads] as never }));
};

describe("publishBoardPost", () => {
  it("publishes a new message to the realm's room as the public shape", async () => {
    const store = eurth([boardPost("p1", 1, { replyToPostId: null })]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "message");
    expect(out.broadcastBoard).toHaveBeenCalledTimes(1);
    const event = out.broadcastBoard.mock.calls[0]![0];
    expect(event).toMatchObject({ type: "board:message", realmId: "r_eurth" });
    expect(event.type === "board:message" && event.message).toMatchObject({
      id: "p1",
      contentHtml: "<p>Message p1</p>",
    });
    const wire = JSON.stringify(event);
    for (const leaked of ["byViewer", "canEdit", "hidden"]) expect(wire).not.toContain(leaked);
  });

  it("does not unmask a persona", async () => {
    const store = eurth([
      boardPost("p1", 1, { authorPersonaId: "pa_news", authorUserId: "u_member" }),
    ]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "message");
    const wire = JSON.stringify(out.broadcastBoard.mock.calls[0]![0]);
    expect(wire).toContain("Eurth Daily");
    expect(wire).not.toContain("u_member");
    expect(wire).not.toContain("flags.example");
    expect(wire).not.toContain('handle":"member');
  });

  it("sends an update as an updated message", async () => {
    const store = eurth([boardPost("p1", 1, { editedAt: at(3) })]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "updated");
    expect(out.broadcastBoard.mock.calls[0]![0]).toMatchObject({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "updated", message: { id: "p1", editedAt: at(3).toISOString() } },
    });
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

  it("ignores a post outside any board and an unknown post", async () => {
    const hub = { id: "t_hub", categoryId: "cat_r_eurth_hub", title: "Hub thread", hidden: false };
    const store = eurth([boardPost("p1", 1, { threadId: "t_hub" })], [hub]);
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "p1", "message");
    await publishBoardPost(store.db as never, out, "nope", "message");
    expect(out.broadcastBoard).not.toHaveBeenCalled();
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

describe("publishBoardRemoval and publishBoardSettings", () => {
  it("removes a post from the room", () => {
    const out = broadcaster();
    publishBoardRemoval(out, "r_eurth", "p1");
    expect(out.broadcastBoard).toHaveBeenCalledWith({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "removed", postId: "p1" },
    });
  });

  it("sends the new settings and swallows a broadcaster failure", () => {
    const out = broadcaster();
    publishBoardSettings(out, "r_eurth", { visitorsAllowed: false, slowModeSeconds: 30 });
    expect(out.broadcastBoard).toHaveBeenCalledWith({
      type: "board:settings",
      realmId: "r_eurth",
      settings: { visitorsAllowed: false, slowModeSeconds: 30 },
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() =>
      publishBoardSettings(
        {
          broadcastBoard: () => {
            throw new Error("down");
          },
        },
        "r_eurth",
        { visitorsAllowed: true, slowModeSeconds: 0 }
      )
    ).not.toThrow();
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

  it("lets anyone, signed in or not, join a visible realm", async () => {
    for (const realmId of ["r_eurth", "r_aurora", "r_old"]) {
      await expect(canJoinRealmBoard(db(), null, realmId)).resolves.toBe(true);
      await expect(canJoinRealmBoard(db(), "clerk_u_member", realmId)).resolves.toBe(true);
    }
  });

  it("joins IxWorld even without a realm row", async () => {
    await expect(canJoinRealmBoard(db(), null, "default")).resolves.toBe(true);
  });

  it("refuses a draft realm to the public and members, admits its founder and site admins", async () => {
    await expect(canJoinRealmBoard(db(), null, "r_draft")).resolves.toBe(false);
    await expect(canJoinRealmBoard(db(), "clerk_u_member", "r_draft")).resolves.toBe(false);
    await expect(canJoinRealmBoard(db(), "draft_founder", "r_draft")).resolves.toBe(true);
    await expect(canJoinRealmBoard(db(), "clerk_u_admin", "r_draft")).resolves.toBe(true);
  });

  it("refuses an unknown realm", async () => {
    await expect(canJoinRealmBoard(db(), null, "r_nope")).resolves.toBe(false);
  });
});

describe("boardTypingName", () => {
  const db = () => eurth().db as never;

  it("names a player by their public handle", async () => {
    await expect(boardTypingName(db(), "clerk_u_member", null)).resolves.toBe("member");
  });

  it("names the persona, not the player, for the player's own persona", async () => {
    await expect(boardTypingName(db(), "clerk_u_member", "pa_news")).resolves.toBe("Eurth Daily");
  });

  it("drops a persona that is not the user's own, or an unknown user", async () => {
    await expect(boardTypingName(db(), "clerk_u_member", "pa_visitor")).resolves.toBeNull();
    await expect(boardTypingName(db(), "clerk_nobody", null)).resolves.toBeNull();
  });
});
