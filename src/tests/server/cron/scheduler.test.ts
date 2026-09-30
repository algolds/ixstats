/** @jest-environment node */
import {
  isValidCronPattern,
  matchesCron,
  startScheduler,
  type ScheduledTask,
} from "~/server/cron/scheduler";

const at = (iso: string): Date => new Date(`${iso}Z`);

describe("matchesCron", () => {
  it.each([
    ["*/5 * * * *", "2026-09-23T10:05:00", true],
    ["*/5 * * * *", "2026-09-23T10:06:00", false],
    ["0 */6 * * *", "2026-09-23T06:00:00", true],
    ["0 */6 * * *", "2026-09-23T07:00:00", false],
    ["0 2 * * *", "2026-09-23T02:00:00", true],
    ["0 2 * * *", "2026-09-23T02:01:00", false],
    ["* * * * *", "2026-09-23T13:37:00", true],
    ["15,45 * * * *", "2026-09-23T10:45:00", true],
    ["15,45 * * * *", "2026-09-23T10:30:00", false],
    ["0 9-17 * * *", "2026-09-23T17:00:00", true],
    ["0 9-17 * * *", "2026-09-23T18:00:00", false],
    ["0 0 * * 1-5", "2026-09-27T00:00:00", false], // Sunday
    ["0 0 * * 0", "2026-09-27T00:00:00", true],
    ["* * * *", "2026-09-23T10:00:00", false],
  ])("%s at %s → %s", (pattern, iso, expected) => {
    expect(matchesCron(pattern, at(iso))).toBe(expected);
  });
});

describe("isValidCronPattern", () => {
  it("accepts 5-field patterns and rejects anything else", () => {
    expect(isValidCronPattern("0 */6 * * *")).toBe(true);
    expect(isValidCronPattern("15,45 9-17/2 * * 1-5")).toBe(true);
    expect(isValidCronPattern("every day")).toBe(false);
    expect(isValidCronPattern("* * * *")).toBe(false);
    expect(isValidCronPattern("")).toBe(false);
  });
});

/** Drives startScheduler with a fake clock and a manually fired timer. */
function harness(tasks: readonly ScheduledTask[], startIso: string) {
  let clock = at(startIso).getTime();
  let pending: (() => void) | null = null;
  const logs: string[] = [];
  const handle = startScheduler(tasks, {
    now: () => clock,
    setTimer: (fn) => {
      pending = fn;
      return setTimeout(() => undefined, 0);
    },
    clearTimer: (t) => clearTimeout(t),
    log: (msg) => logs.push(msg),
  });
  const fireAt = async (iso: string): Promise<void> => {
    clock = at(iso).getTime();
    const fn = pending;
    pending = null;
    fn?.();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { handle, logs, fireAt };
}

describe("startScheduler", () => {
  it("fires an every-minute task once per minute, even if the timer fires twice", async () => {
    const run = jest.fn(async () => undefined);
    const { handle, fireAt } = harness(
      [{ name: "t", schedule: "* * * * *", run }],
      "2026-09-23T10:00:30"
    );

    await fireAt("2026-09-23T10:01:00.250");
    await fireAt("2026-09-23T10:01:40"); // early/extra fire within the same minute
    await fireAt("2026-09-23T10:02:00.250");
    await fireAt("2026-09-23T10:03:00.250");
    handle.stop();

    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not start a task again while it is still running", async () => {
    let finish: () => void = () => undefined;
    const run = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const { handle, logs, fireAt } = harness(
      [{ name: "slow", schedule: "* * * * *", run }],
      "2026-09-23T10:00:30"
    );

    await fireAt("2026-09-23T10:01:00.250");
    await fireAt("2026-09-23T10:02:00.250");
    expect(run).toHaveBeenCalledTimes(1);
    expect(logs).toContain("[Cron] slow still running — skipped this minute");

    finish();
    await new Promise((resolve) => setImmediate(resolve)); // let the run's finally settle
    await fireAt("2026-09-23T10:03:00.250");
    handle.stop();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("logs a failing task and still runs the others", async () => {
    const failing = jest.fn(async () => {
      throw new Error("boom");
    });
    const healthy = jest.fn(async () => undefined);
    const { handle, logs, fireAt } = harness(
      [
        { name: "failing", schedule: "* * * * *", run: failing },
        { name: "healthy", schedule: "* * * * *", run: healthy },
      ],
      "2026-09-23T10:00:30"
    );

    await fireAt("2026-09-23T10:01:00.250");
    await fireAt("2026-09-23T10:02:00.250");
    handle.stop();

    expect(healthy).toHaveBeenCalledTimes(2);
    expect(failing).toHaveBeenCalledTimes(2);
    expect(logs.some((line) => line.startsWith("[Cron] failing failed: Error: boom"))).toBe(true);
  });

  it("only fires tasks whose schedule matches the minute", async () => {
    const run = jest.fn(async () => undefined);
    const { handle, fireAt } = harness(
      [{ name: "five", schedule: "*/5 * * * *", run }],
      "2026-09-23T10:03:30"
    );

    await fireAt("2026-09-23T10:04:00.250");
    await fireAt("2026-09-23T10:05:00.250");
    await fireAt("2026-09-23T10:06:00.250");
    handle.stop();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("arms the first timer for just after the next minute boundary", () => {
    const delays: number[] = [];
    const handle = startScheduler([], {
      now: () => at("2026-09-23T10:00:45").getTime(),
      setTimer: (_fn, ms) => {
        delays.push(ms);
        return setTimeout(() => undefined, 0);
      },
      clearTimer: (t) => clearTimeout(t),
    });
    handle.stop();
    expect(delays).toEqual([15_250]);
  });
});
