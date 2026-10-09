/** @jest-environment node */
/**
 * The feed's old ThinkPages pages answer with redirects (phase 5). `/thinkpages/post/<id>` stays the forum post
 * permalink (ruling P5): a forum post the viewer may see goes to its thread and anchor, anything else to the feed
 * post under /dashboard. Both hops are temporary (307), since the answer depends on the viewer and on moderation
 * (ruling R-e). The page reads the Clerk session and asks as that viewer (P1), so a member's own report thread and
 * a moderator's hidden post resolve on the server, on the page the viewer's own thread view shows (P2). An id over
 * the input bound is not a forum post; other lookup failures surface. The other old pages moved for good (308), the
 * forum home's old address among them: the forum home is /thinkpages itself. The feed's moved pages keep the query
 * string they came with, re-encoded. Every destination is a fixed prefix plus an encoded id or realm.
 */
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  permanentRedirect: jest.fn((url: string) => {
    throw new Error(`permanent:${url}`);
  }),
  unstable_rethrow: jest.fn(),
}));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/server/db", () => ({
  db: {
    user: { findUnique: jest.fn() },
    realm: { findMany: jest.fn(), findUnique: jest.fn() },
    realmOfficer: { findMany: jest.fn() },
    forumCategoryModerator: { findMany: jest.fn() },
    forumPost: { findUnique: jest.fn(), count: jest.fn() },
  },
}));
jest.mock("~/components/thinkpages-forum/CategoryList", () => ({ CategoryList: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { auth } from "@clerk/nextjs/server";
import { permanentRedirect, redirect, unstable_rethrow } from "next/navigation";
import { db } from "~/server/db";
import LegacyPostPage from "~/app/thinkpages/post/[postId]/page";
import LegacyProfilePage from "~/app/thinkpages/profile/[username]/page";
import LegacySavedPage from "~/app/thinkpages/saved/page";
import LegacyFeedPage from "~/app/thinkpages/feed/page";
import LegacyThinkSharePage from "~/app/thinkpages/thinkshare/page";
import LegacyThinkTanksPage from "~/app/thinkpages/thinktanks/page";
import LegacyForumHomePage from "~/app/thinkpages/forum/page";
import ThinkPagesHomePage, { metadata as homeMetadata } from "~/app/thinkpages/page";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";

const mockRedirect = jest.mocked(redirect);
const mockPermanentRedirect = jest.mocked(permanentRedirect);
const mockUnstableRethrow = jest.mocked(unstable_rethrow);
const mockAuth = jest.mocked(auth);
const signedIn = (userId: string | null) =>
  mockAuth.mockResolvedValue({ userId } as Awaited<ReturnType<typeof auth>>);

const fakeDb = db as unknown as {
  user: { findUnique: jest.Mock };
  realm: { findMany: jest.Mock; findUnique: jest.Mock };
  realmOfficer: { findMany: jest.Mock };
  forumCategoryModerator: { findMany: jest.Mock };
  forumPost: { findUnique: jest.Mock; count: jest.Mock };
};

const general = { id: "cat_general", visibility: "public", scope: "site", realmId: null };
const reports = { id: "cat_reports", visibility: "reporter_staff", scope: "site", realmId: null };
const users = [
  { id: "u_member", clerkUserId: "member", countryId: "c1", role: { name: "user", level: 100 } },
  { id: "u_mod", clerkUserId: "mod", countryId: null, role: { name: "user", level: 100 } },
];

interface Row {
  id: string;
  hidden: boolean;
  createdAt: Date;
}
interface CountArgs {
  where: { hidden?: false; OR: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }] };
}

/** A thread of `rows` in `category`; `count` answers the resolver's "posts before this one" with the hidden rule. */
function seedThread(
  category: typeof general,
  rows: Row[],
  thread: { authorUserId: string | null; hidden: boolean } = { authorUserId: "u_other", hidden: false }
) {
  fakeDb.forumPost.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const row = rows.find((r) => r.id === where.id);
    return row ? { ...row, threadId: "t1", thread: { ...thread, category } } : null;
  });
  fakeDb.forumPost.count.mockImplementation(async ({ where }: CountArgs) => {
    const [{ createdAt: { lt } }] = where.OR;
    return rows.filter((r) => r.createdAt < lt && !(where.hidden === false && r.hidden)).length;
  });
}

/** `n` posts a minute apart; the ids in `hidden` are hidden. */
const postsOf = (n: number, hidden: ReadonlySet<number> = new Set()): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    hidden: hidden.has(i),
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReset();
  signedIn(null);
  fakeDb.user.findUnique.mockImplementation(
    async ({ where }: { where: { clerkUserId: string } }) =>
      users.find((u) => u.clerkUserId === where.clerkUserId) ?? null
  );
  fakeDb.realm.findMany.mockResolvedValue([]);
  fakeDb.realmOfficer.findMany.mockResolvedValue([]);
  fakeDb.forumCategoryModerator.findMany.mockImplementation(
    async ({ where }: { where: { userId: string } }) =>
      where.userId === "u_mod" ? [{ categoryId: "cat_general" }] : []
  );
  seedThread(general, postsOf(45));
});

const openPost = (postId: string) => LegacyPostPage({ params: Promise.resolve({ postId }) });

describe("/thinkpages/post/<id>", () => {
  it("sends a public forum post to its thread page and anchor when signed out (307)", async () => {
    await expect(openPost("p44")).rejects.toThrow("redirect:/thinkpages/t/t1?page=3#post-p44");
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("sends any other id to the feed post when signed out (307, not 308)", async () => {
    await expect(openPost("feed1")).rejects.toThrow("redirect:/dashboard/post/feed1");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("sends a signed-in member to their own Reports thread, and anyone else to the feed post", async () => {
    seedThread(reports, postsOf(3), { authorUserId: "u_member", hidden: false });
    signedIn("member");
    await expect(openPost("p2")).rejects.toThrow("redirect:/thinkpages/t/t1?page=1#post-p2");
    signedIn(null);
    await expect(openPost("p2")).rejects.toThrow("redirect:/dashboard/post/p2");
    signedIn("mod");
    await expect(openPost("p2")).rejects.toThrow("redirect:/dashboard/post/p2");
  });

  it("puts a moderator on the page their thread view shows, counting hidden posts; others never learn of a hidden post", async () => {
    // Six hidden posts among the first 22: a guest's page for p22 would be 1, the moderator's is 2.
    seedThread(general, postsOf(30, new Set([2, 4, 6, 8, 10, 12, 22])));
    signedIn("mod");
    await expect(openPost("p22")).rejects.toThrow("redirect:/thinkpages/t/t1?page=2#post-p22");
    await expect(openPost("p23")).rejects.toThrow("redirect:/thinkpages/t/t1?page=2#post-p23");
    signedIn("member");
    await expect(openPost("p22")).rejects.toThrow("redirect:/dashboard/post/p22");
    await expect(openPost("p23")).rejects.toThrow("redirect:/thinkpages/t/t1?page=1#post-p23");
  });

  it("treats a signed-in user without a user row like a guest", async () => {
    seedThread(reports, postsOf(3), { authorUserId: "u_member", hidden: false });
    signedIn("stranger");
    await expect(openPost("p1")).rejects.toThrow("redirect:/dashboard/post/p1");
  });

  it("falls back to the feed post for an id over the input bound, without a lookup", async () => {
    const long = "x".repeat(65);
    await expect(openPost(long)).rejects.toThrow(`redirect:/dashboard/post/${long}`);
    expect(fakeDb.forumPost.findUnique).not.toHaveBeenCalled();
  });

  it("lets a failed lookup through instead of guessing the post is a feed post", async () => {
    const error = new Error("db down");
    fakeDb.forumPost.findUnique.mockRejectedValue(error);
    await expect(openPost("p1")).rejects.toBe(error);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("treats a failed session read as signed out", async () => {
    seedThread(reports, postsOf(3), { authorUserId: "u_member", hidden: false });
    const error = new Error("no clerk");
    mockAuth.mockRejectedValue(error);
    await expect(openPost("p1")).rejects.toThrow("redirect:/dashboard/post/p1");
    expect(mockUnstableRethrow).toHaveBeenCalledWith(error);
  });

  it("encodes the ids on both paths", async () => {
    seedThread(general, [{ id: "a b/c", hidden: false, createdAt: new Date() }]);
    await expect(openPost("a b/c")).rejects.toThrow(
      "redirect:/thinkpages/t/t1?page=1#post-a%20b%2Fc"
    );
    await expect(openPost("d e/f")).rejects.toThrow("redirect:/dashboard/post/d%20e%2Ff");
  });
});

type Query = Record<string, string | string[] | undefined>;
const query = (q: Query) => ({ searchParams: Promise.resolve(q) });
const openProfile = (username: string, q: Query = {}) =>
  LegacyProfilePage({ params: Promise.resolve({ username }), ...query(q) });

describe("the feed's other old pages (308)", () => {
  it("a persona profile moves under /dashboard, encoded", async () => {
    await expect(openProfile("jane doe")).rejects.toThrow(
      "permanent:/dashboard/profile/jane%20doe"
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it.each<[string, (q: Query) => Promise<void>, string]>([
    ["profile/jane", (q) => openProfile("jane", q), "/dashboard/profile/jane"],
    ["saved", (q) => LegacySavedPage(query(q)), "/dashboard/saved"],
    ["feed", (q) => LegacyFeedPage(query(q)), "/dashboard"],
  ])("/thinkpages/%s keeps the query string it came with", async (_name, open, target) => {
    await expect(open({})).rejects.toThrow(new Error(`permanent:${target}`));
    await expect(open({ tab: "trending" })).rejects.toThrow(
      new Error(`permanent:${target}?tab=trending`)
    );
    await expect(open({ tag: ["a", "b"], empty: undefined })).rejects.toThrow(
      new Error(`permanent:${target}?tag=a&tag=b`)
    );
    // A value cannot add a parameter or a fragment of its own.
    await expect(open({ q: "x&admin=1#y" })).rejects.toThrow(
      new Error(`permanent:${target}?q=x%26admin%3D1%23y`)
    );
  });

  it.each([
    ["thinkshare", LegacyThinkSharePage, "/messages"],
    ["thinktanks", LegacyThinkTanksPage, "/thinktanks"],
  ])("/thinkpages/%s goes to its new home", (_name, Page, target) => {
    expect(() => Page()).toThrow(`permanent:${target}`);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

type RealmParam = string | string[] | undefined;
const realmParams = (realm: RealmParam) => ({ searchParams: Promise.resolve({ realm }) });

describe("/thinkpages is the forum home", () => {
  it.each<[RealmParam, string | undefined]>([
    ["eurth", "eurth"],
    [["x", "y"], "x"],
    ["", undefined],
    [undefined, undefined],
  ])("opens the realm section from ?realm=%j", async (realm, expected) => {
    const page = await ThinkPagesHomePage(realmParams(realm));
    expect(page.type).toBe(CategoryList);
    expect(page.props).toEqual({ realm: expected });
  });

  it("is titled ThinkPages", () => {
    expect(homeMetadata.title).toBe("ThinkPages - IxStats");
  });
});

describe("/thinkpages/forum moves to /thinkpages (308)", () => {
  it.each<[RealmParam, string]>([
    [undefined, "/thinkpages"],
    ["", "/thinkpages"],
    ["eurth", "/thinkpages?realm=eurth"],
    [["x", "y"], "/thinkpages?realm=x"],
    ["a&b=c", "/thinkpages?realm=a%26b%3Dc"],
  ])("?realm=%j goes to %s", async (realm, target) => {
    await expect(LegacyForumHomePage(realmParams(realm))).rejects.toThrow(`permanent:${target}`);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
