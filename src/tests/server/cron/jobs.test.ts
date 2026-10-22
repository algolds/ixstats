/** @jest-environment node */
/**
 * The cron corpus. The job table (plan 330): unique names, valid default schedules, the lock names manual triggers
 * share, and every job's modulePath resolving to its export (checked by reading source, not importing it, which would
 * pull Prisma into Jest); which jobs are enabled and on what schedule; a result summary that never throws, nor does a
 * run's audit write. The scheduler: the 5-field pattern matcher, once per minute, no overlap, a failing task isolated.
 *
 * Folds scheduler and cron-runs.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import {
  CRON_JOBS,
  resolveEnabledJobs,
  resolveSchedule,
  summarizeResult,
} from "~/server/cron/jobs";
import {
  isValidCronPattern,
  matchesCron,
  startScheduler,
  type ScheduledTask,
} from "~/server/cron/scheduler";
import { recordCronRun } from "~/lib/system/cron-runs";

const rootDir = path.resolve(__dirname, "../../../..");
const moduleFile = (modulePath: string): string =>
  path.join(rootDir, `src/${modulePath.replace(/^~\//, "")}.ts`);

describe("CRON_JOBS", () => {
  it("has unique names and valid default schedules", () => {
    const names = CRON_JOBS.map((job) => job.name);
    expect(new Set(names).size).toBe(names.length);
    for (const job of CRON_JOBS) {
      expect(isValidCronPattern(job.defaultSchedule)).toBe(true);
    }
  });

  it("keeps the lock names that manual triggers share (plan 328)", () => {
    const lockOf = (name: string) => CRON_JOBS.find((job) => job.name === name)?.lockName;
    expect(lockOf("lorewards-full-sync")).toBe("lorewards");
    expect(lockOf("lorewards-state-sync")).toBe("lorewards");
  });
  it("points every job at an existing module and export, the specifier its load() imports", () => {
    const source = fs.readFileSync(path.join(rootDir, "src/server/cron/jobs.ts"), "utf-8");
    const broken = CRON_JOBS.filter((job) => {
      const file = moduleFile(job.modulePath);
      return (
        !fs.existsSync(file) ||
        !fs.readFileSync(file, "utf-8").includes(`export async function ${job.exportName}(`) ||
        !source.includes(`import("${job.modulePath}")`)
      );
    }).map((job) => `${job.name}: ${job.modulePath}#${job.exportName}`);
    expect(broken).toEqual([]);
    expect(CRON_JOBS.length).toBeGreaterThan(30);
  });
});

describe("resolveEnabledJobs", () => {
  it("enables nothing when unset or empty and everything for *", () => {
    expect(resolveEnabledJobs(undefined)).toEqual({ enabled: [], unknown: [] });
    expect(resolveEnabledJobs(" , ")).toEqual({ enabled: [], unknown: [] });
    expect(resolveEnabledJobs("*").enabled).toHaveLength(CRON_JOBS.length);
  });

  it("enables the named jobs and reports unknown names", () => {
    const { enabled, unknown } = resolveEnabledJobs("elections, trade-expiry");
    expect(enabled.map((job) => job.name).sort()).toEqual(["elections", "trade-expiry"]);
    expect(unknown).toEqual([]);
    expect(resolveEnabledJobs("*,electionz").unknown).toEqual(["electionz"]);
  });
});

describe("resolveSchedule", () => {
  const job = CRON_JOBS.find((j) => j.name === "card-values")!;

  it("uses a valid SystemConfig override", () => {
    expect(resolveSchedule(job, new Map([["cronSchedule_cardValue", " 0 */3 * * * "]]))).toBe(
      "0 */3 * * *"
    );
  });

  it("falls back to the default for a missing or invalid override", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveSchedule(job, new Map())).toBe("0 */6 * * *");
    expect(resolveSchedule(job, new Map([["cronSchedule_cardValue", "hourly"]]))).toBe(
      "0 */6 * * *"
    );
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("ignores overrides for jobs without a config key", () => {
    const elections = CRON_JOBS.find((j) => j.name === "elections")!;
    expect(resolveSchedule(elections, new Map([["cronSchedule_cardValue", "0 1 * * *"]]))).toBe(
      "*/10 * * * *"
    );
  });
});

describe("run results", () => {
  it("summarizes a result, capped, and never throws on an unserializable one", () => {
    expect(summarizeResult(3)).toBe("3");
    expect(summarizeResult({ resolved: 1 })).toBe('{"resolved":1}');
    expect(summarizeResult({ s: "x".repeat(1000) })).toHaveLength(300);
    const circular: { self?: object } = {};
    circular.self = circular;
    expect(summarizeResult(circular)).toBe("[unserializable result]");
  });

  it("never throws into the job when a run's audit write fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const db = {
      cronRun: { create: jest.fn().mockRejectedValue(new Error("db down")) },
    } as unknown as PrismaClient;
    const now = new Date();
    await expect(
      recordCronRun(db, { job: "x", status: "success", startedAt: now, finishedAt: now })
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

const at = (iso: string): Date => new Date(`${iso}Z`);

describe("matchesCron", () => {
  it.each([
    ["*/5 * * * *", "2026-09-23T10:05:00", true],
    ["0 2 * * *", "2026-09-23T02:01:00", false],
    ["15,45 * * * *", "2026-09-23T10:45:00", true],
    ["0 9-17 * * *", "2026-09-23T18:00:00", false],
    ["0 0 * * 1-5", "2026-09-27T00:00:00", false], // Sunday
    ["0 0 * * 0", "2026-09-27T00:00:00", true],
    ["* * * *", "2026-09-23T10:00:00", false],
  ])("%s at %s → %s", (pattern, iso, expected) => {
    expect(matchesCron(pattern, at(iso))).toBe(expected);
  });

  it("validates 5-field patterns only", () => {
    expect(isValidCronPattern("15,45 9-17/2 * * 1-5")).toBe(true);
    expect(isValidCronPattern("every day")).toBe(false);
    expect(isValidCronPattern("* * * *")).toBe(false);
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
});
