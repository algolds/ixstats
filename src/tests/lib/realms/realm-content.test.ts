import {
  holdPurgeAfter,
  inactivityReleaseDate,
  inactivityStep,
  realmInactivityDays,
  realmReclaimWindowExclusive,
} from "~/lib/realms/realm-content";

const DAY = 86_400_000;
const now = new Date("2026-10-11T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe("realmInactivityDays", () => {
  it("defaults to 90 days, except in Ixnay, which opts in", () => {
    expect(realmInactivityDays("eurth-id", null)).toBe(90);
    expect(realmInactivityDays("eurth-id", { other: 1 })).toBe(90);
    expect(realmInactivityDays("default", {})).toBeNull();
    expect(realmInactivityDays("default", { inactivityDays: 60 })).toBe(60);
  });

  it("reads a period in range, null as off, and anything else as the default", () => {
    expect(realmInactivityDays("r", { inactivityDays: 30 })).toBe(30);
    expect(realmInactivityDays("r", { inactivityDays: 365 })).toBe(365);
    expect(realmInactivityDays("r", { inactivityDays: null })).toBeNull();
    expect(realmInactivityDays("r", { inactivityDays: 29 })).toBe(90);
    expect(realmInactivityDays("r", { inactivityDays: 400 })).toBe(90);
    expect(realmInactivityDays("r", { inactivityDays: 45.5 })).toBe(90);
    expect(realmInactivityDays("r", { inactivityDays: "60" })).toBe(90);
  });
});

it("keeps a nation for its former holder only when the realm says so", () => {
  expect(realmReclaimWindowExclusive({ reclaimWindowExclusive: true })).toBe(true);
  expect(realmReclaimWindowExclusive({ reclaimWindowExclusive: "yes" })).toBe(false);
  expect(realmReclaimWindowExclusive(null)).toBe(false);
});

describe("inactivityStep", () => {
  const step = (lastSeen: number | null, notice: number | null) =>
    inactivityStep({
      lastSeenAt: lastSeen === null ? null : daysAgo(lastSeen),
      noticeAt: notice === null ? null : daysAgo(notice),
      now,
      days: 90,
    });

  it("leaves an active owner, and an owner never seen, alone", () => {
    expect(step(10, null)).toBe("none");
    expect(step(90, null)).toBe("none");
    expect(step(null, null)).toBe("none");
  });

  it("warns once the period has passed, waits 14 days, then releases", () => {
    expect(step(91, null)).toBe("notify");
    expect(step(100, 13)).toBe("wait");
    expect(step(104, 14)).toBe("release");
  });

  it("un-warns an owner who came back", () => {
    expect(step(1, 5)).toBe("reset");
  });
});

it("dates the release 14 days after the notice, and the purge 30 or 180 days after a hold", () => {
  expect(inactivityReleaseDate(now).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  expect(holdPurgeAfter("released", now).toISOString()).toBe("2026-11-10T00:00:00.000Z");
  expect(holdPurgeAfter("inactive", now).toISOString()).toBe("2027-04-09T00:00:00.000Z");
});
