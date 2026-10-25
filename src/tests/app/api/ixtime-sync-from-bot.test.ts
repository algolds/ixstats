/** @jest-environment node */
/**
 * P1-32: a clock the bot pushes to the web process is persisted for the other processes (the cron runner reads it).
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { upsert: jest.fn(async () => ({})), findUnique: jest.fn(async () => null) },
  },
}));

import { POST } from "~/app/api/ixtime/sync-from-bot/route";
import { IxTime } from "~/lib/ixtime";
import { IXTIME_CLOCK_CONFIG_KEY } from "~/lib/ixtime/shared-clock";
import { db } from "~/server/db";

const mockUpsert = db.systemConfig.upsert as jest.Mock;

afterEach(() => {
  IxTime.loadClockState({ timeOverride: null, timeOverrideSetAt: null, multiplierOverride: null });
});

it("persists the clock the bot pushed", async () => {
  const ixTimeMs = Date.UTC(2050, 0, 1);
  const res = await POST(
    new Request("http://localhost/api/ixtime/sync-from-bot", {
      method: "POST",
      body: JSON.stringify({ ixTimeMs, multiplier: 0 }),
    })
  );
  expect(res.status).toBe(200);
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { key: IXTIME_CLOCK_CONFIG_KEY },
      update: { value: JSON.stringify(IxTime.getClockState()) },
    })
  );
  expect(IxTime.getClockState()).toMatchObject({
    timeOverride: ixTimeMs,
    multiplierOverride: 0,
  });
});
