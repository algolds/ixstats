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
  it("polls every 10 seconds while the socket is not connected, and says it is not live", () => {
    const { result } = mount(false);
    expect(result.current).toMatchObject({
      connected: false,
      live: false,
      refetchInterval: 10_000,
      online: null,
      typing: [],
    });
    expect(socket.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes to the realm's room once connected and stops polling when the room confirms", () => {
    const { result } = mount(true);
    expect(socket.subscribe).toHaveBeenCalledWith("realm-board:r_eurth");
    // Connected, but the join is only confirmed by the room's first presence event.
    expect(result.current).toMatchObject({ connected: true, live: false, refetchInterval: 10_000 });
    send({ type: "board:presence", realmId: "r_eurth", count: 3 });
    expect(result.current).toMatchObject({ live: true, refetchInterval: false, online: 3 });
  });

  it("goes back to polling and hides the online count when the socket drops, and resubscribes on return", () => {
    const view = mount(true);
    send({ type: "board:presence", realmId: "r_eurth", count: 3 });
    expect(view.result.current.live).toBe(true);

    socket.connected = false;
    view.rerender();
    expect(view.result.current).toMatchObject({
      live: false,
      online: null,
      refetchInterval: 10_000,
    });

    socket.subscribe.mockClear();
    socket.connected = true;
    view.rerender();
    expect(socket.subscribe).toHaveBeenCalledWith("realm-board:r_eurth");
  });

  it("leaves the room on unmount", () => {
    const view = mount(true);
    view.unmount();
    expect(socket.unsubscribe).toHaveBeenCalledWith("realm-board:r_eurth");
  });

  it("refetches the board when it goes live, to catch what it missed", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    mount(true);
    send({ type: "board:presence", realmId: "r_eurth", count: 1 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: BOARD_KEY });
  });

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
  it("adds a new message at the top and ignores a repeat of it", () => {
    client.setQueryData(FIRST, page([stored("p2", 2), stored("p1", 1)]));
    mount(true);
    const message: BoardLiveEvent = {
      type: "board:message",
      realmId: "r_eurth",
      message: live("p3", 3),
    };
    send(message);
    send(message);
    expect(idsOf()).toEqual(["p3", "p2", "p1"]);
    const added = client.getQueryData<Page>(FIRST)!.messages[0] as {
      createdAt: Date;
      byViewer: boolean;
      canEdit: boolean;
    };
    expect(added.createdAt).toBeInstanceOf(Date);
    expect(added).toMatchObject({ byViewer: false, canEdit: false });
  });

  it("does not duplicate a message the poll already fetched", () => {
    client.setQueryData(
      FIRST,
      page([stored("p3", 3, { byViewer: true, canEdit: true }), stored("p1", 1)])
    );
    mount(true);
    send({ type: "board:message", realmId: "r_eurth", message: live("p3", 3) });
    expect(idsOf()).toEqual(["p3", "p1"]);
    // The writer's own flags survive the echo of their message.
    expect(client.getQueryData<Page>(FIRST)!.messages[0]).toMatchObject({
      byViewer: true,
      canEdit: true,
    });
  });

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
    expect(newest).toMatchObject({ moderable: true, sanctionable: false });
  });

  it("gives a reader no verdicts", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    mount(true);
    send({ type: "board:message", realmId: "r_eurth", message: live("p2", 2) });
    const [newest] = client.getQueryData<Page>(FIRST)!.messages;
    expect("moderable" in newest!).toBe(false);
  });

  it("slots an unhidden message back where it belongs", () => {
    client.setQueryData(FIRST, page([stored("p3", 3), stored("p1", 1)]));
    mount(true);
    send({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "updated", message: live("p2", 2) },
    });
    expect(idsOf()).toEqual(["p3", "p2", "p1"]);
  });

  it("leaves a message older than the loaded page to the page that holds it", () => {
    client.setQueryData(FIRST, page([stored("p9", 9), stored("p8", 8)], { hasMore: true }));
    mount(true);
    send({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "updated", message: live("p1", 1) },
    });
    expect(idsOf()).toEqual(["p9", "p8"]);
  });

  it("only updates an older page (loaded with a cursor) for messages it already holds", () => {
    const older = keyFor({ realm: "eurth", limit: 50, before: "p8" });
    client.setQueryData(older, page([stored("p7", 7), stored("p6", 6)], { hasMore: true }));
    client.setQueryData(FIRST, page([stored("p9", 9), stored("p8", 8)], { hasMore: true }));
    mount(true);
    send({ type: "board:message", realmId: "r_eurth", message: live("p10", 10) });
    expect(idsOf(older)).toEqual(["p7", "p6"]);
    send({
      type: "board:updated",
      realmId: "r_eurth",
      change: { type: "updated", message: live("p7", 7, { contentHtml: "<p>edit</p>" }) },
    });
    expect(client.getQueryData<Page>(older)!.messages[0]).toMatchObject({
      contentHtml: "<p>edit</p>",
    });
    send({ type: "board:updated", realmId: "r_eurth", change: { type: "removed", postId: "p6" } });
    expect(idsOf(older)).toEqual(["p7"]);
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

  it("updates the cached board settings and refetches for the viewer's own access", () => {
    client.setQueryData(FIRST, page([stored("p1", 1)]));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    mount(true);
    send({
      type: "board:settings",
      realmId: "r_eurth",
      settings: { visitorsAllowed: false, slowModeSeconds: 30 },
    });
    expect(client.getQueryData<Page>(FIRST)!.realm.settings).toEqual({
      visitorsAllowed: false,
      slowModeSeconds: 30,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: BOARD_KEY });
  });

  it("does nothing to a query that has no board loaded", () => {
    mount(true);
    expect(() =>
      send({ type: "board:message", realmId: "r_eurth", message: live("p1", 1) })
    ).not.toThrow();
  });
});

describe("useRealmBoardLive typing and presence", () => {
  it("lists typing names, keeps one entry per name, and expires them after 5 seconds", () => {
    const { result } = mount(true);
    send({ type: "board:typing", realmId: "r_eurth", name: "Ada" });
    send({ type: "board:typing", realmId: "r_eurth", name: "Bo" });
    send({ type: "board:typing", realmId: "r_eurth", name: "Ada" });
    expect(result.current.typing).toEqual(["Ada", "Bo"]);

    act(() => jest.advanceTimersByTime(3_000));
    send({ type: "board:typing", realmId: "r_eurth", name: "Ada" });
    act(() => jest.advanceTimersByTime(3_000));
    // Bo's last event was 6s ago; Ada's was refreshed 3s ago.
    expect(result.current.typing).toEqual(["Ada"]);
    act(() => jest.advanceTimersByTime(2_100));
    expect(result.current.typing).toEqual([]);
  });

  it("drops a name when that author's message arrives", () => {
    const { result } = mount(true);
    send({ type: "board:typing", realmId: "r_eurth", name: "member" });
    send({ type: "board:message", realmId: "r_eurth", message: live("p1", 1) });
    expect(result.current.typing).toEqual([]);
  });

  it("ignores typing and presence for another realm", () => {
    const { result } = mount(true);
    send({ type: "board:typing", realmId: "r_other", name: "Ada" });
    send({ type: "board:presence", realmId: "r_other", count: 9 });
    expect(result.current).toMatchObject({ typing: [], online: null });
  });

  it("clears typing when the socket drops", () => {
    const view = mount(true);
    send({ type: "board:typing", realmId: "r_eurth", name: "Ada" });
    socket.connected = false;
    view.rerender();
    expect(view.result.current.typing).toEqual([]);
  });

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

  it("sends no typing when signed out or not live", () => {
    Object.assign(auth, { isSignedIn: false, userId: undefined });
    const signedOut = mount(true);
    send({ type: "board:presence", realmId: "r_eurth", count: 1 });
    act(() => signedOut.result.current.sendTyping());
    expect(socket.emitTyping).not.toHaveBeenCalled();

    Object.assign(auth, { isSignedIn: true, userId: "user_1" });
    const down = mount(false);
    act(() => down.result.current.sendTyping());
    expect(socket.emitTyping).not.toHaveBeenCalled();
  });

  it("does nothing without a realm", () => {
    socket.connected = true;
    const { result } = renderHook(() => useRealmBoardLive(null), { wrapper });
    expect(socket.subscribe).not.toHaveBeenCalled();
    expect(result.current.live).toBe(false);
  });
});
