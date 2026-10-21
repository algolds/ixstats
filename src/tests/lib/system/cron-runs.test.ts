import type { PrismaClient } from "@prisma/client";
import { recordCronRun } from "~/lib/system/cron-runs";
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
