/** @jest-environment node */
/** The chronicle dates and orders the record on the country's realm calendar, beside its lore years. */
import { buildChronicle, splitCanonFeed } from "~/app/countries/[slug]/_utils/profileLayer";
import { clockTimeAt } from "~/lib/realms/nation-time";
import {
  CLOCK_NOW,
  DAY,
  REAL_NOW,
  ixnayReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

describe("buildChronicle on a realm calendar", () => {
  it("dates realm-clock events in the realm's months and era, ordered among lore years", () => {
    const frost = sixTimesReader();
    const { diplomacy } = splitCanonFeed(
      [{ id: "dip_e1", kind: "diplomacy", title: "Treaty of Thaw", timestamp: REAL_NOW + DAY }],
      (ms) => clockTimeAt(frost, ms)
    );
    const entries = buildChronicle({
      calendar: frost.calendar,
      founding: [{ event: "Frostmark founded", date: "790" }],
      directives: [
        {
          id: "d1",
          goal: "Open the harbour",
          summary: null,
          createdIxTime: CLOCK_NOW + 20 * DAY,
        } as never,
      ],
      diplomacy,
    });
    expect(entries.map((e) => [e.title, e.dateLabel])).toEqual([
      ["Frostmark founded", "790"],
      ["Treaty of Thaw", "20 Thaw 812 AE"],
      ["Open the harbour", "4 Frostfall 812 AE"],
    ]);
    expect(entries[1]!.year).toBeGreaterThan(812);
    expect(entries[1]!.year).toBeLessThan(813);
  });

  it("keeps Ixnay's Gregorian dates", () => {
    const [entry] = buildChronicle({
      calendar: ixnayReader().calendar,
      decisions: [{ id: "i1", title: "Budget passed", ixTime: CLOCK_NOW }],
    });
    expect(entry!.dateLabel).toBe("2 June 2041");
    expect(Math.floor(entry!.year)).toBe(2041);
  });
});
