import React from "react";
import { act, render, screen } from "@testing-library/react";

const directive = jest.fn();
const invalidateDirective = jest.fn();
let statusOptions: { onSuccess?: (data: object, vars: { id: string; status: string }) => void } =
  {};
const counts = jest.fn();
const list = jest.fn();
const intent = {
  id: "i1",
  goal: "Create jobs",
  tier: "moderate",
  category: "economy",
  status: "active",
  summary: null,
  changesJson: "[]",
  parentId: null,
  target: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getTree: {
        useQuery: () => ({
          data: { roots: [intent], allIntents: [intent] },
          isLoading: false,
          refetch: jest.fn(),
        }),
      },
      getLinkedIssues: {
        useQuery: () => ({ data: { progress: 0, resolvedCount: 0, totalCount: 0, issues: [] } }),
      },
      updateStatus: {
        useMutation: (options: typeof statusOptions) => {
          statusOptions = options;
          return { mutate: jest.fn(), isPending: false };
        },
      },
    },
    useUtils: () => ({
      actionLinks: { directiveActivity: { invalidate: invalidateDirective } },
    }),
    actionLinks: {
      directiveActivity: {
        useQuery: (input: { intentId: string }, options: { enabled: boolean }) =>
          directive(input, options),
      },
      discussionCounts: { useQuery: (input: object, options: object) => counts(input, options) },
      discussions: {
        useInfiniteQuery: (input: object, options: object) => list(input, options),
      },
    },
  },
}));
jest.mock("~/components/action-links/ShareToRealmButton", () => ({
  ShareToRealmButton: ({ activityId }: { activityId: string }) => (
    <button type="button">Share {activityId}</button>
  ),
}));
jest.mock("~/components/mycountry/shared/modals/ThinkPagesShareModal", () => ({
  ThinkPagesShareModal: () => null,
}));

import { IntentDetail } from "~/components/mycountry/shell/IntentDetail";

describe("IntentDetail forum share", () => {
  beforeEach(() => {
    directive.mockReset();
    invalidateDirective.mockReset();
    counts.mockReset();
    counts.mockReturnValue({ data: undefined });
    list.mockReset();
    list.mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
    });
  });

  it("looks the directive's row up by its intent and offers the forum share beside the feed share", () => {
    directive.mockReturnValue({ data: { activityId: "dir-i1" } });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(directive).toHaveBeenCalledWith(
      { intentId: "i1" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByRole("button", { name: "Share dir-i1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share to the feed/ })).toBeInTheDocument();
  });

  it("offers no forum share for a directive without a public row (an older one)", () => {
    directive.mockReturnValue({ data: null });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.queryByRole("button", { name: /^Share dir/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Share to the feed/ })).toBeInTheDocument();
  });

  it("lists the posts that discuss the directive in a section titled with their count", () => {
    directive.mockReturnValue({ data: { activityId: "dir-i1" } });
    counts.mockReturnValue({ data: { "dir-i1": { count: 2, postIds: ["p1", "p2"] } } });
    list.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                postId: "p1",
                href: "/thinkpages/post/p1",
                title: "On the jobs plan",
                kind: "thread",
                categoryName: "Hub",
                realmName: "Eurth",
                author: { name: "ann" },
                createdAt: new Date("2026-10-02T00:00:00Z"),
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
    });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.getByRole("heading", { name: "Discussed in 2 posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /On the jobs plan/ })).toHaveAttribute(
      "href",
      "/thinkpages/post/p1"
    );
    expect(counts).toHaveBeenCalledWith({ activityIds: ["dir-i1"] }, expect.anything());
  });

  it("shows no section for a directive nobody has discussed, or one without a row", () => {
    directive.mockReturnValue({ data: { activityId: "dir-i1" } });
    counts.mockReturnValue({ data: { "dir-i1": { count: 0, postIds: [] } } });
    const { unmount } = render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.queryByText(/Discussed in/)).toBeNull();
    unmount();
    const asked = counts.mock.calls.length;
    directive.mockReturnValue({ data: null });
    render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.queryByText(/Discussed in/)).toBeNull();
    // The section, and its counts request, mount only when the directive has a row.
    expect(counts.mock.calls.length).toBe(asked);
  });

  it("drops the forum share once the directive is abandoned, without waiting for the cache to expire", () => {
    let withdrawn = false;
    directive.mockImplementation(() => ({ data: withdrawn ? null : { activityId: "dir-i1" } }));
    invalidateDirective.mockImplementation(() => {
      withdrawn = true;
    });
    const { rerender } = render(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.getByRole("button", { name: "Share dir-i1" })).toBeInTheDocument();
    act(() => statusOptions.onSuccess?.({}, { id: "i1", status: "abandoned" }));
    expect(invalidateDirective).toHaveBeenCalledWith({ intentId: "i1" });
    rerender(<IntentDetail countryId="c1" intentId="i1" />);
    expect(screen.queryByRole("button", { name: /^Share dir/ })).toBeNull();
  });
});
