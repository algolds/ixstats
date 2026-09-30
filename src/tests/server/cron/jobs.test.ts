/** @jest-environment node */
/**
 * The cron job table (plan 330). Module files and exports are checked by reading source, not
 * importing it — importing would pull Prisma into Jest.
 */
import fs from "fs";
import path from "path";
import {
  CRON_JOBS,
  resolveEnabledJobs,
  resolveSchedule,
  summarizeResult,
} from "~/server/cron/jobs";
import { isValidCronPattern } from "~/server/cron/scheduler";

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
    expect(lockOf("passive-income")).toBe("passive-income");
    expect(lockOf("lorewards-full-sync")).toBe("lorewards");
    expect(lockOf("lorewards-state-sync")).toBe("lorewards");
  });

  it.each(CRON_JOBS.map((job) => [job.name, job] as const))(
    "%s points at an existing module and export",
    (_name, job) => {
      const file = moduleFile(job.modulePath);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf-8")).toContain(`export async function ${job.exportName}(`);
    }
  );

  it("each modulePath is the specifier its load() imports", () => {
    const source = fs.readFileSync(path.join(rootDir, "src/server/cron/jobs.ts"), "utf-8");
    for (const job of CRON_JOBS) {
      expect(source).toContain(`import("${job.modulePath}")`);
    }
  });
});

describe("resolveEnabledJobs", () => {
  it("enables nothing when unset or empty", () => {
    expect(resolveEnabledJobs(undefined)).toEqual({ enabled: [], unknown: [] });
    expect(resolveEnabledJobs(" , ")).toEqual({ enabled: [], unknown: [] });
  });

  it("enables everything for *", () => {
    expect(resolveEnabledJobs("*").enabled).toHaveLength(CRON_JOBS.length);
  });

  it("enables the named jobs", () => {
    const { enabled, unknown } = resolveEnabledJobs("elections, trade-expiry");
    expect(enabled.map((job) => job.name).sort()).toEqual(["elections", "trade-expiry"]);
    expect(unknown).toEqual([]);
  });

  it("reports unknown names", () => {
    expect(resolveEnabledJobs("electionz").unknown).toEqual(["electionz"]);
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

describe("summarizeResult", () => {
  it("serializes and caps the result", () => {
    expect(summarizeResult(3)).toBe("3");
    expect(summarizeResult({ resolved: 1 })).toBe('{"resolved":1}');
    expect(summarizeResult({ s: "x".repeat(1000) })).toHaveLength(300);
  });

  it("never throws on unserializable results", () => {
    const circular: { self?: object } = {};
    circular.self = circular;
    expect(summarizeResult(circular)).toBe("[unserializable result]");
  });
});
