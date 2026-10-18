import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => <span>{html}</span>,
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/shared/polls/FeedPollWidget", () => ({ FeedPollWidget: () => null }));
jest.mock("~/components/thinkpages/SportsBulletinCard", () => ({ SportsBulletinCard: () => null }));
jest.mock("~/components/dashboard/sections/feed/WikiFeedCard", () => ({
  WikiFeedCard: () => <div>wiki card</div>,
}));

import { UnifiedFeedItem } from "~/components/dashboard/sections/UnifiedFeedItem";

const common = {
  id: "forum-thread-t1",
  timestamp: new Date(Date.now() - 60_000),
  user: { name: "jane" },
  content: {
    title: "New forum thread: Hello",
    description: "an excerpt",
    metadata: { forumUrl: "/thinkpages/t/t1" },
  },
};
const base = { ...common, source: "forum" as const };

describe("UnifiedFeedItem forum items", () => {
  it("renders a forum item with a preview as a ForumFeedCard", () => {
    render(
      <UnifiedFeedItem
        activity={{
          ...base,
          forum: {
            threadId: "t1",
            title: "Hello",
            threadHref: "/thinkpages/t/t1",
            postHref: "/thinkpages/post/p1",
            kind: "thread",
            excerpt: "an excerpt",
            author: {
              name: "jane",
              avatarUrl: null,
              flagUrl: null,
              persona: false,
              personaType: null,
            },
            board: { name: "General", href: "/thinkpages/c/general" },
            realm: null,
            style: "ooc",
            replyCount: 0,
            reactionTotal: 0,
          },
        }}
      />
    );
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open thread" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p1"
    );
  });

  it("renders an older cached forum item without a preview as the plain activity card", () => {
    render(<UnifiedFeedItem activity={base} />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("link", { name: /open/i })).toHaveAttribute("href", "/thinkpages/t/t1");
  });

  it("keeps wiki items on the wiki card", () => {
    render(<UnifiedFeedItem activity={{ ...common, source: "wiki" as const }} />);
    expect(screen.getByText("wiki card")).toBeInTheDocument();
  });
});
