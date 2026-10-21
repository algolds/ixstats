import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { boardData, boardMessage } from "~/tests/helpers/realm-board-fixtures";

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
jest.mock("~/components/action-links/DiscussionCountsProvider", () => {
  const provided = jest.fn();
  return {
    provided,
    DiscussionCountsProvider: ({
      activityIds,
      children,
    }: {
      activityIds: string[];
      children: React.ReactNode;
    }) => {
      provided(activityIds);
      return <>{children}</>;
    },
    useDiscussionCount: () => undefined,
  };
});
jest.mock("~/hooks/useThreadActionCards", () => ({
  ...jest.requireActual<typeof import("~/hooks/useThreadActionCards")>(
    "~/hooks/useThreadActionCards"
  ),
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

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(pages)) delete pages[key];
  asked.length = 0;
  observed = null;
  window.IntersectionObserver = class {
    constructor(callback: ObserverCallback) {
      observed = callback;
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
    paused: false,
    signedIn: true,
    tools: null,
    showLatest: 0,
    onReply: jest.fn(),
    onQuote: jest.fn(),
    onChanged: jest.fn(),
    onStart: jest.fn(),
    ...over,
  };
}

const order = () => screen.getAllByTestId("message").map((el) => el.getAttribute("data-id"));

describe("BoardFeed", () => {
  describe("new messages while the reader is away from the top", () => {
    it("still applies an edit or a removal to a message already on the list", () => {
      const { rerender } = render(<BoardFeed {...feedProps()} />);
      scrollAway();
      rerender(
        <BoardFeed {...feedProps(boardData([msg("p4"), msg("p3", "edited"), msg("p1")]))} />
      );
      expect(order()).toEqual(["p3", "p1"]);
      expect(within(screen.getAllByTestId("message")[0]!).getByText("edited")).toBeInTheDocument();
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
  });
});
