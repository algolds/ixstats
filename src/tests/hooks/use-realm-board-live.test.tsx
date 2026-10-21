import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { BoardLiveEvent, BoardLiveMessage } from "~/lib/thinkpages-forum/board-live";
import type { ThinkPagesWebSocketHookOptions } from "~/lib/websocket/thinkpages-types";

/** The socket hook, controlled by the test: connection state, the options it was given, and what the board hook calls. */
const socket = {
  connected: false,
  options: undefined as ThinkPagesWebSocketHookOptions | undefined,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  emitTyping: jest.fn(),
};
jest.mock("~/hooks/useThinkPagesWebSocket", () => ({
  useThinkPagesWebSocket: (options: ThinkPagesWebSocketHookOptions) => {
    socket.options = options;
    return {
      clientState: { connected: socket.connected },
      subscribeToChannel: socket.subscribe,
      unsubscribeFromChannel: socket.unsubscribe,
      emitBoardTyping: socket.emitTyping,
    };
  },
}));
const auth = { isLoaded: true, isSignedIn: true, userId: "user_1" as string | undefined };
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ isLoaded: auth.isLoaded, isSignedIn: auth.isSignedIn }),
  useUser: () => ({ user: auth.userId ? { id: auth.userId } : null, isLoaded: auth.isLoaded }),
}));
jest.mock("~/trpc/react", () => ({ api: { thinkpagesForum: { getBoard: {} } } }));
jest.mock("@trpc/react-query", () => ({
  getQueryKey: () => [["thinkpagesForum", "getBoard"]],
}));

import { useRealmBoardLive } from "~/hooks/useRealmBoardLive";

const BOARD_KEY = [["thinkpagesForum", "getBoard"]];
const keyFor = (input: object) => [...BOARD_KEY, { input, type: "query" }];

const live = (
  id: string,
  minute: number,
  extra: Partial<BoardLiveMessage> = {}
): BoardLiveMessage => ({
  id,
  authorUserId: "u_member",
  authorPersonaId: null,
  importedAuthorName: null,
  author: { name: "member", handle: "member", avatarUrl: null, flagUrl: null, persona: false },
  role: null,
  isVisitor: false,
  visitorRealm: null,
  contentHtml: `<p>${id}</p>`,
  reactions: {},
  createdAt: new Date(Date.UTC(2026, 9, 10, 12, minute)).toISOString(),
  editedAt: null,
  replyTo: null,
  continued: null,
  ...extra,
});

const stored = (id: string, minute: number, extra: object = {}) => ({
  ...live(id, minute),
  createdAt: new Date(Date.UTC(2026, 9, 10, 12, minute)),
  editedAt: null,
  byViewer: false,
  canEdit: false,
  myReaction: null,
  ...extra,
});

const page = (
  messages: object[],
  extra: { hasMore?: boolean; moderator?: boolean; realmId?: string } = {}
) => ({
  realm: {
    id: extra.realmId ?? "r_eurth",
    slug: "eurth",
    name: "Eurth",
    emblemUrl: null,
    memberCount: 4,
    settings: { visitorsAllowed: true, slowModeSeconds: 0 },
  },
  messages,
  hasMore: extra.hasMore ?? false,
  access: { isModerator: extra.moderator ?? false, canPost: true },
});

type Page = ReturnType<typeof page>;
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const FIRST = keyFor({ realm: "eurth", limit: 50 });

const idsOf = (key = FIRST) =>
  (client.getQueryData<Page>(key)?.messages as { id: string }[]).map((m) => m.id);
const send = (event: BoardLiveEvent) => act(() => socket.options!.onBoardEvent!(event));

beforeEach(() => {
  jest.useFakeTimers();
  client = new QueryClient();
  socket.connected = false;
  socket.options = undefined;
  socket.subscribe.mockReset();
  socket.unsubscribe.mockReset();
  socket.emitTyping.mockReset();
  Object.assign(auth, { isLoaded: true, isSignedIn: true, userId: "user_1" });
});
afterEach(() => {
  jest.useRealTimers();
  client.clear();
});

function mount(connected: boolean, realmId = "r_eurth") {
  socket.connected = connected;
  const view = renderHook(() => useRealmBoardLive(realmId), { wrapper });
  return view;
}

describe("useRealmBoardLive connection and fallback", () => {
  it("connects anonymously only once the session has loaded, and asks for the signed-in user's id", () => {
    Object.assign(auth, { isLoaded: false, userId: undefined });
    mount(false);
    expect(socket.options).toMatchObject({ anonymous: false, accountId: undefined });
    Object.assign(auth, { isLoaded: true, userId: "user_9" });
    mount(false);
    expect(socket.options).toMatchObject({ anonymous: true, accountId: "user_9" });
  });
});

describe("useRealmBoardLive cache merge", () => {
  it("replaces an edited message in place, keeping the viewer's flags and a moderator's player id", () => {
    client.setQueryData(
      FIRST,
      page([
        stored("p2", 2),
        stored("p1", 1, {
          byViewer: true,
          canEdit: true,
          authorUserId: "u_player",
          authorPersonaId: "pa_x",
        }),
      ])
    );
    mount(true);
    send({
      type: "board:updated",
      realmId: "r_eurth",
      change: {
        type: "updated",
        message: live("p1", 1, {
          contentHtml: "<p>edited</p>",
          editedAt: "2026-10-10T12:05:00.000Z",
          authorUserId: null,
          authorPersonaId: "pa_x",
        }),
      },
    });
    expect(idsOf()).toEqual(["p2", "p1"]);
    expect(client.getQueryData<Page>(FIRST)!.messages[1]).toMatchObject({
      contentHtml: "<p>edited</p>",
      byViewer: true,
      canEdit: true,
      authorUserId: "u_player",
    });
  });

  it("drops a removed message for a reader", () => {
    client.setQueryData(FIRST, page([stored("p2", 2), stored("p1", 1)]));
    mount(true);
    send({ type: "board:updated", realmId: "r_eurth", change: { type: "removed", postId: "p2" } });
    expect(idsOf()).toEqual(["p1"]);
  });

  it("has a moderator refetch instead of dropping a hidden message, so the flagged copy stays", () => {
    client.setQueryData(
      FIRST,
      page([stored("p2", 2, { hidden: false }), stored("p1", 1, { hidden: false })], {
        moderator: true,
      })
    );
    const invalidate = jest.spyOn(client, "invalidateQueries");
    mount(true);
    send({ type: "board:updated", realmId: "r_eurth", change: { type: "removed", postId: "p2" } });
    expect(idsOf()).toEqual(["p2", "p1"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: BOARD_KEY });
  });

  it("keeps a moderator's verdicts on an edited message, and is cautious about a new one", () => {
    client.setQueryData(
      FIRST,
      page([stored("p1", 1, { hidden: false, moderable: false, sanctionable: true })], {
        moderator: true,
      })
    );
    mount(true);
    send({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "updated", message: live("p1", 1, { contentHtml: "<p>edit</p>" }) },
    });
    send({ type: "board:message", realmId: "r_eurth", message: live("p2", 2) });
    const [newest, edited] = client.getQueryData<Page>(FIRST)!.messages;
    expect(edited).toMatchObject({ moderable: false, sanctionable: true });
    expect(newest).toMatchObject({ moderable: false, sanctionable: false });
  });

  it("gives a reader no verdicts", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    mount(true);
    send({ type: "board:message", realmId: "r_eurth", message: live("p2", 2) });
    const [newest] = client.getQueryData<Page>(FIRST)!.messages;
    expect("moderable" in newest!).toBe(false);
  });
  it("ignores another realm's events and another realm's cached boards", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    const other = keyFor({ realm: "aurora", limit: 50 });
    client.setQueryData(other, page([stored("a1", 1)], { realmId: "r_aurora" }));
    mount(true);
    send({ type: "board:message", realmId: "r_aurora", message: live("a2", 2) });
    expect(idsOf()).toEqual(["p1"]);
    send({ type: "board:message", realmId: "r_eurth", message: live("p2", 2) });
    expect(idsOf(other)).toEqual(["a1"]);
  });
});

describe("useRealmBoardLive reactions", () => {
  it("gives a message first seen on the wire no reaction of the viewer's", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    mount(true);
    send({
      type: "board:message",
      realmId: "r_eurth",
      message: live("p2", 2, { reactions: { fire: 3 } }),
    });
    expect(client.getQueryData<Page>(FIRST)!.messages[0]).toMatchObject({
      id: "p2",
      reactions: { fire: 3 },
      myReaction: null,
    });
  });
});

describe("useRealmBoardLive typing and presence", () => {
  it("sends typing at most once a second, with the persona only when given, and never signed out", () => {
    const { result } = mount(true);
    send({ type: "board:presence", realmId: "r_eurth", count: 1 });
    act(() => {
      result.current.sendTyping();
      result.current.sendTyping("pa_news");
    });
    expect(socket.emitTyping).toHaveBeenCalledTimes(1);
    expect(socket.emitTyping).toHaveBeenCalledWith({ realmId: "r_eurth", personaId: null });
    act(() => jest.advanceTimersByTime(1_000));
    act(() => result.current.sendTyping("pa_news"));
    expect(socket.emitTyping).toHaveBeenLastCalledWith({
      realmId: "r_eurth",
      personaId: "pa_news",
    });
  });
});
