/** @jest-environment node */
/**
 * The feed's old ThinkPages pages answer with redirects (phase 5). `/thinkpages/post/<id>` stays the forum post
 * permalink (ruling P5): a forum post the viewer may see goes to its thread and anchor, anything else to the feed
 * post under /dashboard. Both hops are temporary (307), since the answer depends on the viewer and on moderation
 * (ruling R-e). The server asks as a guest, so a signed-in viewer it did not place gets the client gate, which asks
 * again with their session. Only an id the input schema rejects counts as "not a forum post"; other lookup failures
 * surface. The other old pages moved for good (308), the forum home's old address among them: the forum home is
 * /thinkpages itself. The feed's moved pages keep the query string they came with, re-encoded. Every destination is
 * a fixed prefix plus an encoded id or realm.
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
jest.mock("~/components/thinkpages-forum/ForumPermalinkGate", () => ({
  ForumPermalinkGate: jest.fn(() => null),
}));
jest.mock("~/trpc/server", () => ({
  api: { thinkpagesForum: { resolvePost: jest.fn() } },
}));
jest.mock("~/components/thinkpages-forum/CategoryList", () => ({ CategoryList: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { isValidElement } from "react";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { permanentRedirect, redirect, unstable_rethrow } from "next/navigation";
import { ForumPermalinkGate } from "~/components/thinkpages-forum/ForumPermalinkGate";
import { api } from "~/trpc/server";
import LegacyPostPage from "~/app/thinkpages/post/[postId]/page";
import LegacyProfilePage from "~/app/thinkpages/profile/[username]/page";
import LegacySavedPage from "~/app/thinkpages/saved/page";
import LegacyFeedPage from "~/app/thinkpages/feed/page";
import LegacyThinkSharePage from "~/app/thinkpages/thinkshare/page";
import LegacyThinkTanksPage from "~/app/thinkpages/thinktanks/page";
import LegacyForumHomePage from "~/app/thinkpages/forum/page";
import ThinkPagesHomePage, { metadata as homeMetadata } from "~/app/thinkpages/page";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";

const resolvePost = jest.mocked(api.thinkpagesForum.resolvePost);
const mockRedirect = jest.mocked(redirect);
const mockPermanentRedirect = jest.mocked(permanentRedirect);
const mockUnstableRethrow = jest.mocked(unstable_rethrow);
const mockAuth = jest.mocked(auth);
const signedIn = (userId: string | null) =>
  mockAuth.mockResolvedValue({ userId } as Awaited<ReturnType<typeof auth>>);

beforeEach(() => {
  resolvePost.mockReset();
  mockRedirect.mockClear();
  mockPermanentRedirect.mockClear();
  mockUnstableRethrow.mockClear();
  mockAuth.mockReset();
  signedIn(null);
});

const openPost = (postId: string) => LegacyPostPage({ params: Promise.resolve({ postId }) });

describe("/thinkpages/post/<id>", () => {
  it("sends a forum post the viewer may see to its thread page and anchor (307)", async () => {
    resolvePost.mockResolvedValue({ threadId: "t1", page: 3 });
    await expect(openPost("p1")).rejects.toThrow("redirect:/thinkpages/t/t1?page=3#post-p1");
    expect(resolvePost).toHaveBeenCalledWith({ postId: "p1" });
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("sends any other id to the feed post when signed out (307, not 308)", async () => {
    resolvePost.mockResolvedValue(null);
    await expect(openPost("p1")).rejects.toThrow("redirect:/dashboard/post/p1");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("falls back to the feed post for an id the input schema rejects (BAD_REQUEST)", async () => {
    resolvePost.mockRejectedValue(new TRPCError({ code: "BAD_REQUEST", message: "too long" }));
    await expect(openPost("p1")).rejects.toThrow("redirect:/dashboard/post/p1");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it.each([
    ["a server error", new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "db down" })],
    ["a plain error", new Error("db down")],
  ])("lets %s through instead of guessing the post is a feed post", async (_name, error) => {
    resolvePost.mockRejectedValue(error);
    await expect(openPost("p1")).rejects.toBe(error);
    expect(mockUnstableRethrow).toHaveBeenCalledWith(error);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("hands a signed-in viewer's unplaced id to the client gate instead of the feed", async () => {
    signedIn("user_1");
    resolvePost.mockResolvedValue(null);
    const page = await openPost("p1");
    expect(isValidElement<{ postId: string }>(page)).toBe(true);
    expect(page).toMatchObject({ type: ForumPermalinkGate, props: { postId: "p1" } });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("still sends a signed-in viewer straight to a post the server placed", async () => {
    signedIn("user_1");
    resolvePost.mockResolvedValue({ threadId: "t1", page: 2 });
    await expect(openPost("p1")).rejects.toThrow("redirect:/thinkpages/t/t1?page=2#post-p1");
  });

  it("treats a failed session read as signed out", async () => {
    mockAuth.mockRejectedValue(new Error("no clerk"));
    resolvePost.mockResolvedValue(null);
    await expect(openPost("p1")).rejects.toThrow("redirect:/dashboard/post/p1");
  });

  it("encodes the ids on both paths", async () => {
    resolvePost.mockResolvedValue({ threadId: "t 1/x", page: 1 });
    await expect(openPost("a b/c")).rejects.toThrow(
      "redirect:/thinkpages/t/t%201%2Fx?page=1#post-a%20b%2Fc"
    );
    expect(resolvePost).toHaveBeenCalledWith({ postId: "a b/c" });

    resolvePost.mockResolvedValue(null);
    await expect(openPost("a b/c")).rejects.toThrow("redirect:/dashboard/post/a%20b%2Fc");
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

  it.each<[string, (q: Query) => Promise<never>, string]>([
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
