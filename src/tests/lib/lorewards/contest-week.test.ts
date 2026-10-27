/** @jest-environment node */
/** The ISO week a weekly Loreward is stored under (design decision 18). */
import { canonicalWeekly, isoWeekStart, weeklyKeyOfFirstDay } from "~/lib/lorewards/contest-week";

describe("weeklyKeyOfFirstDay", () => {
  it("keys a Monday-start week by its own ISO week", () => {
    expect(weeklyKeyOfFirstDay("2026-08-17")).toEqual({
      date: "2026-W34",
      dateStart: "2026-08-17",
      dateEnd: "2026-08-23",
    });
  });
  it("keys a Sunday-start week by the ISO week holding six of its days, and keeps its first day", () => {
    expect(weeklyKeyOfFirstDay("2023-01-01")).toEqual({
      date: "2023-W01",
      dateStart: "2023-01-01",
      dateEnd: "2023-01-07",
    });
    expect(weeklyKeyOfFirstDay("2026-03-22")).toEqual({
      date: "2026-W13",
      dateStart: "2026-03-22",
      dateEnd: "2026-03-28",
    });
  });
  it("crosses the year as ISO weeks do", () => {
    expect(weeklyKeyOfFirstDay("2024-12-31")?.date).toBe("2025-W01");
    expect(weeklyKeyOfFirstDay("2025-12-29")?.date).toBe("2026-W01");
  });
  it("refuses what is not a day", () => {
    expect(weeklyKeyOfFirstDay("2026-02-30")).toBeNull();
    expect(weeklyKeyOfFirstDay("2026-W34")).toBeNull();
    expect(weeklyKeyOfFirstDay("2026-8-17")).toBeNull();
  });
});

describe("canonicalWeekly and isoWeekStart", () => {
  it("reads an ISO key as Monday to Sunday", () => {
    expect(isoWeekStart("2026-W34")).toBe("2026-08-17");
    expect(canonicalWeekly("2026-W34")).toEqual({
      date: "2026-W34",
      dateStart: "2026-08-17",
      dateEnd: "2026-08-23",
    });
    expect(canonicalWeekly("2026-W53")?.dateStart).toBe("2026-12-28");
  });
  it("reads a day as the week's first day", () => {
    expect(canonicalWeekly("2026-08-17")).toEqual(weeklyKeyOfFirstDay("2026-08-17"));
  });
  it("refuses a week the year does not have, and anything else", () => {
    expect(isoWeekStart("2025-W53")).toBeNull();
    expect(canonicalWeekly("2025-W53")).toBeNull();
    expect(canonicalWeekly("2026-13-01")).toBeNull();
    expect(canonicalWeekly("week 34")).toBeNull();
  });
});
