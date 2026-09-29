/** @jest-environment node */
import { shouldTouchLastSeen, touchLastSeen } from "~/server/api/trpc/last-seen";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("lastSeenAt throttle", () => {
  it("touches when never seen or older than a day", () => {
    expect(shouldTouchLastSeen(null, NOW)).toBe(true);
    expect(shouldTouchLastSeen(new Date(NOW.getTime() - 25 * 3600e3), NOW)).toBe(true);
    expect(shouldTouchLastSeen(new Date(NOW.getTime() - 3600e3), NOW)).toBe(false);
  });

  it("writes fire-and-forget and swallows errors", async () => {
    const update = jest.fn().mockRejectedValue(new Error("db down"));
    touchLastSeen({ user: { update } } as any, { id: "u1", lastSeenAt: null }, NOW);
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { lastSeenAt: NOW } });
    await new Promise((r) => setImmediate(r)); // no unhandled rejection
  });
});
