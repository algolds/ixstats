/** @jest-environment node */
/**
 * Phase 4b: the XenForo bridge is gone and every /forum/* page is a permanent redirect (308, `permanentRedirect`)
 * to the native forum, resolved through the import's id map. Unknown or unreadable ids land on the forum home
 * (the module decides; here it is faked).
 */
class RouteSignal extends Error {}
const mockPermanentRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`permanent:${url}`);
});
const mockRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`temporary:${url}`);
});
jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
  redirect: (url: string) => mockRedirect(url),
}));

const mockConnection = jest.fn(() => Promise.resolve());
jest.mock("next/server", () => ({ connection: () => mockConnection() }));

const mockRedirectFor = jest.fn();
jest.mock("~/server/modules/thinkpages-forum", () => ({
  legacyForumRedirectFor: (db: object, ref: object) => mockRedirectFor(db, ref),
}));
jest.mock("~/server/db", () => ({ __esModule: true, db: { marker: "db" } }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import ForumHomePage from "~/app/(forum)/forum/page";
import ForumThreadListPage from "~/app/(forum)/forum/[forumId]/page";
import ThreadPage from "~/app/(forum)/forum/thread/[threadId]/page";
import MemberProfilePage from "~/app/(forum)/forum/members/[userId]/page";
import NewThreadPage from "~/app/(forum)/forum/new-thread/page";
import ForumSearchPage from "~/app/(forum)/forum/search/page";
import ForumStashesPage from "~/app/(forum)/forum/bookmarks/page";
import LegacyPostPage from "~/app/(forum)/forum/post/[postId]/page";

const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

interface PageCase {
  name: string;
  render: () => Promise<void>;
  ref: object;
}

const CASES: PageCase[] = [
  { name: "/forum", render: () => ForumHomePage(), ref: { kind: "home" } },
  {
    name: "/forum/[forumId]",
    render: () => ForumThreadListPage(params({ forumId: "12" })),
    ref: { kind: "forum", nodeId: 12 },
  },
  {
    name: "/forum/thread/[threadId]",
    render: () => ThreadPage(params({ threadId: "123" })),
    ref: { kind: "thread", threadId: 123 },
  },
  {
    name: "/forum/post/[postId]",
    render: () => LegacyPostPage(params({ postId: "456" })),
    ref: { kind: "post", postId: 456 },
  },
  {
    name: "/forum/members/[userId]",
    render: () => MemberProfilePage(params({ userId: "7" })),
    ref: { kind: "member", userId: 7 },
  },
  { name: "/forum/new-thread", render: () => NewThreadPage(), ref: { kind: "other" } },
  { name: "/forum/search", render: () => ForumSearchPage(), ref: { kind: "other" } },
  { name: "/forum/bookmarks", render: () => ForumStashesPage(), ref: { kind: "other" } },
];

beforeEach(() => {
  mockPermanentRedirect.mockClear();
  mockRedirect.mockClear();
  mockConnection.mockClear();
  mockRedirectFor.mockReset().mockResolvedValue("/thinkpages/t/t_native");
});

describe.each(CASES)("$name", ({ render, ref }) => {
  it("permanently redirects (308) to the resolved native page", async () => {
    await expect(render()).rejects.toThrow("permanent:/thinkpages/t/t_native");
    expect(mockRedirectFor).toHaveBeenCalledWith({ marker: "db" }, ref);
    expect(mockPermanentRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("opts into per-request rendering before resolving", async () => {
    await expect(render()).rejects.toThrow(RouteSignal);
    expect(mockConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.mock.invocationCallOrder[0]).toBeLessThan(
      mockRedirectFor.mock.invocationCallOrder[0]!
    );
  });

  it("sends an unresolved id to the forum home the module returns", async () => {
    mockRedirectFor.mockResolvedValue("/thinkpages");
    await expect(render()).rejects.toThrow("permanent:/thinkpages");
  });
});

describe("non-numeric ids", () => {
  it("ask for an other ref", async () => {
    await expect(ThreadPage(params({ threadId: "slug.12" }))).rejects.toThrow(RouteSignal);
    await expect(ForumThreadListPage(params({ forumId: "abc" }))).rejects.toThrow(RouteSignal);
    await expect(MemberProfilePage(params({ userId: "1e3" }))).rejects.toThrow(RouteSignal);
    await expect(LegacyPostPage(params({ postId: "x" }))).rejects.toThrow(RouteSignal);
    for (const [, ref] of mockRedirectFor.mock.calls) expect(ref).toEqual({ kind: "other" });
  });
});
