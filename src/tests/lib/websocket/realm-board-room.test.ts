/** @jest-environment node */
import { TypingThrottle } from "~/lib/websocket/realm-board-room";

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
