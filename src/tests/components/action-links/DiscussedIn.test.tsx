import React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";

const counts = jest.fn();
const list = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    actionLinks: {
      discussionCounts: { useQuery: (input: object, options: object) => counts(input, options) },
      discussions: { useInfiniteQuery: (input: object, options: object) => list(input, options) },
    },
  },
}));

import { DiscussedInBadge } from "~/components/action-links/DiscussedIn";
import { DiscussionCountsProvider } from "~/components/action-links/DiscussionCountsProvider";

const item = (id: string, extra: object = {}) => ({
  postId: id,
  href: `/thinkpages/post/${id}`,
  title: `Thread ${id}`,
  kind: "thread" as const,
  categoryName: "General",
  realmName: null,
  author: { name: "ann" },
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...extra,
});

function pages(items: object[], hasNextPage = false) {
  return {
    data: { pages: [{ items, nextCursor: hasNextPage ? "l020" : null }] },
    isLoading: false,
    isError: false,
    hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  };
}

function badge(tally: { count: number; postIds: string[] } | undefined, props: object = {}) {
  counts.mockReturnValue({ data: tally ? { a1: tally } : undefined });
  return render(
    <DiscussionCountsProvider activityIds={["a1"]}>
      <DiscussedInBadge activityId="a1" {...props} />
    </DiscussionCountsProvider>
  );
}

beforeEach(() => {
  counts.mockReset();
  list.mockReset();
  list.mockReturnValue(pages([]));
});

describe("DiscussionCountsProvider", () => {
  it("asks once for the distinct ids on screen, sorted, and no more than 50", () => {
    counts.mockReturnValue({ data: {} });
    // Shown newest first, so the ids run downwards: the first 50 on screen are 59 down to 10.
    const shown = Array.from({ length: 60 }, (_, i) => `a${String(59 - i).padStart(2, "0")}`);
    render(
      <DiscussionCountsProvider activityIds={[...shown, "a59"]}>{null}</DiscussionCountsProvider>
    );
    expect(counts).toHaveBeenCalledTimes(1);
    const [[input, options]] = counts.mock.calls as never as [
      [{ activityIds: string[] }, { enabled: boolean }],
    ];
    expect(input.activityIds).toEqual(shown.slice(0, 50).sort());
    expect(input.activityIds).not.toContain("a09");
    expect(options).toMatchObject({ enabled: true });
  });

  it("keeps the last counts on screen while a new id set loads", () => {
    counts.mockReturnValue({ data: {} });
    render(<DiscussionCountsProvider activityIds={["a1"]}>{null}</DiscussionCountsProvider>);
    const [[, options]] = counts.mock.calls as never as [
      [object, { placeholderData: typeof keepPreviousData }],
    ];
    expect(options.placeholderData).toBe(keepPreviousData);
  });

  it("asks for nothing when there are no ids", () => {
    counts.mockReturnValue({ data: undefined });
    render(<DiscussionCountsProvider activityIds={[]}>{null}</DiscussionCountsProvider>);
    expect(counts).toHaveBeenCalledWith(
      { activityIds: [] },
      expect.objectContaining({ enabled: false })
    );
  });
});

describe("DiscussedInBadge", () => {
  it("renders nothing outside a provider, while loading, and at zero", () => {
    const { container, unmount } = render(<DiscussedInBadge activityId="a1" />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(badge(undefined).container).toBeEmptyDOMElement();
    expect(badge({ count: 0, postIds: [] }).container).toBeEmptyDOMElement();
  });

  it("reads an id that names a prototype member as having no discussions", () => {
    counts.mockReturnValue({ data: {} });
    const { container } = render(
      <DiscussionCountsProvider activityIds={["constructor"]}>
        <DiscussedInBadge activityId="constructor" />
      </DiscussionCountsProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links a lone post straight to it", () => {
    badge({ count: 1, postIds: ["p9"] });
    expect(screen.getByRole("link", { name: "Discussed in 1 post" })).toHaveAttribute(
      "href",
      "/thinkpages/post/p9"
    );
    expect(list).not.toHaveBeenCalled();
  });

  it("expands an inline list for several posts, loading it only when opened", () => {
    list.mockReturnValue(pages([item("p1"), item("p2", { hidden: true })]));
    badge({ count: 3, postIds: ["p1", "p2"] });
    expect(list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 3 posts" }));
    expect(list).toHaveBeenCalledWith({ activityId: "a1" }, expect.anything());
    expect(screen.getByRole("link", { name: /Thread p1/ })).toHaveAttribute(
      "href",
      "/thinkpages/post/p1"
    );
    expect(screen.getAllByText(/^ann in General/)).toHaveLength(2);
    expect(screen.getByText("Hidden from members")).toBeInTheDocument();
  });

  it("loads more on request", () => {
    const result = pages([item("p1")], true);
    list.mockReturnValue(result);
    badge({ count: 25, postIds: ["p1", "p2"] });
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 25 posts" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(result.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("pages by the server's cursor, never by how many items came back", () => {
    badge({ count: 25, postIds: ["p1", "p2"] });
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 25 posts" }));
    const [[, options]] = list.mock.calls as never as [
      [
        object,
        {
          getNextPageParam: (last: {
            items: object[];
            nextCursor: string | null;
          }) => string | undefined;
        },
      ],
    ];
    expect(options.getNextPageParam({ items: [], nextCursor: "l020" })).toBe("l020");
    expect(options.getNextPageParam({ items: [item("p1")], nextCursor: null })).toBeUndefined();
  });

  it("says when the list cannot load, and tries again on request", () => {
    const failed = { ...pages([]), data: undefined, isError: true };
    list.mockReturnValue(failed);
    badge({ count: 3, postIds: ["p1", "p2"] });
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 3 posts" }));
    expect(screen.getByText("Could not load the discussions.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it("says so when the opened list has nothing to show", () => {
    list.mockReturnValue(pages([]));
    badge({ count: 3, postIds: ["p1", "p2"] });
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 3 posts" }));
    expect(screen.getByText("No discussions to show")).toBeInTheDocument();
  });

  it("offers more, not the empty note, when a short page still has a next one", () => {
    list.mockReturnValue(pages([], true));
    badge({ count: 25, postIds: ["p1", "p2"] });
    fireEvent.click(screen.getByRole("button", { name: "Discussed in 25 posts" }));
    expect(screen.queryByText("No discussions to show")).toBeNull();
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("points the expander at the list it opens", () => {
    list.mockReturnValue(pages([item("p1")]));
    const { container } = badge({ count: 3, postIds: ["p1", "p2"] });
    const expander = screen.getByRole("button", { name: "Discussed in 3 posts" });
    expect(expander).not.toHaveAttribute("aria-controls");
    fireEvent.click(expander);
    const id = expander.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(container.querySelector(`[id="${id}"]`)).toContainElement(
      screen.getByRole("link", { name: /Thread p1/ })
    );
  });

  describe("inside a post that shows the action", () => {
    it("shows nothing when this post is the only discussion", () => {
      expect(
        badge({ count: 1, postIds: ["p1"] }, { excludePostId: "p1" }).container
      ).toBeEmptyDOMElement();
    });

    it("links the one other post", () => {
      badge({ count: 2, postIds: ["p1", "p2"] }, { excludePostId: "p1" });
      expect(screen.getByRole("link", { name: "Also discussed in 1 other post" })).toHaveAttribute(
        "href",
        "/thinkpages/post/p2"
      );
    });

    it("takes this post off the count when more posts exist than are listed", () => {
      badge({ count: 3, postIds: ["p1", "p2"] }, { excludePostId: "p9" });
      expect(
        screen.getByRole("button", { name: "Also discussed in 2 other posts" })
      ).toBeInTheDocument();
    });

    it("lists the others without this post", () => {
      list.mockReturnValue(pages([item("p1"), item("p2"), item("p3")]));
      badge({ count: 3, postIds: ["p1", "p2"] }, { excludePostId: "p1" });
      fireEvent.click(screen.getByRole("button", { name: "Also discussed in 2 other posts" }));
      expect(screen.queryByRole("link", { name: /Thread p1/ })).toBeNull();
      expect(screen.getByRole("link", { name: /Thread p2/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Thread p3/ })).toBeInTheDocument();
    });
  });
});
