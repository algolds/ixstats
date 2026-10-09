/**
 * The post permalink's client gate (phase 5): for a signed-in viewer the server's guest lookup did not place, it asks
 * again with the viewer's session and replaces the URL with the thread anchor, or with the feed post when the viewer
 * cannot see a forum post by that id. It never shows the feed's "not found" while it looks.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const router = { replace: jest.fn() };
  return { router, useRouter: () => router };
});
jest.mock("~/trpc/react", () => ({
  api: { thinkpagesForum: { resolvePost: { useQuery: jest.fn() } } },
}));

import { ForumPermalinkGate } from "~/components/thinkpages-forum/ForumPermalinkGate";

const { router } = jest.requireMock<{ router: { replace: jest.Mock } }>("next/navigation");
const { api } = jest.requireMock<{
  api: { thinkpagesForum: { resolvePost: { useQuery: jest.Mock } } };
}>("~/trpc/react");
const useQuery = api.thinkpagesForum.resolvePost.useQuery;

function answer(result: { data?: { threadId: string; page: number } | null; isPending: boolean }) {
  useQuery.mockReturnValue(result);
}

beforeEach(() => {
  router.replace.mockClear();
  useQuery.mockReset();
});

describe("ForumPermalinkGate", () => {
  it("asks with the viewer's session and shows only a loader while it looks", () => {
    answer({ data: undefined, isPending: true });
    render(<ForumPermalinkGate postId="p1" />);
    expect(useQuery).toHaveBeenCalledWith({ postId: "p1" }, { retry: false });
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("Post not found")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens a post the viewer may see at its thread anchor", () => {
    answer({ data: { threadId: "t1", page: 4 }, isPending: false });
    render(<ForumPermalinkGate postId="p1" />);
    expect(router.replace).toHaveBeenCalledWith("/thinkpages/t/t1?page=4#post-p1");
  });

  it("sends anything else to the feed post, encoded", () => {
    answer({ data: null, isPending: false });
    render(<ForumPermalinkGate postId="a b/c" />);
    expect(router.replace).toHaveBeenCalledWith("/dashboard/post/a%20b%2Fc");
  });

  it("sends a failed lookup to the feed post", () => {
    answer({ data: undefined, isPending: false });
    render(<ForumPermalinkGate postId="p1" />);
    expect(router.replace).toHaveBeenCalledWith("/dashboard/post/p1");
  });
});
