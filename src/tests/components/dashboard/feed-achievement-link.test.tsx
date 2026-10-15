import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/dashboard/sections/feed/FeedItemHeader", () => ({
  FeedItemHeader: ({ externalUrl }: { externalUrl?: string }) => (
    <span data-testid="open-link">{externalUrl ?? "none"}</span>
  ),
}));
jest.mock("~/components/action-links/DiscussedIn", () => ({ DiscussedInBadge: () => null }));
jest.mock("~/components/dashboard/sections/feed/FeedGroupedDrawer", () => ({
  FeedGroupedDrawer: () => null,
}));
jest.mock("~/components/dashboard/sections/feed/WikiFeedCard", () => ({
  WikiFeedCard: () => null,
}));
jest.mock("~/components/dashboard/sections/feed/ForumFeedCard", () => ({
  ForumFeedCard: () => null,
}));
jest.mock("~/components/shared/polls/FeedPollWidget", () => ({ FeedPollWidget: () => null }));
jest.mock("~/components/thinkpages/SportsBulletinCard", () => ({ SportsBulletinCard: () => null }));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => <span>{html}</span>,
}));

import { UnifiedFeedItem } from "~/components/dashboard/sections/UnifiedFeedItem";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";

const item = (metadata: Record<string, unknown>): ProcessedFeedItem => ({
  id: "a1",
  source: "activity",
  timestamp: new Date("2026-10-01T00:00:00Z"),
  content: { title: "Arcadia Unlocks Achievement: First Million", description: "d", metadata },
});

describe("achievement feed items", () => {
  it("open the achievement in the Vault", () => {
    render(<UnifiedFeedItem activity={item({ achievementKey: "econ-first-million" })} />);
    expect(screen.getByTestId("open-link")).toHaveTextContent(
      "/vault/achievements?a=econ-first-million"
    );
  });

  it("encode the key", () => {
    render(<UnifiedFeedItem activity={item({ achievementKey: "a b" })} />);
    expect(screen.getByTestId("open-link")).toHaveTextContent("/vault/achievements?a=a%20b");
  });

  it("keep a wiki link ahead of the achievement link, and show none without either", () => {
    render(
      <UnifiedFeedItem
        activity={item({ wikiUrl: "https://ixwiki.com/wiki/X", achievementKey: "k" })}
      />
    );
    expect(screen.getByTestId("open-link")).toHaveTextContent("https://ixwiki.com/wiki/X");
    render(<UnifiedFeedItem activity={item({})} />);
    expect(screen.getAllByTestId("open-link")[1]).toHaveTextContent("none");
  });
});
