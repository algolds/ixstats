/** @jest-environment node */
/**
 * Phase 4 (Task 6): every /forum/* page asks the legacy redirect first. Switched on, it 307s to the native forum
 * (`redirect`, temporary, Q8) and the bridge page never renders; switched off, the bridge page renders as before.
 */
import { isValidElement, type ReactElement } from "react";

class RouteSignal extends Error {}
const mockRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`redirect:${url}`);
});
jest.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));

const mockRedirectFor = jest.fn();
jest.mock("~/server/modules/thinkpages-forum", () => ({
  legacyForumRedirectFor: (db: object, ref: object) => mockRedirectFor(db, ref),
}));
jest.mock("~/server/db", () => ({ __esModule: true, db: { marker: "db" } }));

jest.mock("~/app/(forum)/forum/ForumHomeClient", () => ({ __esModule: true, default: () => null }));
jest.mock("~/app/(forum)/forum/[forumId]/ForumThreadListClient", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("~/app/(forum)/forum/thread/[threadId]/ThreadPageClient", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("~/app/(forum)/forum/members/[userId]/MemberProfileClient", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("~/app/(forum)/forum/new-thread/NewThreadClient", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("~/app/(forum)/forum/search/ForumSearchClient", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("~/app/(forum)/forum/bookmarks/ForumStashesClient", () => ({
  __esModule: true,
  default: () => null,
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import ForumHomeClient from "~/app/(forum)/forum/ForumHomeClient";
import ForumHomePage from "~/app/(forum)/forum/page";
import ForumThreadListClient from "~/app/(forum)/forum/[forumId]/ForumThreadListClient";
import ForumThreadListPage from "~/app/(forum)/forum/[forumId]/page";
import ThreadPageClient from "~/app/(forum)/forum/thread/[threadId]/ThreadPageClient";
import ThreadPage from "~/app/(forum)/forum/thread/[threadId]/page";
import MemberProfileClient from "~/app/(forum)/forum/members/[userId]/MemberProfileClient";
import MemberProfilePage from "~/app/(forum)/forum/members/[userId]/page";
import NewThreadClient from "~/app/(forum)/forum/new-thread/NewThreadClient";
import NewThreadPage from "~/app/(forum)/forum/new-thread/page";
import ForumSearchClient from "~/app/(forum)/forum/search/ForumSearchClient";
import ForumSearchPage from "~/app/(forum)/forum/search/page";
import ForumStashesClient from "~/app/(forum)/forum/bookmarks/ForumStashesClient";
import ForumStashesPage from "~/app/(forum)/forum/bookmarks/page";
import LegacyPostPage from "~/app/(forum)/forum/post/[postId]/page";

const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

interface PageCase {
  name: string;
  render: () => Promise<ReactElement>;
  ref: object;
  client: () => null;
}

const CASES: PageCase[] = [
  { name: "/forum", render: () => ForumHomePage(), ref: { kind: "home" }, client: ForumHomeClient },
  {
    name: "/forum/[forumId]",
    render: () => ForumThreadListPage(params({ forumId: "12" })),
    ref: { kind: "forum", nodeId: 12 },
    client: ForumThreadListClient,
  },
  {
    name: "/forum/thread/[threadId]",
    render: () => ThreadPage(params({ threadId: "123" })),
    ref: { kind: "thread", threadId: 123 },
    client: ThreadPageClient,
  },
  {
    name: "/forum/members/[userId]",
    render: () => MemberProfilePage(params({ userId: "7" })),
    ref: { kind: "member", userId: 7 },
    client: MemberProfileClient,
  },
  {
    name: "/forum/new-thread",
    render: () => NewThreadPage(),
    ref: { kind: "other" },
    client: NewThreadClient,
  },
  {
    name: "/forum/search",
    render: () => ForumSearchPage(),
    ref: { kind: "other" },
    client: ForumSearchClient,
  },
  {
    name: "/forum/bookmarks",
    render: () => ForumStashesPage(),
    ref: { kind: "other" },
    client: ForumStashesClient,
  },
];

beforeEach(() => {
  mockRedirect.mockClear();
  mockRedirectFor.mockReset().mockResolvedValue(null);
});

describe.each(CASES)("$name", ({ render, ref, client }) => {
  it("renders the bridge page unchanged while the switch is off", async () => {
    const page = await render();
    expect(isValidElement(page)).toBe(true);
    expect(page.type).toBe(client);
    expect(mockRedirectFor).toHaveBeenCalledWith({ marker: "db" }, ref);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to the target, without rendering the bridge page, while the switch is on", async () => {
    mockRedirectFor.mockResolvedValue("/thinkpages/t/t_native");
    await expect(render()).rejects.toThrow("redirect:/thinkpages/t/t_native");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
});

describe("non-numeric ids", () => {
  it("ask for an other ref", async () => {
    await ThreadPage(params({ threadId: "slug.12" }));
    await ForumThreadListPage(params({ forumId: "abc" }));
    await MemberProfilePage(params({ userId: "1e3" }));
    for (const [, ref] of mockRedirectFor.mock.calls) expect(ref).toEqual({ kind: "other" });
  });
});

describe("/forum/post/[postId]", () => {
  it("redirects to the native post while the switch is on", async () => {
    mockRedirectFor.mockResolvedValue("/thinkpages/post/p_native");
    await expect(LegacyPostPage(params({ postId: "456" }))).rejects.toThrow(
      "redirect:/thinkpages/post/p_native"
    );
    expect(mockRedirectFor).toHaveBeenCalledWith({ marker: "db" }, { kind: "post", postId: 456 });
  });

  it("sends the visitor to the bridge's forum home while the switch is off", async () => {
    await expect(LegacyPostPage(params({ postId: "456" }))).rejects.toThrow("redirect:/forum");
    expect(mockRedirect).toHaveBeenCalledWith("/forum");
  });
});
