/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  sendForumNotices: jest.fn(async () => true),
  forumNoticesEnabled: jest.fn(async () => true),
}));
jest.mock("~/server/shared/user-blocks", () => ({
  recipientsBlockingSender: jest.fn(async (): Promise<string[]> => []),
}));

import {
  forumNoticesEnabled,
  sendForumNotices,
} from "~/server/modules/thinkpages-forum/forum-notices";
import {
  notifyWatchers,
  type WatchNoticeInput,
} from "~/server/modules/thinkpages-forum/watch-notify";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";

const sent = jest.mocked(sendForumNotices);
const enabled = jest.mocked(forumNoticesEnabled);
const blocking = jest.mocked(recipientsBlockingSender);

const role = { name: "user", level: 100 };
const watcher = (n: number) => ({
  id: `u_w${n}`,
  clerkUserId: `clerk_w${n}`,
  countryId: null,
  role,
});
const general = { id: "cat", scope: "site", realmId: null, visibility: "public" };
const input = (over: Partial<WatchNoticeInput> = {}): WatchNoticeInput => ({
  actorId: "u_actor",
  actorClerkUserId: "clerk_actor",
  postId: "p1",
  threadId: "t1",
  threadTitle: "Trade talks",
  name: "actorhandle",
  excerpt: "hello",
  place: { thread: { authorUserId: "u_other", hidden: false }, category: general, realm: null },
  handled: new Set(),
  ...over,
});

interface WatchWhere {
  notifiedAt?: Date | null;
  userId: { gt?: string; not?: string; in?: string[] };
}
interface Claim {
  where: WatchWhere;
  data: { notifiedAt: Date | null };
}
function watchDb(opts: { pages: string[][]; claimCount?: number; owned?: string[] }) {
  const pages = [...opts.pages];
  const everyone = opts.pages.flat().map((id) => watcher(Number(id.slice(3))));
  return {
    forumThreadWatch: {
      findMany: jest.fn(async ({ where }: { where: WatchWhere }) =>
        where.notifiedAt === null
          ? (pages.shift() ?? []).map((userId) => ({ userId }))
          : (opts.owned ?? []).map((userId) => ({ userId }))
      ),
      updateMany: jest.fn(async ({ where }: Claim) => ({
        count: opts.claimCount ?? where.userId.in!.length,
      })),
    },
    user: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        everyone.filter((u) => where.id.in.includes(u.id))
      ),
    },
    realm: { findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  };
}

beforeEach(() => {
  sent.mockReset();
  sent.mockResolvedValue(true);
  blocking.mockReset();
  blocking.mockResolvedValue([]);
  enabled.mockReset();
  enabled.mockResolvedValue(true);
});

describe("notifyWatchers", () => {
  it("asks for the thread's un-notified watchers except the author, in chunks by user id", async () => {
    const db = watchDb({ pages: [[]] });
    await notifyWatchers(db as never, input());
    expect(db.forumThreadWatch.findMany).toHaveBeenCalledWith({
      where: { threadId: "t1", notifiedAt: null, userId: { gt: "", not: "u_actor" } },
      orderBy: { userId: "asc" },
      take: 500,
      select: { userId: true },
    });
    expect(sent).not.toHaveBeenCalled();
  });

  it("claims every watcher who can read the thread, and tells those not already told or blocking the author", async () => {
    blocking.mockResolvedValue(["clerk_w3"]);
    const db = watchDb({ pages: [["u_w1", "u_w2", "u_w3"]] });
    await expect(notifyWatchers(db as never, input({ handled: new Set(["u_w2"]) }))).resolves.toBe(
      1
    );
    const claim = db.forumThreadWatch.updateMany.mock.calls[0]![0];
    expect(claim.where).toEqual({
      threadId: "t1",
      userId: { in: ["u_w1", "u_w2", "u_w3"] },
      notifiedAt: null,
    });
    expect(claim.data.notifiedAt).toBeInstanceOf(Date);
    expect(sent).toHaveBeenCalledWith([
      {
        clerkUserId: "clerk_w1",
        title: "New reply in Trade talks",
        message: "actorhandle: hello",
        href: "/thinkpages/post/p1",
        priority: "low",
        metadata: { kind: "watch", postId: "p1", threadId: "t1" },
      },
    ]);
  });

  it("tells only the watchers whose claim this reply won when a second reply raced", async () => {
    const db = watchDb({ pages: [["u_w1", "u_w2", "u_w3"]], claimCount: 1, owned: ["u_w2"] });
    await notifyWatchers(db as never, input());
    expect(sent.mock.calls[0]![0].map((n) => n.clerkUserId)).toEqual(["clerk_w2"]);
    const reread = db.forumThreadWatch.findMany.mock.calls[1]![0];
    expect(reread.where.notifiedAt).toBeInstanceOf(Date);
  });

  it("gives the claims back when the notices cannot be written", async () => {
    sent.mockResolvedValue(false);
    const db = watchDb({ pages: [["u_w1"]] });
    await expect(notifyWatchers(db as never, input())).resolves.toBe(0);
    const [claim, release] = db.forumThreadWatch.updateMany.mock.calls.map(([args]) => args);
    expect(release!.data).toEqual({ notifiedAt: null });
    expect(release!.where.notifiedAt).toEqual(claim!.data.notifiedAt);
  });

  it("gives back only the claims of watchers who were to be told, not those already told or blocking the author", async () => {
    sent.mockResolvedValue(false);
    blocking.mockResolvedValue(["clerk_w3"]);
    const db = watchDb({ pages: [["u_w1", "u_w2", "u_w3"]] });
    await expect(notifyWatchers(db as never, input({ handled: new Set(["u_w2"]) }))).resolves.toBe(
      0
    );
    const [claim, release] = db.forumThreadWatch.updateMany.mock.calls.map(([args]) => args);
    expect(claim!.where.userId.in).toEqual(["u_w1", "u_w2", "u_w3"]);
    expect(release!.where.userId.in).toEqual(["u_w1"]);
  });

  it("gives nothing back when every claimed watcher was settled by the claim", async () => {
    sent.mockResolvedValue(false);
    const db = watchDb({ pages: [["u_w1"]] });
    await notifyWatchers(db as never, input({ handled: new Set(["u_w1"]) }));
    expect(db.forumThreadWatch.updateMany).toHaveBeenCalledTimes(1);
  });

  it("claims nothing and reads nothing when the admin has switched forum notices off", async () => {
    enabled.mockResolvedValue(false);
    const db = watchDb({ pages: [["u_w1"]] });
    await expect(notifyWatchers(db as never, input())).resolves.toBe(0);
    expect(db.forumThreadWatch.findMany).not.toHaveBeenCalled();
    expect(db.forumThreadWatch.updateMany).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
  });

  it("leaves watchers who cannot read the thread unclaimed", async () => {
    const staff = { ...general, visibility: "staff" };
    const db = watchDb({ pages: [["u_w1"]] });
    await notifyWatchers(db as never, input({ place: { ...input().place, category: staff } }));
    expect(db.forumThreadWatch.updateMany).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
  });

  it("walks a long watch list chunk by chunk from the last user id", async () => {
    const first = Array.from({ length: 500 }, (_, i) => `u_w${i + 1}`);
    const db = watchDb({ pages: [first, ["u_w501"]] });
    await notifyWatchers(db as never, input());
    const second = db.forumThreadWatch.findMany.mock.calls[1]![0];
    expect(second.where.userId.gt).toBe("u_w500");
  });
});
