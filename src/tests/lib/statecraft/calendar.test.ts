import { getUpcomingEvents, formatRelativeIxDays, formatIxCountdown } from "~/lib/statecraft/calendar";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

describe("getUpcomingEvents", () => {
  it("keeps only future events, soonest first", () => {
    const out = getUpcomingEvents({
      nowIxTime: NOW,
      elections: [
        { id: "a", name: "General Election", scheduledIxTime: NOW + 10 * DAY, status: "upcoming" },
        { id: "b", name: "Past Election", scheduledIxTime: NOW - 5 * DAY, status: "upcoming" },
        { id: "c", name: "Done", scheduledIxTime: NOW + 2 * DAY, status: "completed" },
      ],
      issueDeadlines: [
        { id: "i1", title: "Border crisis", deadlineIxTime: NOW + 3 * DAY },
        { id: "i2", title: "No deadline", deadlineIxTime: null },
      ],
      termEndIxTime: NOW + 30 * DAY,
    });
    expect(out.map((e) => e.id)).toEqual(["issue-i1", "election-a", "term-end"]);
    // completed election dropped, past dropped, undated issue dropped
    expect(out.find((e) => e.id === "election-c")).toBeUndefined();
  });

  it("handles empty inputs", () => {
    expect(getUpcomingEvents({ nowIxTime: NOW })).toEqual([]);
  });
});

describe("formatRelativeIxDays", () => {
  it("buckets sensibly", () => {
    expect(formatRelativeIxDays(NOW, NOW)).toBe("today");
    expect(formatRelativeIxDays(NOW + DAY, NOW)).toBe("tomorrow");
    expect(formatRelativeIxDays(NOW + 5 * DAY, NOW)).toBe("in 5 days");
    expect(formatRelativeIxDays(NOW + 21 * DAY, NOW)).toBe("in 3 weeks");
    expect(formatRelativeIxDays(NOW + 90 * DAY, NOW)).toBe("in 3 months");
  });
});

describe("formatIxCountdown", () => {
  it("renders fine-grained countdowns and clamps at now", () => {
    expect(formatIxCountdown(NOW, NOW)).toBe("now");
    expect(formatIxCountdown(NOW - 5000, NOW)).toBe("now");
    expect(formatIxCountdown(NOW + 45 * 60 * 1000, NOW)).toBe("45m");
    expect(formatIxCountdown(NOW + (6 * 3600 + 12 * 60) * 1000, NOW)).toBe("6h 12m");
    expect(formatIxCountdown(NOW + (2 * 86400 + 4 * 3600) * 1000, NOW)).toBe("2d 4h");
  });
});
