/**
 * P2-13: MyCountry diplomacy dates are in-game dates. A relation's "Established" and "Last contact" (and an event's
 * date) are stored wall-clock timestamps, converted to IxTime when shown, so none reads Oct 25, 2026 beside a
 * directive's Jun 30, 2042. A directive's "Enacted on" and a PvP challenge's end date follow the same rule.
 */
import fs from "fs";
import path from "path";
import { IxTime } from "~/lib/ixtime";
import {
  formatIxDate,
  formatStampAsIxDate,
} from "~/components/mycountry/directives/directive-model";

const STAMP = "2026-10-25T12:00:00.000Z";

it("shows a stored wall-clock stamp as its IxTime date", () => {
  const ms = new Date(STAMP).getTime();
  const shown = formatStampAsIxDate(STAMP);
  expect(shown).toBe(formatIxDate(IxTime.convertToIxTime(ms)));
  expect(shown).not.toContain("2026");
  expect(formatStampAsIxDate(new Date(ms))).toBe(shown);
});

it("falls back when there is no stamp", () => {
  expect(formatStampAsIxDate(null)).toBe("N/A");
  expect(formatStampAsIxDate(undefined, "Never")).toBe("Never");
  expect(formatStampAsIxDate("not a date")).toBe("N/A");
});

it.each([
  "src/components/mycountry/domains/diplomacy/DiplomaticRelationsList.tsx",
  "src/components/mycountry/domains/diplomacy/DiplomaticEventsHub.tsx",
  "src/components/mycountry/shell/IntentDetail.tsx",
  "src/components/mycountry/domains/defense/operations/PvPConflictPanel.tsx",
])("%s formats its stored dates in IxTime", (file) => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
  expect(source).toContain("formatStampAsIxDate(");
  expect(source).not.toMatch(/toLocaleDateString\(|Intl\.DateTimeFormat/);
});
