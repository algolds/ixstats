import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    section: undefined as unknown,
    happenings: undefined as unknown,
    sectionInputs: [] as unknown[],
    happeningsInputs: [] as unknown[],
    happeningsOptions: [] as Array<Record<string, unknown> | undefined>,
    boardOptions: [] as Array<Record<string, unknown> | undefined>,
    mutations: {} as Record<string, jest.Mock>,
    setData: jest.fn(),
    cancel: jest.fn(() => Promise.resolve()),
    invalidate: jest.fn(() => Promise.resolve()),
  };
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: state.mutations[name], isPending: false }),
  });
  return {
    state,
    api: {
      useUtils: () => ({
        thinkpagesForum: {
          getBoard: {
            setData: state.setData,
            cancel: state.cancel,
            invalidate: state.invalidate,
          },
        },
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
        realmSection: {
          useQuery: (input: unknown) => {
            state.sectionInputs.push(input);
            return { data: state.section };
          },
        },
        postBoardMessage: mutation("postBoardMessage"),
      },
      realms: {
        region: {
          happenings: {
            useQuery: (input: unknown, options?: Record<string, unknown>) => {
              state.happeningsInputs.push(input);
              state.happeningsOptions.push(options);
              return { data: state.happenings };
            },
          },
        },
      },
      thinkpagesForumMod: { editPost: mutation("modEditPost") },
    },
  };
});
jest.mock("~/hooks/useRealmBoardLive", () => {
  const live = {
    connected: true,
    live: true,
    paused: false,
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
jest.mock("~/components/thinkpages-forum/realm/BoardSettingsPanel", () => ({
  BoardSettingsPanel: ({ realmId, slug }: { realmId: string; slug: string }) => (
    <section aria-label="Board settings" data-realm-id={realmId} data-slug={slug} />
  ),
}));
jest.mock("~/components/thinkpages-forum/realm/BoardFeed", () => ({
  BoardFeed: ({
    data,
    showLatest,
    paused,
    typing,
    onReply,
    onQuote,
    onChanged,
    onStart,
  }: {
    data: { messages: Array<{ id: string; contentHtml: string; author: { name: string } }> };
    showLatest: number;
    paused: boolean;
    typing: string[];
    onReply: (m: unknown) => void;
    onQuote: (m: unknown) => void;
    onChanged: () => void;
    onStart: () => void;
  }) => (
    <div data-testid="feed" data-show-latest={showLatest} data-paused={String(paused)}>
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
      <button type="button" onClick={onStart}>
        start
      </button>
    </div>
  ),
}));
jest.mock("~/components/thinkpages-forum/realm/BoardComposer", () => {
  const composerFocus = jest.fn();
  return {
    composerFocus,
    BoardComposer: ({
      ref,
      replyTo,
      quote,
      onQuoteInserted,
      onClearReply,
      onTyping,
      onSubmit,
      slowModeSeconds,
      docked,
    }: {
      ref?: React.Ref<{ focus: () => void }>;
      replyTo: { postId: string; authorName: string } | null;
      quote: { key: number; text: string } | null;
      onQuoteInserted: () => void;
      onClearReply: () => void;
      onTyping: (personaId: string | null) => void;
      onSubmit: (input: object) => Promise<void>;
      slowModeSeconds: number;
      docked?: boolean;
    }) => {
      React.useImperativeHandle(ref, () => ({ focus: composerFocus }), []);
      return (
        <div data-testid="composer" data-slow={slowModeSeconds} data-docked={String(!!docked)}>
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
      );
    },
  };
});

import { RealmLanding } from "~/components/thinkpages-forum/realm/RealmLanding";

const { state } = jest.requireMock<{
  state: {
    board: Query;
    boardOptions: Array<Record<string, unknown> | undefined>;
    section: unknown;
    happenings: unknown;
    sectionInputs: unknown[];
    happeningsInputs: unknown[];
    happeningsOptions: Array<Record<string, unknown> | undefined>;
    mutations: Record<string, jest.Mock>;
    setData: jest.Mock;
    cancel: jest.Mock;
    invalidate: jest.Mock;
  };
}>("~/trpc/react");
const { live } = jest.requireMock<{
  live: {
    connected: boolean;
    live: boolean;
    paused: boolean;
    typing: string[];
    online: number | null;
    sendTyping: jest.Mock;
    refetchInterval: number | false;
  };
}>("~/hooks/useRealmBoardLive");
const { auth } = jest.requireMock<{ auth: { isSignedIn: boolean } }>("~/context/auth-context");

const originalMatchMedia = window.matchMedia;

function installViewport({ wide, phone }: { wide: boolean; phone: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches:
      query === "(min-width: 1280px)" ? wide : query === "(max-width: 767px)" ? phone : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

const section = {
  realm: { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active" },
  categories: [
    {
      key: "hub",
      name: "Hub",
      description: "",
      icAllowed: false,
      postRole: "any",
      threadCount: 4,
      lastPostAt: new Date(),
      latest: { threadId: "t1", threadTitle: "Harbour tax", at: new Date() },
    },
    {
      key: "current-events",
      name: "Current Events",
      description: "",
      icAllowed: true,
      postRole: "any",
      threadCount: 0,
      lastPostAt: null,
      latest: null,
    },
  ],
};
const happenings = {
  items: [
    { id: "activity:1", at: new Date(), kind: "activity", text: "Passed a trade act", href: null },
  ],
  nextCursor: null,
};

const messages = [
  boardMessage({ id: "p2", contentHtml: "Second" }),
  boardMessage({ id: "p1", contentHtml: "First" }),
];

beforeEach(() => {
  jest.clearAllMocks();
  state.boardOptions.length = 0;
  state.sectionInputs.length = 0;
  state.happeningsInputs.length = 0;
  state.happeningsOptions.length = 0;
  state.section = undefined;
  state.happenings = undefined;
  installViewport({ wide: false, phone: false });
  state.board = { data: boardData(messages) };
  state.mutations = {};
  Object.assign(live, {
    connected: true,
    live: true,
    paused: false,
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

    it("marks a realm without an emblem with a tinted realm mark, not a grey tile", () => {
      const { container } = render(<RealmLanding realm="eurth" />);
      const mark = container.querySelector('[data-slot="page-header"] .size-16')!;
      expect(mark).toHaveClass("bg-tint-fill", "text-tint");
      expect(mark).not.toHaveClass("bg-fill-3");
    });

    it("has no ThinkPages trail above the name, only the back link and the facts", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByRole("navigation", { name: "breadcrumb" })).toBeNull();
      expect(screen.getByRole("link", { name: "ThinkPages" })).toHaveAttribute(
        "href",
        "/thinkpages"
      );
    });

    it("puts the realm picker in the header toolbar on a wide screen", () => {
      installViewport({ wide: true, phone: false });
      const { container } = render(<RealmLanding realm="eurth" />);
      expect(container.querySelector('[data-slot="page-header-toolbar"]')).toContainElement(
        screen.getByLabelText("Other realms")
      );
    });

    it("moves the realm picker under the title on a phone, out of the toolbar the top chrome covers", () => {
      installViewport({ wide: false, phone: true });
      const { container } = render(<RealmLanding realm="eurth" />);
      const picker = screen.getByLabelText("Other realms");
      expect(container.querySelector('[data-slot="page-header-toolbar"]')).not.toContainElement(
        picker
      );
      expect(container.querySelector('[data-slot="forum-page-actions"]')).toContainElement(picker);
    });

    it("lists the other realms, opening their landing pages", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByLabelText("Other realms")).toHaveAttribute("data-value", "eurth");
      expect(screen.getByText("Kiro-Borea /thinkpages/r/kiro")).toBeInTheDocument();
    });
  });

  describe("rail", () => {
    beforeEach(() => installViewport({ wide: true, phone: false }));

    it("reads the realm's boards and its five latest public actions", () => {
      state.section = section;
      state.happenings = happenings;
      render(<RealmLanding realm="eurth" />);
      expect(state.sectionInputs.at(-1)).toEqual({ realm: "eurth" });
      expect(state.happeningsInputs.at(-1)).toEqual({
        slug: "eurth",
        kinds: ["activity"],
        limit: 5,
      });
    });

    it("shows the boards, who is online, and recent actions in the realm", () => {
      state.section = section;
      state.happenings = happenings;
      render(<RealmLanding realm="eurth" />);
      const rail = screen.getByRole("complementary");
      expect(within(rail).getByRole("link", { name: /Hub/ })).toHaveAttribute(
        "href",
        "/thinkpages/r/eurth/hub"
      );
      expect(within(rail).getByText("people in the room")).toBeInTheDocument();
      expect(
        within(rail).getByRole("heading", { name: "Recent actions in Eurth" })
      ).toBeInTheDocument();
      expect(within(rail).getByText("Passed a trade act")).toBeInTheDocument();
    });

    it("has no rail, and no Info button, when no panel has anything to show", () => {
      live.online = null;
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByRole("complementary")).toBeNull();
      expect(screen.queryByRole("button", { name: "Info" })).toBeNull();
    });

    it("has a rail on the online count alone", () => {
      render(<RealmLanding realm="eurth" />);
      expect(
        within(screen.getByRole("complementary")).getByText("people in the room")
      ).toBeInTheDocument();
    });

    it("offers the board settings to those who may change them, with the realm's current rules", () => {
      state.board = {
        data: boardData(messages, { access: boardAccess({ canManageSettings: true }) }),
      };
      render(<RealmLanding realm="eurth" />);
      const settings = within(screen.getByRole("complementary")).getByLabelText("Board settings");
      expect(settings).toHaveAttribute("data-realm-id", "r_eurth");
      expect(settings).toHaveAttribute("data-slug", "eurth");
    });

    it("keeps the board settings from everyone else, officers without the board power included", () => {
      state.section = section;
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByLabelText("Board settings")).toBeNull();
    });

    it("opens the rail in the Info sheet below the wide layout", () => {
      installViewport({ wide: false, phone: false });
      state.section = section;
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "Info" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("link", { name: /Hub/ })).toBeInTheDocument();
    });
  });

  describe("phone", () => {
    beforeEach(() => installViewport({ wide: false, phone: true }));

    it("docks the composer above the tab bar", () => {
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByTestId("composer")).toHaveAttribute("data-docked", "true");
    });

    it("leaves room after the feed for the dock", () => {
      const { container } = render(<RealmLanding realm="eurth" />);
      const spacer = container.querySelector('[data-slot="dock-spacer"]')!;
      expect(spacer).not.toBeNull();
      expect(
        screen.getByTestId("feed").compareDocumentPosition(spacer) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("leaves no room when the viewer cannot post, so nothing is docked", () => {
      state.board = {
        data: boardData(messages, { access: boardAccess({ canPost: false, reason: "sign_in" }) }),
      };
      const { container } = render(<RealmLanding realm="eurth" />);
      expect(container.querySelector('[data-slot="dock-spacer"]')).toBeNull();
    });

    it("does not dock the composer on larger screens", () => {
      installViewport({ wide: false, phone: false });
      render(<RealmLanding realm="eurth" />);
      expect(screen.getByTestId("composer")).toHaveAttribute("data-docked", "false");
    });

    it("lists the boards as chips under the header, and not again in the Info sheet", () => {
      state.section = section;
      render(<RealmLanding realm="eurth" />);
      const chips = screen.getByRole("navigation", { name: "Boards" });
      expect(within(chips).getByRole("link", { name: "Hub" })).toHaveAttribute(
        "href",
        "/thinkpages/r/eurth/hub"
      );
      expect(within(chips).getByRole("link", { name: "Current Events" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Info" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByRole("heading", { name: "Boards" })).toBeNull();
      expect(within(dialog).getByText("people in the room")).toBeInTheDocument();
    });

    it("shows no chips off the phone", () => {
      installViewport({ wide: true, phone: false });
      state.section = section;
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByRole("navigation", { name: "Boards" })).toBeNull();
    });

    it("has no Info button on a phone with nothing for the sheet", () => {
      live.online = null;
      state.section = section;
      render(<RealmLanding realm="eurth" />);
      expect(screen.queryByRole("button", { name: "Info" })).toBeNull();
    });
  });

  describe("an empty board's way in", () => {
    it("takes the writer to the composer, through its handle", () => {
      const { composerFocus } = jest.requireMock<{ composerFocus: jest.Mock }>(
        "~/components/thinkpages-forum/realm/BoardComposer"
      );
      composerFocus.mockClear();
      render(<RealmLanding realm="eurth" />);
      fireEvent.click(screen.getByRole("button", { name: "start" }));
      expect(composerFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe("recent actions read", () => {
    it("asks once and does not retry, so a failure costs one request", () => {
      render(<RealmLanding realm="eurth" />);
      expect(state.happeningsOptions.at(-1)).toMatchObject({ enabled: true, retry: false });
    });

    it("does not ask for a realm without a row of its own (IxWorld, synthesized)", () => {
      const base = boardData(messages);
      state.board = { data: { ...base, realm: { ...base.realm, hasRow: false } } };
      render(<RealmLanding realm="eurth" />);
      expect(state.happeningsOptions.at(-1)).toMatchObject({ enabled: false });
    });
  });

  describe("live updates", () => {
    it("polls the board while the socket is down and stops when it is live", () => {
      live.live = false;
      live.refetchInterval = 10_000;
      const { rerender } = render(<RealmLanding realm="eurth" />);
      expect(state.boardOptions.at(-1)).toMatchObject({ refetchInterval: 10_000 });
      live.live = true;
      live.refetchInterval = false;
      rerender(<RealmLanding realm="eurth" />);
      expect(state.boardOptions.at(-1)).toMatchObject({ refetchInterval: false });
    });

    it("polls without a word until a connected socket drops, then tells the feed it is paused", () => {
      live.live = false;
      live.refetchInterval = 10_000;
      const { rerender } = render(<RealmLanding realm="eurth" />);
      expect(screen.getByTestId("feed")).toHaveAttribute("data-paused", "false");
      live.paused = true;
      rerender(<RealmLanding realm="eurth" />);
      expect(screen.getByTestId("feed")).toHaveAttribute("data-paused", "true");
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
      // An in-flight poll is cancelled first, or it could overwrite the upsert.
      expect(state.cancel).toHaveBeenCalledWith({ realm: "eurth" });
      expect(state.cancel.mock.invocationCallOrder[0]).toBeLessThan(
        state.setData.mock.invocationCallOrder[0]!
      );
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
