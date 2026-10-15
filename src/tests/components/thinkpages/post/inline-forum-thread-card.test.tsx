import React from "react";
import { render, screen, within } from "@testing-library/react";

let thread: { title: string; forumName: string | null; replyCount: number } | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { getForumThreadPreview: { useQuery: () => ({ data: thread }) } },
  },
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  ForumLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/dashboard/sections/feed/InlineWikiArticlePreview", () => ({
  InlineWikiArticlePreview: () => null,
}));

import { PostInlineLinkPreview } from "~/components/thinkpages/post/PostInlineLinkPreview";

const URL_ = "https://forum.ixwiki.com/threads/topic.123/";

beforeEach(() => {
  thread = { title: "The Concord question", forumName: "Roleplay", replyCount: 1 };
});

describe("the inline forum thread card", () => {
  it("is one link to the thread, opening in a new tab, on a tint tile with the board and replies", () => {
    render(<PostInlineLinkPreview url={URL_} />);
    const [link, ...others] = screen.getAllByRole("link");
    expect(others).toHaveLength(0);
    expect(link).toHaveAttribute("href", URL_);
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(link!).getByText("The Concord question")).toHaveClass("text-headline");
    expect(within(link!).getByText("Roleplay · 1 reply")).toBeInTheDocument();
    expect(link!.querySelector(".bg-tint-fill .texture-overlay")).not.toBeNull();
    expect(link!.closest('[data-slot="card"]')).toHaveAttribute("data-variant", "well");
    // The link hides its own outline; the card draws the keyboard focus ring around it.
    expect(link!.closest('[data-slot="card"]')).toHaveClass("has-[:focus-visible]:outline-2");
    expect(screen.queryByText(/View Thread/)).toBeNull();
    expect(document.querySelector(".text-indigo")).toBeNull();
  });

  it("says Forum thread until the preview loads", () => {
    thread = undefined;
    render(<PostInlineLinkPreview url={URL_} />);
    expect(screen.getByRole("link", { name: /Forum thread/ })).toBeInTheDocument();
  });
});
