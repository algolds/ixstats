/** @jest-environment node */
/** Metric chart windows run on the country's realm clock, in its calendar's months, and label in its calendar. */
import { filterAndSortHistory } from "~/components/mycountry/shared/modals/metric-details/hooks/useMetricHistoryFilter";
import { addRealmMonths } from "~/lib/realms/nation-time";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

const keep = (_point: unknown, label: string, ts: string | number | Date) => ({ label, ts });

describe("filterAndSortHistory on a realm clock", () => {
  it("windows by the realm's months and labels in its calendar", () => {
    const frost = sixTimesReader();
    const cutoff = addRealmMonths(CLOCK_NOW, -3, frost.calendar);
    const rows = filterAndSortHistory(
      [
        { ixTimeTimestamp: cutoff - DAY, population: 1 },
        { ixTimeTimestamp: cutoff + DAY, population: 2 },
        { ixTimeTimestamp: CLOCK_NOW, population: 3 },
      ],
      "3m",
      keep,
      100,
      frost
    );
    expect(rows.map((r) => r.label)).toEqual(["Frostfall 810", "Thaw 812"]);
  });

  it("reads the window from that realm's own now, not Ixnay's", () => {
    // A 6× realm whose clock has run a year ahead of the shared instant still shows its last year.
    const ahead = { now: () => CLOCK_NOW + 365 * DAY, calendar: ixnayReader().calendar };
    const rows = filterAndSortHistory(
      [{ ixTimeTimestamp: CLOCK_NOW + 200 * DAY }, { ixTimeTimestamp: CLOCK_NOW - 30 * DAY }],
      "1y",
      keep,
      100,
      ahead
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe("December 2041");
  });
});
