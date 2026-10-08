import { render, renderHook, screen } from "@testing-library/react";

const cards = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { actionLinks: { activityCards: { useQuery: (...args: unknown[]) => cards(...args) } } },
}));

import { PostBody } from "~/components/thinkpages-forum/PostBody";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import type { ActionCardData } from "~/components/action-links";

function card(id: string, title: string): ActionCardData {
  return { id, title, type: "diplomatic", createdAt: new Date(0), country: null };
}

describe("PostBody", () => {
  it("renders text before, between and after two tokens in order, with two cards", () => {
    const cardMap = new Map([
      ["a1", card("a1", "First action")],
      ["b2", card("b2", "Second action")],
    ]);
    const { container } = render(
      <PostBody
        html="<p>before</p>[ixaction=a1]<p>between</p>[ixaction=b2]<p>after</p>"
        cards={cardMap}
      />
    );
    expect(screen.getAllByLabelText("Verified action")).toHaveLength(2);
    const text = container.textContent ?? "";
    const order = ["before", "First action", "between", "Second action", "after"].map((s) =>
      text.indexOf(s)
    );
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("renders Unverified action for an unknown id", () => {
    render(<PostBody html="<p>hi</p>[ixaction=gone]" cards={new Map()} />);
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });

  it("renders the HTML once when there are no tokens", () => {
    const { container } = render(<PostBody html="<p>plain post</p>" cards={new Map()} />);
    expect(screen.getAllByText("plain post")).toHaveLength(1);
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("useThreadActionCards", () => {
  beforeEach(() => cards.mockReset());

  it("queries every id from 3 posts in one call and returns a Map", () => {
    cards.mockReturnValue({ data: [card("a1", "A"), card("b2", "B")] });
    const posts = [
      { contentHtml: "<p>x</p>[ixaction=a1]" },
      { contentHtml: "[ixaction=b2] and [ixaction=a1]" },
      { contentHtml: "[ixaction=c3]" },
    ];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledTimes(1);
    expect(cards).toHaveBeenCalledWith({ ids: ["a1", "b2", "c3"] }, { enabled: true });
    expect(result.current.get("b2")?.title).toBe("B");
    expect(result.current.has("c3")).toBe(false);
  });

  it("disables the query when no post has a token", () => {
    cards.mockReturnValue({ data: undefined });
    const posts = [{ contentHtml: "<p>none</p>" }];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledWith({ ids: [] }, { enabled: false });
    expect(result.current.size).toBe(0);
  });

  it("caps the ids at the router maximum of 50", () => {
    cards.mockReturnValue({ data: [] });
    const posts = [
      { contentHtml: Array.from({ length: 60 }, (_, i) => `[ixaction=id${i}]`).join("") },
    ];
    renderHook(() => useThreadActionCards(posts));
    expect(cards.mock.calls[0]![0].ids).toHaveLength(50);
  });
});
