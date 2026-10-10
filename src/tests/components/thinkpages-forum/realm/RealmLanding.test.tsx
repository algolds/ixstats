import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { boardAccess, boardData, boardMessage } from "~/tests/helpers/realm-board-fixtures";

interface Query {
  data?: unknown;
  isLoading?: boolean;
  error?: { data?: { code: string } } | null;
  refetch?: () => void;
}

jest.mock("~/trpc/react", () => {
  const state = {
    board: {} as Query,
    boardOptions: [] as Array<Record<string, unknown> | undefined>,
    mutations: {} as Record<string, jest.Mock>,
    setData: jest.fn(),
    invalidate: jest.fn(() => Promise.resolve()),
  };
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: state.mutations[name], isPending: false }),
  });
  return {
    state,
    api: {
      useUtils: () => ({
        thinkpagesForum: { getBoard: { setData: state.setData, invalidate: state.invalidate } },
        thinkpagesForumMod: { invalidate: () => Promise.resolve() },
      }),
      thinkpagesForum: {
        getBoard: {
          useQuery: (_input: unknown, options?: Record<string, unknown>) => {
            state.boardOptions.push(options);
            return { isLoading: false, error: null, ...state.board };
          },
        },
        realms: {
          useQuery: () => ({
            data: {
              realms: [
                { slug: "eurth", name: "Eurth" },
                { slug: "kiro", name: "Kiro-Borea" },
              ],
            },
          }),
        },
        postBoardMessage: mutation("postBoardMessage"),
      },
      thinkpagesForumMod: { editPost: mutation("modEditPost") },
    },
  };
});
jest.mock("~/hooks/useRealmBoardLive", () => {
  const live = {
    connected: true,
    live: true,
    typing: [] as string[],
    online: 6 as number | null,
    sendTyping: jest.fn(),
    refetchInterval: false as number | false,
  };
  return { live, useRealmBoardLive: jest.fn(() => live) };
});
jest.mock("~/context/auth-context", () => {
  const auth = { isSignedIn: true };
  return { auth, useUser: () => ({ user: null, isSignedIn: auth.isSignedIn }) };
});
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/thinkpages/r/eurth",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("~/components/thinkpages-forum/RealmSwitcher", () => ({
  RealmSwitcher: ({
    realms,
    value,
    hrefFor,
  }: {
    realms: Array<{ slug: string; name: string }>;
    value: string;
    hrefFor: (slug: string) => string;
  }) => (
    <ul aria-label="Other realms" data-value={value}>
      {realms.map((r) => (
        <li key={r.slug}>{`${r.name} ${hrefFor(r.slug)}`}</li>
      ))}
    </ul>
  ),
}));
jest.mock("~/components/thinkpages-forum/realm/BoardFeed", () => ({
  BoardFeed: ({
    data,
    showLatest,
    live,
    typing,
    onReply,
    onQuote,
    onChanged,
  }: {
    data: { messages: Array<{ id: string; contentHtml: string; author: { name: string } }> };
    showLatest: number;
    live: boolean;
    typing: string[];
    onReply: (m: unknown) => void;
    onQuote: (m: unknown) => void;
    onChanged: () => void;
  }) => (
    <div data-testid="feed" data-show-latest={showLatest} data-live={String(live)}>
      <span>{typing.join(",")}</span>
      {data.messages.map((m) => (
        <div key={m.id}>
          <span>{m.contentHtml}</span>
          <button type="button" onClick={() => onReply(m)}>
            reply {m.id}
          </button>
          <button type="button" onClick={() => onQuote(m)}>
            quote {m.id}
          </button>
        </div>
      ))}
      <button type="button" onClick={onChanged}>
        changed
      </button>
    </div>
  ),
}));
jest.mock("~/components/thinkpages-forum/realm/BoardComposer", () => ({
  BoardComposer: ({
    replyTo,
    quote,
    onQuoteInserted,
    onClearReply,
    onTyping,
    onSubmit,
    slowModeSeconds,
  }: {
    replyTo: { postId: string; authorName: string } | null;
    quote: { key: number; text: string } | null;
    onQuoteInserted: () => void;
    onClearReply: () => void;
    onTyping: (personaId: string | null) => void;
    onSubmit: (input: object) => Promise<void>;
    slowModeSeconds: number;
  }) => (
    <div data-testid="composer" data-slow={slowModeSeconds}>
      <span>{replyTo ? `replying:${replyTo.postId}:${replyTo.authorName}` : "no reply"}</span>
      <span>{quote ? `quote:${quote.text}` : "no quote"}</span>
      <button type="button" onClick={onQuoteInserted}>
        quote inserted
      </button>
      <button type="button" onClick={onClearReply}>
        clear reply
      </button>
      <button type="button" onClick={() => onTyping("ps1")}>
        typing
      </button>
      <button
        type="button"
        onClick={() =>
          void onSubmit({ html: "<p>hi</p>", personaId: "ps1", replyToPostId: "p2" }).catch(
            () => undefined
          )
        }
      >
        submit
      </button>
    </div>
  ),
}));

import { RealmLanding } from "~/components/thinkpages-forum/realm/RealmLanding";

const { state } = jest.requireMock<{
  state: {
    board: Query;
    boardOptions: Array<Record<string, unknown> | undefined>;
    mutations: Record<string, jest.Mock>;
    setData: jest.Mock;
    invalidate: jest.Mock;
  };
}>("~/trpc/react");
const { live } = jest.requireMock<{
  live: {
    connected: boolean;
    live: boolean;
    typing: string[];
    online: number | null;
    sendTyping: jest.Mock;
    refetchInterval: number | false;
  };
}>("~/hooks/useRealmBoardLive");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");

const messages = [
  boardMessage({ id: "p2", contentHtml: "Second" }),
  boardMessage({ id: "p1", contentHtml: "First" }),
];

beforeEach(() => {
  jest.clearAllMocks();
  state.boardOptions.length = 0;
  state.board = { data: boardData(messages) };
  state.mutations = {};
  Object.assign(live, {
    connected: true,
    live: true,
    typing: [],
    online: 6,
    refetchInterval: false,
  });
  auth.isSignedIn = true;
});

describe("RealmLanding", () => {
  it("shows a skeleton while the board loads", () => {
    state.board = { isLoading: true };
    const { container } = render(<RealmLanding realm="eurth" />);
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
    expect(screen.queryByTestId("feed")).toBeNull();
  });

  it("says the realm was not found when the server does", () => {
    state.board = { error: { data: { code: "NOT_FOUND" } } };
    render(<RealmLanding realm="nope" />);
    expect(screen.getByText("Realm not found")).toBeInTheDocument();
  });

  it("offers a retry when the board fails to load", () => {
    const refetch = jest.fn();
    state.board = { error: { data: { code: "INTERNAL_SERVER_ERROR" } }, refetch };
    render(<RealmLanding realm="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  describe("header", () => {
    it("names the realm with its facts: members, who is online, and your standing", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByRole("heading", { level: 1, name: "Eurth" })).toBeInTheDocument();
      expect(screen.getByText("31 members · 6 online · You're a member")).toBeInTheDocument();
    });

    it("says Visitor to a visitor, and nothing of standing to a signed-out reader", () => {
      state.board = {
        data: boardData(messages, { access: boardAccess({ isMember: false, isVisitor: true }) }),
      };
      const { unmount } = render(<RealmLanding realm="eurth" />);
      expect(screen.getByText("31 members · 6 online · Visitor")).toBeInTheDocument();
      unmount();
      state.board = {
        data: boardData(messages, {
          access: boardAccess({ isMember: false, canPost: false, reason: "sign_in" }),
        }),
      };
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByText("31 members · 6 online")).toBeInTheDocument();
    });

    it("leaves the online count out while the socket is down, and counts one member in the singular", () => {
      live.online = null;
      live.live = false;
      state.board = {
        data: boardData(messages, {
          realm: { ...boardData([]).realm, memberCount: 1 },
        }),
      };
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByText("1 member · You're a member")).toBeInTheDocument();
    });

    it("shows the realm's emblem, else an icon", () => {
      const withEmblem = boardData(messages, {
        realm: { ...boardData([]).realm, emblemUrl: "https://cdn.example/eurth.png" },
      });
      state.board = { data: withEmblem };
      const { container, unmount } = render(<RealmLanding realm="eurth" />);
      expect(container.querySelector("img[src='https://cdn.example/eurth.png']")).not.toBeNull();
      unmount();
      state.board = { data: boardData(messages) };
      const plain = render(<RealmLanding realm="eurth" />);
      expect(plain.container.querySelector("img")).toBeNull();
      expect(plain.container.querySelector("svg")).not.toBeNull();
    });

    it("lists the other realms, opening their landing pages", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByLabelText("Other realms")).toHaveAttribute("data-value", "eurth");
      expect(screen.getByText("Kiro-Borea /thinkpages/r/kiro")).toBeInTheDocument();
    });

    it("has no rail yet", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByRole("button", { name: "Info" })).toBeNull();
    });
  });

  describe("live updates", () => {
    it("polls the board while the socket is down and stops when it is live", () => {
      live.live = false;
      live.refetchInterval = 10_000;
      const { rerender } = render(<RealmLanding realm="eurth" />);
      expect(state.boardOptions.at(-1)).toMatchObject({ refetchInterval: 10_000 });
      expect(screen.getByTestId("feed")).toHaveAttribute("data-live", "false");
      live.live = true;
      live.refetchInterval = false;
      rerender(<RealmLanding realm="eurth" />);
      expect(state.boardOptions.at(-1)).toMatchObject({ refetchInterval: false });
      expect(screen.getByTestId("feed")).toHaveAttribute("data-live", "true");
    });

    it("joins the room of the realm it loaded, and hands who is typing to the feed", () => {
      const { useRealmBoardLive } = jest.requireMock<{ useRealmBoardLive: jest.Mock }>(
        "~/hooks/useRealmBoardLive"
      );
      live.typing = ["Fiannria"];
      render(<RealmLanding realm="eurth" />);
      expect(useRealmBoardLive).toHaveBeenCalledWith("r_eurth");
      expect(screen.getByTestId("feed")).toHaveTextContent("Fiannria");
    });

    it("refreshes the board when a message changes", () => {
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "changed" }));
      expect(state.invalidate).toHaveBeenCalled();
    });
  });

  describe("composer", () => {
    it("sets the message to answer, and clears it", () => {
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "reply p2" }));
      expect(screen.getByText("replying:p2:kir")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "clear reply" }));
      expect(screen.getByText("no reply")).toBeInTheDocument();
    });

    it("quotes a message into the editor, once", () => {
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "quote p1" }));
      expect(screen.getByText(/^quote:kir wrote: "First"/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "quote inserted" }));
      expect(screen.getByText("no quote")).toBeInTheDocument();
    });

    it("sends typing with the chosen persona", () => {
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "typing" }));
      expect(live.sendTyping).toHaveBeenCalledWith("ps1");
    });

    it("hands the composer the realm's slow mode", () => {
      state.board = {
        data: boardData(messages, {
          realm: {
            ...boardData([]).realm,
            settings: { visitorsAllowed: true, slowModeSeconds: 30 },
          },
        }),
      };
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByTestId("composer")).toHaveAttribute("data-slow", "30");
    });

    it("posts, puts the message at the top of the newest page, and shows it", async () => {
      const posted = boardMessage({ id: "p3", contentHtml: "hi", byViewer: true });
      state.mutations.postBoardMessage = jest.fn().mockResolvedValue(posted);
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "submit" }));
      await waitFor(() =>
        expect(state.mutations.postBoardMessage).toHaveBeenCalledWith({
          realm: "eurth",
          html: "<p>hi</p>",
          personaId: "ps1",
          replyToPostId: "p2",
        })
      );
      await waitFor(() => expect(state.setData).toHaveBeenCalled());
      const [input, update] = state.setData.mock.calls[0] as [
        { realm: string },
        (old: ReturnType<typeof boardData> | undefined) => ReturnType<typeof boardData> | undefined,
      ];
      expect(input).toEqual({ realm: "eurth" });
      expect(update(boardData(messages))?.messages.map((m) => m.id)).toEqual(["p3", "p2", "p1"]);
      // The live event for the same message repeats it: merged by id, never twice.
      expect(update(boardData([posted, ...messages]))?.messages.map((m) => m.id)).toEqual([
        "p3",
        "p2",
        "p1",
      ]);
      expect(update(undefined)).toBeUndefined();
      expect(screen.getByTestId("feed")).toHaveAttribute("data-show-latest", "1");
    });

    it("keeps the feed as it is when the post is refused", async () => {
      state.mutations.postBoardMessage = jest.fn().mockRejectedValue(new Error("Nope"));
      render(<RealmLanding realm="eurth" />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "submit" }));
      });
      expect(state.setData).not.toHaveBeenCalled();
      expect(screen.getByTestId("feed")).toHaveAttribute("data-show-latest", "0");
    });
  });
});
