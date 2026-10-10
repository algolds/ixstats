/** @jest-environment node */
import type { Socket } from "socket.io";
import { RealmBoardRooms, TypingThrottle } from "~/lib/websocket/realm-board-room";

describe("TypingThrottle", () => {
  it("allows one event per key per second", () => {
    const throttle = new TypingThrottle();
    expect(throttle.allow("u1|room", 1_000)).toBe(true);
    expect(throttle.allow("u1|room", 1_500)).toBe(false);
    expect(throttle.allow("u1|room", 1_999)).toBe(false);
    expect(throttle.allow("u1|room", 2_000)).toBe(true);
  });

  it("keeps users and rooms apart", () => {
    const throttle = new TypingThrottle();
    expect(throttle.allow("u1|a", 0)).toBe(true);
    expect(throttle.allow("u2|a", 0)).toBe(true);
    expect(throttle.allow("u1|b", 0)).toBe(true);
  });

  it("forgets idle keys once the map grows, without letting a recent one through", () => {
    const throttle = new TypingThrottle();
    for (let i = 0; i < 600; i += 1) throttle.allow(`u${i}|room`, 0);
    expect(throttle.allow("u0|room", 1_000)).toBe(true);
    expect(throttle.allow("u0|room", 1_100)).toBe(false);
  });
});

describe("RealmBoardRooms typing caches and logging", () => {
  const emitted: object[] = [];
  const socket = {
    rooms: new Set(["realm-board:r1"]),
    connected: true,
    to: () => ({ emit: (_name: string, event: object) => emitted.push(event) }),
  } as unknown as Socket;
  let now: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let clock = 1_000_000;

  beforeEach(() => {
    emitted.length = 0;
    clock = 1_000_000;
    now = jest.spyOn(Date, "now").mockImplementation(() => clock);
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    now.mockRestore();
    warn.mockRestore();
  });

  it("asks for the typing name again after 30 seconds, so a revoked persona stops", async () => {
    const boardTypingName = jest.fn(async () => "Persona Name");
    const rooms = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => true,
      boardTypingName,
    });
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    clock += 1_500;
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    expect(boardTypingName).toHaveBeenCalledTimes(1);
    clock += 30_000;
    boardTypingName.mockResolvedValueOnce(null as never);
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    expect(boardTypingName).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(2);
  });

  it("logs a failing check instead of swallowing it, and refuses", async () => {
    const rooms = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => {
        throw new Error("db down");
      },
      canJoinRealmBoard: async () => {
        throw new Error("db down");
      },
      boardTypingName: async () => {
        throw new Error("db down");
      },
    });
    await rooms.relayTyping(socket, "u1", { realmId: "r1" });
    expect(emitted).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] typing rights check failed:", "db down");
    await expect(rooms.join(socket, null, "r2")).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] join check failed:", "db down");
    const open = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => true,
      boardTypingName: async () => {
        throw new Error("db down");
      },
    });
    clock += 1_500;
    await open.relayTyping(socket, "u1", { realmId: "r1" });
    expect(emitted).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] typing name check failed:", "db down");
  });
});
