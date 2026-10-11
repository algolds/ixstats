import React from "react";
import { render, screen } from "@testing-library/react";

const captured = jest.fn();
jest.mock("~/components/action-links/DiscussionCountsProvider", () => ({
  DiscussionCountsProvider: ({
    activityIds,
    children,
  }: {
    activityIds: string[];
    children: React.ReactNode;
  }) => {
    captured(activityIds);
    return <>{children}</>;
  },
}));
jest.mock("~/components/action-links/DiscussedIn", () => ({
  DiscussedInBadge: ({ activityId }: { activityId: string }) => (
    <span data-testid="badge">{activityId}</span>
  ),
}));
jest.mock("~/components/dashboard/sections/feed/FeedItemHeader", () => ({
  FeedItemHeader: () => null,
}));
jest.mock("~/components/dashboard/sections/feed/FeedGroupedDrawer", () => ({
  FeedGroupedDrawer: () => null,
}));
jest.mock("~/components/dashboard/sections/feed/WikiFeedCard", () => ({
  WikiFeedCard: () => null,
}));
jest.mock("~/components/shared/polls/FeedPollWidget", () => ({ FeedPollWidget: () => null }));
jest.mock("~/components/thinkpages/SportsBulletinCard", () => ({ SportsBulletinCard: () => null }));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => <span>{html}</span>,
}));
jest.mock("~/components/thinkpages/ThinkpagesPost", () => ({ ThinkpagesPost: () => null }));
jest.mock("~/trpc/react", () => ({ api: {} }));

import {
  FeedList,
  groupRepeatedActivities,
  type FeedHandlers,
} from "~/components/dashboard/sections/UnifiedFeedContent";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";
import { UnifiedFeedItem, getActivityLabel } from "~/components/dashboard/sections/UnifiedFeedItem";

const activity = (id: string, extra: object = {}) => ({
  id,
  source: "activity",
  timestamp: new Date("2026-10-01T00:00:00Z"),
  content: { title: "A directive", description: "Declared." },
  ...extra,
});

/** The typed row `UnifiedFeedItem` takes: a plain activity, a grouped run or a forum row with no preview. */
const feedItem = (id: string, kind: "plain" | "grouped" | "forum"): ProcessedFeedItem => {
  const common = {
    id,
    timestamp: new Date("2026-10-01T00:00:00Z"),
    content: { title: "A directive", description: "Declared." },
  };
  if (kind === "forum") return { ...common, source: "forum" };
  return kind === "grouped"
    ? { ...common, source: "activity", _grouped: true }
    : { ...common, source: "activity" };
};

describe("UnifiedFeedItem discussed-in badge", () => {
  it("shows the badge on a plain activity card", () => {
    render(<UnifiedFeedItem activity={feedItem("a1", "plain")} />);
    expect(screen.getByTestId("badge")).toHaveTextContent("a1");
  });

  it.each([
    ["a grouped run", feedItem("g1", "grouped")],
    ["a forum row", feedItem("f1", "forum")],
  ])("shows no badge on %s", (_label, row) => {
    render(<UnifiedFeedItem activity={row} />);
    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("labels a government row as Politics", () => {
    expect(getActivityLabel({ category: "government", content: { title: "x" } }).label).toBe(
      "Politics"
    );
  });

  it("labels a directive by its activity type, whatever its title says", () => {
    const row = (title: string) => ({
      type: "directive",
      category: "government",
      content: { title },
    });
    expect(getActivityLabel(row("Raise taxes")).label).toBe("Directive");
    // The goal text is the player's own: a keyword in it must not decide the label.
    expect(getActivityLabel(row("Build a city and a treaty")).label).toBe("Directive");
    expect(
      getActivityLabel({ category: "government", content: { title: "Directive" } }).label
    ).toBe("Politics");
  });
});

describe("FeedList counts", () => {
  const handlers: FeedHandlers = {
    currentUserAccountId: "u1",
    accounts: [],
    countryId: "c1",
    isOwner: false,
    onAccountSelectAction: jest.fn(),
    onAccountSettingsAction: jest.fn(),
    onCreateAccountAction: jest.fn(),
    onLikeAction: jest.fn(),
    onRepostAction: jest.fn(),
    onReactionAction: jest.fn(),
    onReplyAction: jest.fn(),
    onShareAction: jest.fn(),
  };

  it("asks for the counts of the plain activity rows only", () => {
    captured.mockClear();
    render(
      <FeedList
        {...handlers}
        items={[
          activity("a1"),
          activity("g1", { _grouped: true }),
          activity("w1", { source: "wiki" }),
          activity("f1", { source: "forum" }),
          activity("a2"),
        ]}
      />
    );
    expect(captured).toHaveBeenLastCalledWith(["a1", "a2"]);
  });
});

describe("groupRepeatedActivities", () => {
  const row = (id: string, type: string) =>
    activity(id, { type, category: "government", user: { name: "Testland" } });

  it("groups repeated updates of a country but keeps every directive on its own row", () => {
    const grouped = groupRepeatedActivities([
      row("d1", "directive"),
      row("d2", "directive"),
      row("e1", "economic"),
      row("e2", "economic"),
    ]);
    expect(grouped.map((a) => a.id)).toEqual([
      "d1",
      "d2",
      expect.stringContaining("activity-grouped-"),
    ]);
    expect(grouped.map((a) => a._grouped === true)).toEqual([false, false, true]);
  });
});
