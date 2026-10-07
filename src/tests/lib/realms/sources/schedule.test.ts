/** @jest-environment node */
import { dueSyncs, isSyncDue, nextRunAt } from "~/lib/realms/sources/schedule";

const now = new Date("2026-10-07T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const sync = (over: Partial<Parameters<typeof isSyncDue>[0]> = {}) => ({
  realmId: "r",
  enabled: true,
  intervalHours: 24,
  lastRunAt: hoursAgo(25),
  ...over,
});

describe("isSyncDue", () => {
  it("is due once the interval has passed since the last run, and never run means due", () => {
    expect(isSyncDue(sync(), now)).toBe(true);
    expect(isSyncDue(sync({ lastRunAt: hoursAgo(24) }), now)).toBe(true);
    expect(isSyncDue(sync({ lastRunAt: hoursAgo(23) }), now)).toBe(false);
    expect(isSyncDue(sync({ lastRunAt: null }), now)).toBe(true);
  });

  it("never runs a disabled or manual-only sync", () => {
    expect(isSyncDue(sync({ enabled: false }), now)).toBe(false);
    expect(isSyncDue(sync({ intervalHours: null }), now)).toBe(false);
    expect(isSyncDue(sync({ intervalHours: 0 }), now)).toBe(false);
  });
});

describe("dueSyncs", () => {
  it("picks the due ones, longest overdue (never run) first", () => {
    const list = [
      sync({ realmId: "fresh", lastRunAt: hoursAgo(1) }),
      sync({ realmId: "old", lastRunAt: hoursAgo(100) }),
      sync({ realmId: "never", lastRunAt: null }),
      sync({ realmId: "weekly", intervalHours: 168, lastRunAt: hoursAgo(30) }),
      sync({ realmId: "due", lastRunAt: hoursAgo(26) }),
    ];
    expect(dueSyncs(list, now).map((s) => s.realmId)).toEqual(["never", "old", "due"]);
  });

  it("nextRunAt is null when off and counts from the last run otherwise", () => {
    expect(nextRunAt(sync({ enabled: false }), now)).toBeNull();
    expect(nextRunAt(sync({ lastRunAt: hoursAgo(10) }), now)).toEqual(new Date(now.getTime() + 14 * 3_600_000));
  });
});
