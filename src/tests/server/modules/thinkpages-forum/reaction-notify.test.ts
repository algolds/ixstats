/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  FORUM_NOTICE_SOURCE: "thinkpages-forum",
  sendForumNotices: jest.fn(async () => true),
}));
jest.mock("~/server/shared/user-blocks", () => ({
  recipientsBlockingSender: jest.fn(async (): Promise<string[]> => []),
}));

import {
  sendForumNotices,
  type ForumNotice,
} from "~/server/modules/thinkpages-forum/forum-notices";
import { notifyReaction } from "~/server/modules/thinkpages-forum/reaction-notify";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { postIn } from "~/tests/helpers/forum-board-fake";
import { reactionStore } from "~/tests/helpers/forum-reaction-fixtures";

const sent = jest.mocked(sendForumNotices);
const blocking = jest.mocked(recipientsBlockingSender);
/** u_member reacts; u_member2 owns p_hub, p_site and b1. */
const reactor = { id: "u_member", clerkUserId: "clerk_u_member" };

interface StoredNotice {
  id: string;
  userId: string;
  source: string;
  metadata: string;
}

/**
 * A notification table that remembers what was sent: `sendForumNotices` stores each notice the way the bell does
 * (metadata as JSON text) and `findFirst` answers from those rows, so a second call sees the first one's notice.
 */
function setup() {
  const store = reactionStore();
  const stored: StoredNotice[] = [];
  sent.mockImplementation(async (notices: readonly ForumNotice[]) => {
    for (const notice of notices) {
      stored.push({
        id: `n${stored.length + 1}`,
        userId: notice.clerkUserId,
        source: "thinkpages-forum",
        metadata: JSON.stringify(notice.metadata),
      });
    }
    return true;
  });
  const notification = {
    findFirst: jest.fn(
      async (args: {
        where: { userId: string; source: string; metadata: { contains: string } };
      }): Promise<{ id: string } | null> => {
        const { userId, source, metadata } = args.where;
        const hit = stored.find(
          (row) =>
            row.userId === userId &&
            row.source === source &&
            row.metadata.includes(metadata.contains)
        );
        return hit ? { id: hit.id } : null;
      }
    ),
  };
  return { store, stored, db: { ...store.db, notification } as never, notification };
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  sent.mockReset();
  blocking.mockReset();
  blocking.mockResolvedValue([]);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("notifyReaction", () => {
  it("tells the post's owner once, with the thread's title, a low priority and a dedupe key", async () => {
    const { db, notification } = setup();
    await notifyReaction(db, reactor, { postId: "p_hub" });
    expect(sent).toHaveBeenCalledWith([
      {
        clerkUserId: "clerk_u_member2",
        title: "member reacted to your post in Thread t_hub",
        message: "Message p_hub",
        href: "/thinkpages/post/p_hub",
        priority: "low",
        metadata: {
          kind: "reaction",
          postId: "p_hub",
          threadId: "t_hub",
          reactionKey: "p_hub:u_member",
        },
      },
    ]);
    expect(notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "clerk_u_member2",
        source: "thinkpages-forum",
        metadata: { contains: '"reactionKey":"p_hub:u_member"' },
      },
      select: { id: true },
    });
  });

  it("names the realm's board for a board message and the sitewide thread for a sitewide post", async () => {
    const { db } = setup();
    await notifyReaction(db, reactor, { postId: "b1" });
    const [[[board]]] = sent.mock.calls as never as [[[ForumNotice]]];
    expect(board).toMatchObject({
      title: "member reacted to your post in the Eurth board",
      href: "/thinkpages/post/b1",
      metadata: { postId: "b1", threadId: "t_board_r_eurth" },
    });
    await notifyReaction(db, reactor, { postId: "p_site" });
    const [, [[site]]] = sent.mock.calls as never as [unknown, [[ForumNotice]]];
    expect(site).toMatchObject({ title: "member reacted to your post in Thread t_site" });
  });

  it("tells a persona post's owner, naming the reactor only, never the persona or its player", async () => {
    const { db } = setup();
    await notifyReaction(db, reactor, { postId: "p_persona" });
    const [[[notice]]] = sent.mock.calls as never as [[[ForumNotice]]];
    expect(notice).toMatchObject({
      clerkUserId: "clerk_u_visitor",
      title: "member reacted to your post in Thread t_hub",
    });
    expect(JSON.stringify(notice)).not.toMatch(/pa_visitor|Aurora Wire|aurorawire/);
  });

  it("tells nobody when the reactor owns the post, or it has no author", async () => {
    const { db } = setup();
    await notifyReaction(
      db,
      { id: "u_member2", clerkUserId: "clerk_u_member2" },
      { postId: "p_hub" }
    );
    await notifyReaction(db, reactor, { postId: "p_import" });
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells nobody about an archive-imported post, even one that still has an author", async () => {
    const { db, store } = setup();
    postIn(store, "p_hub").sourceRef = "xf:post:1";
    await notifyReaction(db, reactor, { postId: "p_hub" });
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells nobody about a hidden post, a hidden thread or an unknown post", async () => {
    const { db } = setup();
    for (const postId of ["p_hidden", "p_hiddenthread", "b_hidden", "nope"]) {
      await notifyReaction(db, reactor, { postId });
    }
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells nobody who cannot read the post", async () => {
    const { db } = setup();
    await notifyReaction(db, reactor, { postId: "p_draft" });
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells nobody whose account is no longer active", async () => {
    const { db, store } = setup();
    store.state.users.find((user) => user.id === "u_member2")!.isActive = false;
    await notifyReaction(db, reactor, { postId: "p_hub" });
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells nobody who blocked the reactor", async () => {
    const { db } = setup();
    blocking.mockResolvedValue(["clerk_u_member2"]);
    await notifyReaction(db, reactor, { postId: "p_hub" });
    expect(blocking).toHaveBeenCalledWith(db, "clerk_u_member", ["clerk_u_member2"]);
    expect(sent).not.toHaveBeenCalled();
  });

  it("tells the owner once per reactor and post: a toggle off and on sends no second notice", async () => {
    const { db, stored } = setup();
    await notifyReaction(db, reactor, { postId: "p_hub" });
    // The reactor took the reaction back and added it again: the hook runs for the new row, the key ends it.
    await notifyReaction(db, reactor, { postId: "p_hub" });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(stored).toHaveLength(1);
  });

  it("tells the owner again for another reactor, and about another post by the same reactor", async () => {
    const { db, stored } = setup();
    await notifyReaction(db, reactor, { postId: "p_hub" });
    await notifyReaction(db, { id: "u_plain", clerkUserId: "clerk_u_plain" }, { postId: "p_hub" });
    await notifyReaction(db, reactor, { postId: "p_site" });
    expect(stored.map((row) => JSON.parse(row.metadata).reactionKey)).toEqual([
      "p_hub:u_member",
      "p_hub:u_plain",
      "p_site:u_member",
    ]);
  });

  it("does not throw when the lookup or the write fails", async () => {
    const { db, notification } = setup();
    notification.findFirst.mockRejectedValue(new Error("db down"));
    await expect(notifyReaction(db, reactor, { postId: "p_hub" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    notification.findFirst.mockResolvedValue(null);
    sent.mockResolvedValueOnce(false);
    await expect(notifyReaction(db, reactor, { postId: "p_hub" })).resolves.toBeUndefined();
  });
});
