import { act, renderHook } from "@testing-library/react";

type Handler = (data?: object) => void;
const fake = {
  handlers: new Map<string, Handler[]>(),
  connected: true,
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  /** Whether socket.io is still retrying by itself. */
  active: true,
  options: undefined as
    | {
        auth: (cb: (auth: { token: string }) => void) => void;
        reconnectionAttempts: number;
        reconnectionDelay: number;
        reconnectionDelayMax: number;
      }
    | undefined,
  on(name: string, handler: Handler) {
    fake.handlers.set(name, [...(fake.handlers.get(name) ?? []), handler]);
    return fake;
  },
};
const mockIo = jest.fn((_url: string, options: typeof fake.options) => {
  fake.options = options;
  return fake;
});
jest.mock("socket.io-client", () => ({
  io: (url: string, options: never) => mockIo(url, options),
}));

let getToken: (() => Promise<string | null>) | undefined;
let isSignedIn = true;
jest.mock("~/context/auth-context", () => ({ useAuth: () => ({ getToken, isSignedIn }) }));

import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";

const env = process.env as Record<string, string | undefined>;
const saved = env.NEXT_PUBLIC_ENABLE_WEBSOCKET;
const fire = (name: string, data?: object) =>
  act(() => fake.handlers.get(name)?.forEach((handler) => handler(data)));

beforeEach(() => {
  env.NEXT_PUBLIC_ENABLE_WEBSOCKET = "true";
  fake.handlers.clear();
  fake.connected = true;
  fake.active = true;
  fake.connect.mockReset();
  fake.emit.mockReset();
  mockIo.mockClear();
  getToken = async () => "clerk-token";
  isSignedIn = true;
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  env.NEXT_PUBLIC_ENABLE_WEBSOCKET = saved;
  jest.restoreAllMocks();
});

describe("useThinkPagesWebSocket for realm boards", () => {
  it("connects a signed-out reader when asked to, flagged anonymous with an empty token", async () => {
    getToken = async () => null;
    isSignedIn = false;
    renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
    expect(mockIo).toHaveBeenCalledTimes(1);
    const auth = await new Promise<{ token: string }>((resolve) => fake.options!.auth(resolve));
    expect(auth).toEqual({ token: "", anonymous: true });
  });

  it("does not demote a signed-in user whose token could not be fetched to anonymous", async () => {
    getToken = async () => {
      throw new Error("network");
    };
    renderHook(() => useThinkPagesWebSocket({ accountId: "user_1", anonymous: true }));
    const auth = await new Promise<{ token: string }>((resolve) => fake.options!.auth(resolve));
    expect(auth).toEqual({ token: "" });
    getToken = async () => null;
    renderHook(() => useThinkPagesWebSocket({ accountId: "user_1", anonymous: true }));
    expect(await new Promise((resolve) => fake.options!.auth(resolve))).toEqual({ token: "" });
  });

  it("still sends a signed-in user's token", async () => {
    renderHook(() => useThinkPagesWebSocket({ accountId: "user_1", anonymous: true }));
    const auth = await new Promise<{ token: string }>((resolve) => fake.options!.auth(resolve));
    expect(auth).toEqual({ token: "clerk-token" });
  });

  it("does not connect without an account unless anonymous reading was asked for", () => {
    renderHook(() => useThinkPagesWebSocket({}));
    expect(mockIo).not.toHaveBeenCalled();
  });

  it("does not connect signed out without a token source unless anonymous", () => {
    getToken = undefined;
    renderHook(() => useThinkPagesWebSocket({ accountId: "user_1" }));
    expect(mockIo).not.toHaveBeenCalled();
    renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it("hands valid board events to the caller and drops malformed ones", () => {
    const onBoardEvent = jest.fn();
    renderHook(() => useThinkPagesWebSocket({ anonymous: true, onBoardEvent }));
    fire("board:presence", { type: "board:presence", realmId: "r1", count: 2 });
    fire("board:presence", { type: "board:presence", realmId: "r1" });
    fire("board:typing", { type: "board:presence", realmId: "r1", count: "2" });
    expect(onBoardEvent).toHaveBeenCalledTimes(1);
    expect(onBoardEvent).toHaveBeenCalledWith({ type: "board:presence", realmId: "r1", count: 2 });
  });

  it("subscribes, unsubscribes and sends typing only while connected", () => {
    const { result } = renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
    act(() => {
      result.current.subscribeToChannel("realm-board:r1");
      result.current.emitBoardTyping({ realmId: "r1", personaId: null });
      result.current.unsubscribeFromChannel("realm-board:r1");
    });
    expect(fake.emit.mock.calls).toEqual([
      ["subscribe", { channel: "realm-board:r1" }],
      ["board:typing", { realmId: "r1", personaId: null }],
      ["unsubscribe", { channel: "realm-board:r1" }],
    ]);
    fake.emit.mockReset();
    fake.connected = false;
    act(() => result.current.subscribeToChannel("realm-board:r1"));
    expect(fake.emit).not.toHaveBeenCalled();
  });

  describe("losing the connection", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => jest.useRealTimers());

    it("never gives up retrying a lost connection, backing off to a cap", () => {
      renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
      const { reconnectionAttempts, reconnectionDelay, reconnectionDelayMax } = fake.options!;
      expect(reconnectionAttempts).toBe(Infinity);
      expect(reconnectionDelayMax).toBeGreaterThan(reconnectionDelay);
      expect(reconnectionDelayMax).toBeLessThanOrEqual(60_000);
    });

    it("connects again, with a growing and capped wait, when socket.io has stopped trying", () => {
      renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
      fake.active = false;
      const waits: number[] = [];
      for (let i = 0; i < 8; i++) {
        fire("connect_error", new Error("refused"));
        let waited = 0;
        while (fake.connect.mock.calls.length === i && waited < 60_000) {
          act(() => void jest.advanceTimersByTime(1_000));
          waited += 1_000;
        }
        waits.push(waited);
      }
      expect(waits[0]).toBe(2_000);
      expect(waits[1]).toBe(4_000);
      expect(Math.max(...waits)).toBeLessThanOrEqual(30_000);
      expect(waits[7]).toBe(30_000);
    });

    it("leaves a connection socket.io is still retrying alone, and starts the waits over once connected", () => {
      renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
      fire("connect_error", new Error("refused"));
      act(() => void jest.advanceTimersByTime(120_000));
      expect(fake.connect).not.toHaveBeenCalled();
      fake.active = false;
      fire("connect_error", new Error("refused"));
      act(() => void jest.advanceTimersByTime(2_000));
      fire("connect");
      fire("disconnect");
      act(() => void jest.advanceTimersByTime(2_000));
      expect(fake.connect).toHaveBeenCalledTimes(2);
    });

    it("stops retrying once the hook is gone", () => {
      const { unmount } = renderHook(() => useThinkPagesWebSocket({ anonymous: true }));
      fake.active = false;
      fire("connect_error", new Error("refused"));
      unmount();
      act(() => void jest.advanceTimersByTime(120_000));
      expect(fake.connect).not.toHaveBeenCalled();
    });
  });
});
