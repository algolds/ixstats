import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { boardAccess, boardData, boardMessage } from "~/tests/helpers/realm-board-fixtures";

interface QueryResult {
  data?: object;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
}

jest.mock("~/trpc/react", () => {
  const pages: Record<string, QueryResult> = {};
  const asked: Array<{ realm: string; before?: string }> = [];
  return {
    pages,
    asked,
    api: {
      thinkpagesForum: {
        getBoard: {
          useQuery: (input: { realm: string; before?: string }) => {
            asked.push(input);
            return { isLoading: false, isError: false, ...pages[input.before ?? ""] };
          },
        },
      },
    },
  };
});
jest.mock("~/hooks/useThreadActionCards", () => ({
  useThreadActionCards: () => ({ cards: new Map(), ready: true, errored: false }),
}));
jest.mock("~/components/thinkpages-forum/realm/BoardMessage", () => ({
  BoardMessage: ({
    message,
    onReply,
  }: {
    message: { id: string; contentHtml: string };
    onReply: (m: unknown) => void;
  }) => (
    <article data-testid="message" data-id={message.id}>
      <span>{message.contentHtml}</span>
      <button type="button" onClick={() => onReply(message)}>
        Reply to {message.id}
      </button>
    </article>
  ),
}));

import { BoardFeed } from "~/components/thinkpages-forum/realm/BoardFeed";

const { pages, asked } = jest.requireMock<{
  pages: Record<string, QueryResult>;
  asked: Array<{ realm: string; before?: string }>;
}>("~/trpc/react");

type ObserverCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;
let observed: ObserverCallback | null = null;
let observerOptions: IntersectionObserverInit | undefined;

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(pages)) delete pages[key];
  asked.length = 0;
  observed = null;
  observerOptions = undefined;
  window.IntersectionObserver = class {
    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
      observed = callback;
      observerOptions = options;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

/** The reader scrolls the top of the feed out of view (above the viewport), or back into it. */
function scrollAway() {
  act(() =>
    observed?.([
      {
        isIntersecting: false,
        boundingClientRect: { top: -400 } as DOMRectReadOnly,
        rootBounds: { top: 0 } as DOMRectReadOnly,
      },
    ])
  );
}
function scrollToTop() {
  act(() =>
    observed?.([
      {
        isIntersecting: true,
        boundingClientRect: { top: 0 } as DOMRectReadOnly,
        rootBounds: { top: 0 } as DOMRectReadOnly,
      },
    ])
  );
}

const msg = (id: string, text = id) => boardMessage({ id, contentHtml: text });
const REALM = { id: "r_eurth", slug: "eurth", name: "Eurth" };

type Props = React.ComponentProps<typeof BoardFeed>;

function feedProps(
  data = boardData([msg("p3"), msg("p2"), msg("p1")]),
  over: Partial<Props> = {}
): Props {
  return {
    realm: REALM,
    data,
    typing: [],
    live: true,
    signedIn: true,
    tools: null,
    showLatest: 0,
    onReply: jest.fn(),
    onQuote: jest.fn(),
    onChanged: jest.fn(),
    ...over,
  };
}

const order = () => screen.getAllByTestId("message").map((el) => el.getAttribute("data-id"));

describe("BoardFeed", () => {
  it("lists the messages newest first", () => {
    render(<BoardFeed {...feedProps()} />);
    expect(order()).toEqual(["p3", "p2", "p1"]);
    expect(screen.getByRole("heading", { level: 2, name: "Realm board" })).toBeInTheDocument();
  });

  it("invites the first message on an empty board", () => {
    render(<BoardFeed {...feedProps(boardData([]))} />);
    expect(screen.getByText("Start the conversation")).toBeInTheDocument();
  });

  it("does not ask a reader who cannot post to start one", () => {
    render(
      <BoardFeed
        {...feedProps(
          boardData([], { access: boardAccess({ canPost: false, reason: "sign_in" }) })
        )}
      />
    );
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(screen.queryByText("Start the conversation")).toBeNull();
  });

  it("passes a reply up with the message", () => {
    const props = feedProps();
    render(<BoardFeed {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply to p2" }));
    expect(props.onReply).toHaveBeenCalledWith(expect.objectContaining({ id: "p2" }));
  });

  describe("typing and the live notice", () => {
    it.each([
      [["Fiannria"], "Fiannria is typing"],
      [["Fiannria", "Kir"], "Fiannria and Kir are typing"],
      [["Fiannria", "Kir", "Urcea"], "3 people are typing"],
    ])("says who is typing: %j", (names, line) => {
      render(<BoardFeed {...feedProps(undefined, { typing: names })} />);
      expect(screen.getByText(line)).toBeInTheDocument();
    });

    it("shows no typing line when nobody types", () => {
      render(<BoardFeed {...feedProps()} />);
      expect(screen.queryByText(/typing/)).toBeNull();
    });

    it("says live updates are paused, and polling, while the socket is down", () => {
      const { rerender } = render(<BoardFeed {...feedProps(undefined, { live: false })} />);
      expect(screen.getByText("Live updates paused, retrying")).toBeInTheDocument();
      rerender(<BoardFeed {...feedProps(undefined, { live: true })} />);
      expect(screen.queryByText("Live updates paused, retrying")).toBeNull();
    });
  });

  describe("new messages while the reader is away from the top", () => {
    it("takes a new message at the top when the reader is at the top", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollToTop();
      rerender(
        <BoardFeed {...feedProps(boardData([msg("p4"), msg("p3"), msg("p2"), msg("p1")]))} />
      );
      expect(order()).toEqual(["p4", "p3", "p2", "p1"]);
      expect(screen.queryByRole("button", { name: /Jump to newest/ })).toBeNull();
    });

    it("holds the list still and offers Jump to newest, then shows them on click", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollAway();
      rerender(
        <BoardFeed
          {...feedProps(boardData([msg("p5"), msg("p4"), msg("p3"), msg("p2"), msg("p1")]))}
        />
      );
      expect(order()).toEqual(["p3", "p2", "p1"]);
      const jump = screen.getByRole("button", { name: /Jump to newest/ });
      expect(jump).toHaveTextContent("2 new");
      fireEvent.click(jump);
      expect(order()).toEqual(["p5", "p4", "p3", "p2", "p1"]);
      expect(screen.queryByRole("button", { name: /Jump to newest/ })).toBeNull();
    });

    it("still applies an edit or a removal to a message already on the list", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollAway();
      rerender(
        <BoardFeed {...feedProps(boardData([msg("p4"), msg("p3", "edited"), msg("p1")]))} />
      );
      expect(order()).toEqual(["p3", "p1"]);
      expect(within(screen.getAllByTestId("message")[0]!).getByText("edited")).toBeInTheDocument();
    });

    it("releases the hold when the reader returns to the top", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollAway();
      rerender(
        <BoardFeed {...feedProps(boardData([msg("p4"), msg("p3"), msg("p2"), msg("p1")]))} />
      );
      expect(order()).toEqual(["p3", "p2", "p1"]);
      scrollToTop();
      expect(order()).toEqual(["p4", "p3", "p2", "p1"]);
    });

    it("shows the newest at once after the reader posts", () => {
      const scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollAway();
      rerender(
        <BoardFeed
          {...feedProps(boardData([msg("p4"), msg("p3"), msg("p2"), msg("p1")]), { showLatest: 1 })}
        />
      );
      expect(order()).toEqual(["p4", "p3", "p2", "p1"]);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });
  });

  describe("accessibility and the sticky header", () => {
    it("is a feed, and busy while an earlier page loads", () => {
      pages.p1 = { isLoading: true };
      render(<BoardFeed {...feedProps(boardData([msg("p1")], { hasMore: true }))} />);
      const feed = screen.getByRole("feed");
      expect(feed).toHaveAttribute("aria-busy", "false");
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(feed).toHaveAttribute("aria-busy", "true");
    });

    it("announces held messages politely, and stops when they are shown", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      const status = () =>
        screen.getAllByRole("status").find((el) => el.className.includes("sr-only"))!;
      expect(status()).toHaveTextContent("");
      scrollAway();
      rerender(
        <BoardFeed {...feedProps(boardData([msg("p4"), msg("p3"), msg("p2"), msg("p1")]))} />
      );
      expect(status()).toHaveAttribute("aria-live", "polite");
      expect(status()).toHaveTextContent("1 new message");
      rerender(
        <BoardFeed
          {...feedProps(boardData([msg("p5"), msg("p4"), msg("p3"), msg("p2"), msg("p1")]))}
        />
      );
      expect(status()).toHaveTextContent("2 new messages");
      fireEvent.click(screen.getByRole("button", { name: /Jump to newest/ }));
      expect(status()).toHaveTextContent("");
    });

    it("counts the top as out of view once it is under the sticky header", () => {
      render(<BoardFeed {...feedProps()} />);
      expect(observerOptions?.rootMargin).toMatch(/^-\d+px 0px 0px 0px$/);
    });

    it("leaves room under the header when it scrolls the top into view", () => {
      const { container } = render(<BoardFeed {...feedProps()} />);
      expect(container.querySelector(".scroll-mt-24[aria-hidden]")).not.toBeNull();
    });
  });

  describe("earlier messages", () => {
    it("shows a message once when a moved cursor returns it again", () => {
      pages.p1 = { data: boardData([msg("p2"), msg("o2"), msg("o1")]) };
      const { container } = render(
        <BoardFeed
          {...feedProps(boardData([msg("p3"), msg("p2"), msg("p1")], { hasMore: true }))}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(order()).toEqual(["p3", "p2", "p1", "o2", "o1"]);
      expect(container.querySelectorAll("[data-id='p2']")).toHaveLength(1);
    });

    it("offers Load earlier messages only when the board has more", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      expect(screen.queryByRole("button", { name: "Load earlier messages" })).toBeNull();
      rerender(
        <BoardFeed
          {...feedProps(boardData([msg("p3"), msg("p2"), msg("p1")], { hasMore: true }))}
        />
      );
      expect(screen.getByRole("button", { name: "Load earlier messages" })).toBeInTheDocument();
    });

    it("pages back from the oldest message, one page after another", () => {
      pages.p1 = { data: boardData([msg("o2"), msg("o1")], { hasMore: true }) };
      pages.o1 = { data: boardData([msg("n1")]) };
      render(
        <BoardFeed
          {...feedProps(boardData([msg("p3"), msg("p2"), msg("p1")], { hasMore: true }))}
        />
      );
      expect(asked.some((a) => a.before)).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(order()).toEqual(["p3", "p2", "p1", "o2", "o1"]);
      expect(asked).toContainEqual({ realm: "eurth", before: "p1" });
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(order()).toEqual(["p3", "p2", "p1", "o2", "o1", "n1"]);
      expect(asked).toContainEqual({ realm: "eurth", before: "o1" });
      expect(screen.queryByRole("button", { name: "Load earlier messages" })).toBeNull();
    });

    it("pages back from the true oldest message while newer ones are held", () => {
      pages.p1 = { data: boardData([msg("o1")]) };
      const { rerender } = render(
        <BoardFeed
          {...feedProps(boardData([msg("p3"), msg("p2"), msg("p1")], { hasMore: true }))}
        />
      );
      scrollAway();
      rerender(
        <BoardFeed
          {...feedProps(boardData([msg("p4"), msg("p3"), msg("p2"), msg("p1")], { hasMore: true }))}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(order()).toEqual(["p3", "p2", "p1", "o1"]);
    });

    it("shows that an earlier page is loading, and lets the reader retry a failed one", () => {
      const refetch = jest.fn();
      pages.p1 = { isLoading: true };
      const props = feedProps(boardData([msg("p1")], { hasMore: true }));
      const { rerender } = render(<BoardFeed {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Load earlier messages" }));
      expect(screen.getByText("Loading earlier messages")).toBeInTheDocument();
      pages.p1 = { isError: true, refetch };
      rerender(<BoardFeed {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(refetch).toHaveBeenCalled();
    });
  });
});
