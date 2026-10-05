import type { PrismaClient } from "@prisma/client";
import { cronHealth, recordCronRun } from "~/lib/system/cron-runs";

describe("cronHealth", () => {
  it("reports the latest run, its status and the latest success per job", async () => {
    const at = (iso: string) => ({ startedAt: new Date(iso) });
    const db = {
      cronRun: {
        groupBy: jest.fn().mockResolvedValue([
          { job: "passive-income", status: "success", _max: at("2026-10-04T00:00:00Z") },
          { job: "passive-income", status: "failed", _max: at("2026-10-05T00:00:00Z") },
          { job: "db-backup", status: "success", _max: at("2026-10-05T03:17:00Z") },
          { job: "db-backup", status: "skipped", _max: at("2026-10-01T03:17:00Z") },
        ]),
      },
    } as unknown as PrismaClient;

    await expect(cronHealth(db)).resolves.toEqual({
      "passive-income": {
        lastRunAt: "2026-10-05T00:00:00.000Z",
        lastStatus: "failed",
        lastSuccessAt: "2026-10-04T00:00:00.000Z",
      },
      "db-backup": {
        lastRunAt: "2026-10-05T03:17:00.000Z",
        lastStatus: "success",
        lastSuccessAt: "2026-10-05T03:17:00.000Z",
      },
    });
  });
});

describe("recordCronRun", () => {
  it("never throws when the write fails", async () => {
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
