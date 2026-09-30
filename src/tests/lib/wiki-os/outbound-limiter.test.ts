/** @jest-environment node */
/**
 * Plan 404 review: the read path's calls to MediaWiki (imports of missing pages, authorship) are
 * capped in flight and per minute; past a cap the task is not started and ThrottledError says so.
 */
import { OutboundLimiter, ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";

function limiter(maxConcurrent: number, perMinute: number) {
  const clock = { now: 1_000_000 };
  return {
    clock,
    limiter: new OutboundLimiter({
      name: "Testing",
      maxConcurrent,
      perMinute,
      now: () => clock.now,
    }),
  };
}

const pending = () => {
  let finish!: () => void;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
};

describe("OutboundLimiter", () => {
  it("runs a task and returns its result", async () => {
    await expect(limiter(2, 10).limiter.run(async () => "done")).resolves.toBe("done");
  });

  it("refuses a task past the concurrency cap, without queueing it, and frees the slot when one ends", async () => {
    const { limiter: l } = limiter(2, 100);
    const a = pending();
    const b = pending();
    const first = l.run(() => a.promise);
    const second = l.run(() => b.promise);

    const refused = jest.fn();
    await expect(l.run(refused)).rejects.toBeInstanceOf(ThrottledError);
    expect(refused).not.toHaveBeenCalled();

    a.finish();
    await first;
    await expect(l.run(async () => "now there is room")).resolves.toBe("now there is room");
    b.finish();
    await second;
  });

  it("frees the slot when a task fails", async () => {
    const { limiter: l } = limiter(1, 100);

    await expect(l.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(l.run(async () => "fine")).resolves.toBe("fine");
  });

  it("holds calls to a steady rate: a full bucket, then one token per interval", async () => {
    const { limiter: l, clock } = limiter(10, 60); // 60 a minute: one a second
    for (let n = 0; n < 60; n++) await l.run(async () => n);

    await expect(l.run(async () => "61st")).rejects.toThrow("Testing is busy");

    clock.now += 1_000;
    await expect(l.run(async () => "after a second")).resolves.toBe("after a second");
    await expect(l.run(async () => "no more")).rejects.toBeInstanceOf(ThrottledError);

    clock.now += 10 * 60_000; // long idle: the bucket never holds more than a minute's worth
    for (let n = 0; n < 60; n++) await l.run(async () => n);
    await expect(l.run(async () => "61st again")).rejects.toBeInstanceOf(ThrottledError);
  });

  it("does not spend a token on a task the concurrency cap turned away", async () => {
    const { limiter: l } = limiter(1, 2);
    const held = pending();
    const running = l.run(() => held.promise);

    await expect(l.run(async () => 1)).rejects.toBeInstanceOf(ThrottledError); // cap, not bucket
    held.finish();
    await running;
    await expect(l.run(async () => 2)).resolves.toBe(2); // the second token was still there
  });
});
