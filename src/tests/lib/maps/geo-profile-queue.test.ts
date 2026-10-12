import { describeQueuedGeoProfiles } from "~/lib/maps/geo-profile-queue";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe("describeQueuedGeoProfiles", () => {
  it("says the job runs every 5 minutes and when it last ran", () => {
    const message = describeQueuedGeoProfiles({ queued: 3, lastRunAt: minutesAgo(3) });
    expect(message).toBe(
      "Queued 3 countries for recalculation. The geo-profiles job runs every 5 minutes; its last run was 3m ago."
    );
  });

  it("says no run is recorded and how to enable the job when it never ran", () => {
    const message = describeQueuedGeoProfiles({ queued: 1, lastRunAt: null });
    expect(message).toBe(
      "Queued 1 country for recalculation. No geo-profiles run is recorded: add geo-profiles to CRON_ENABLED_JOBS so the job runs every 5 minutes."
    );
  });

  it("says there is nothing to recalculate when no country has map geometry", () => {
    expect(describeQueuedGeoProfiles({ queued: 0, lastRunAt: minutesAgo(1) })).toBe(
      "No country has map geometry to recalculate."
    );
  });

  it("keeps to the copy rules (no em dashes)", () => {
    const messages = [
      describeQueuedGeoProfiles({ queued: 2, lastRunAt: null }),
      describeQueuedGeoProfiles({ queued: 2, lastRunAt: minutesAgo(10) }),
    ];
    for (const message of messages) expect(message).not.toMatch(/[–—]/);
  });
});
