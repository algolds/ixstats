/**
 * P2-13: MyCountry diplomacy dates are in-game dates. A relation's "Established" and "Last contact" (and an event's
 * date) are stored wall-clock timestamps, converted to the nation's realm clock when shown, so none reads
 * Oct 25, 2026 beside a directive's Jun 30, 2042. A directive's "Enacted on" and a PvP challenge's end date follow
 * the same rule. Realm time: the date reads in the nation's realm calendar.
 */
import fs from "fs";
import path from "path";
import { IxTime } from "~/lib/ixtime";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { formatStampAsClockDate } from "~/lib/realms/nation-time";
import { REAL_NOW, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

const STAMP = "2026-10-25T12:00:00.000Z";

it("shows a stored wall-clock stamp as its in-game date on Ixnay's clock", () => {
  const ms = new Date(STAMP).getTime();
  const reader = ixnayReader();
  const shown = formatStampAsClockDate(STAMP, reader);
  expect(shown).toBe(formatRealmDate(IxTime.convertToIxTime(ms), reader.calendar));
  expect(shown).not.toContain("2026");
  expect(formatStampAsClockDate(new Date(ms), reader)).toBe(shown);
});

it("shows it in another realm's calendar on that realm's clock", () => {
  expect(formatStampAsClockDate(new Date(REAL_NOW), sixTimesReader())).toBe("14 Thaw 812 AE");
});

it("falls back when there is no stamp", () => {
  const reader = ixnayReader();
  expect(formatStampAsClockDate(null, reader)).toBe("N/A");
  expect(formatStampAsClockDate(undefined, reader, "Never")).toBe("Never");
  expect(formatStampAsClockDate("not a date", reader)).toBe("N/A");
});

it.each([
  "src/components/mycountry/domains/diplomacy/DiplomaticRelationsList.tsx",
  "src/components/mycountry/domains/diplomacy/DiplomaticEventsHub.tsx",
  "src/components/mycountry/shell/IntentDetail.tsx",
  "src/components/mycountry/domains/defense/operations/PvPConflictPanel.tsx",
])("%s formats its stored dates on the nation's clock", (file) => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
  expect(source).toContain("formatStampAsClockDate(");
  expect(source).toContain("useNationClock()");
  expect(source).not.toMatch(/toLocaleDateString\(|Intl\.DateTimeFormat/);
});
