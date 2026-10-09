import { render, renderHook, screen } from "@testing-library/react";

interface QueryState {
  data?: ActionCardData[];
  isSuccess?: boolean;
  isError?: boolean;
}
type Input = { ids: string[] };
type Options = { enabled: boolean };

const cards = jest.fn<QueryState, [Input, Options]>();
jest.mock("~/trpc/react", () => ({
  api: {
    actionLinks: {
      activityCards: {
        useQuery: (input: Input, options: Options) => ({
          isSuccess: false,
          isError: false,
          ...cards(input, options),
        }),
      },
    },
  },
}));

jest.mock("~/lib/base-path", () => ({
  ...jest.requireActual<typeof import("~/lib/base-path")>("~/lib/base-path"),
  withBasePath: (path: string) => (path.startsWith("/p/") ? path : `/p${path}`),
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
        cardsReady
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

  it("caps post images to the column width and a standard height through wrapper classes", () => {
    const { container } = render(
      <PostBody html='<p>x</p><img src="https://x/y.png" alt="">' cards={new Map()} cardsReady />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("[&_img]:max-w-full", "[&_img]:max-h-[640px]", "[&_img]:h-auto");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://x/y.png");
  });

  it("renders root-relative image and link URLs through the base path, once", () => {
    const { container } = render(
      <PostBody
        html='<p><img src="/images/uploads/forum/55-abc-x.png" alt=""><a href="/images/uploads/forum/56-def-r.pdf">r</a><img src="/p/images/downloaded/y.png" alt=""><img src="https://x/z.png" alt=""></p>[ixaction=a1]<p><img src="/images/uploads/b.png" alt=""></p>'
        cards={new Map()}
        cardsReady
      />
    );
    expect(Array.from(container.querySelectorAll("img"), (img) => img.getAttribute("src"))).toEqual(
      [
        "/p/images/uploads/forum/55-abc-x.png",
        "/p/images/downloaded/y.png",
        "https://x/z.png",
        "/p/images/uploads/b.png",
      ]
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/p/images/uploads/forum/56-def-r.pdf"
    );
  });

  it("renders Unverified action for an unknown id", () => {
    render(<PostBody html="<p>hi</p>[ixaction=gone]" cards={new Map()} cardsReady />);
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });

  it("shows neutral busy placeholders, not Unverified action, while the batch loads", () => {
    const { container } = render(
      <PostBody html="[ixaction=a1]<p>x</p>[ixaction=b2]" cards={new Map()} cardsReady={false} />
    );
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
  });

  it("says Action unavailable when the batch failed", () => {
    render(<PostBody html="[ixaction=a1]" cards={new Map()} cardsReady={false} cardsErrored />);
    expect(screen.getByText("Action unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
  });

  it("keeps a token inside a paragraph as balanced paragraphs around the card", () => {
    const cardMap = new Map([["a1", card("a1", "First action")]]);
    const { container } = render(
      <PostBody html="<p>before [ixaction=a1] after</p>" cards={cardMap} cardsReady />
    );
    expect(
      Array.from(container.querySelectorAll("p"))
        .filter((p) => !p.closest("[data-slot=card]"))
        .map((p) => p.textContent)
    ).toEqual(["before ", " after"]);
    expect(screen.getByText("First action")).toBeInTheDocument();
  });

  it.each([
    ["title", '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>'],
    ["href", '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>'],
  ])("renders a token inside a %s attribute as inert text, with no live element", (_, html) => {
    const { container } = render(<PostBody html={html} cards={new Map()} cardsReady />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    const handlers = Array.from(container.querySelectorAll("*")).flatMap((el) =>
      el.getAttributeNames().filter((name) => name.startsWith("on"))
    );
    expect(handlers).toEqual([]);
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
  });

  it("still renders a card for a token in a list item", () => {
    const cardMap = new Map([["a1", card("a1", "First action")]]);
    const { container } = render(
      <PostBody html="<ul><li>one [ixaction=a1] two</li></ul>" cards={cardMap} cardsReady />
    );
    expect(screen.getByText("First action")).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "one ",
      " two",
    ]);
  });

  it("renders the HTML once when there are no tokens", () => {
    const { container } = render(
      <PostBody html="<p>plain post</p>" cards={new Map()} cardsReady />
    );
    expect(screen.getAllByText("plain post")).toHaveLength(1);
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("useThreadActionCards", () => {
  beforeEach(() => cards.mockReset());

  it("queries every id from 3 posts in one call and returns a Map", () => {
    cards.mockReturnValue({ data: [card("a1", "A"), card("b2", "B")], isSuccess: true });
    const posts = [
      { contentHtml: "<p>x</p>[ixaction=a1]" },
      { contentHtml: "[ixaction=b2] and [ixaction=a1]" },
      { contentHtml: "[ixaction=c3]" },
    ];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledTimes(1);
    expect(cards).toHaveBeenCalledWith({ ids: ["a1", "b2", "c3"] }, { enabled: true });
    expect(result.current.cards.get("b2")?.title).toBe("B");
    expect(result.current.cards.has("c3")).toBe(false);
    expect(result.current).toMatchObject({ ready: true, errored: false });
  });

  it("disables the query when no post has a token", () => {
    cards.mockReturnValue({});
    const posts = [{ contentHtml: "<p>none</p>" }];
    const { result } = renderHook(() => useThreadActionCards(posts));
    expect(cards).toHaveBeenCalledWith({ ids: [] }, { enabled: false });
    expect(result.current.cards.size).toBe(0);
    expect(result.current.ready).toBe(true);
  });

  it("is not ready while loading and reports a failed request", () => {
    const posts = [{ contentHtml: "[ixaction=a1]" }];
    cards.mockReturnValue({});
    expect(renderHook(() => useThreadActionCards(posts)).result.current).toMatchObject({
      ready: false,
      errored: false,
    });
    cards.mockReturnValue({ isError: true });
    expect(renderHook(() => useThreadActionCards(posts)).result.current).toMatchObject({
      ready: false,
      errored: true,
    });
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
