/**
 * Budget years and election names are stored as game years on the shared timeline ("2041"); a nation's displays read
 * them in its realm calendar ("812 AE"). Ixnay's calendar maps a year to itself; stored values never change.
 */
import { currentBudgetYear } from "~/lib/government/budget-year";
import {
  electionDisplayName,
  formatBudgetYear,
  formatRealmYear,
  realmYearOfGameYear,
} from "~/lib/realms/realm-year";
import { realmYear } from "~/lib/realms/nation-time";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

const frost = sixTimesReader();
const ixnay = ixnayReader();
const thisGameYear = currentBudgetYear(CLOCK_NOW);

describe("budget years on the realm calendar", () => {
  it("reads the current budget year as today's calendar year, with the era", () => {
    expect(realmYearOfGameYear(thisGameYear, frost)).toBe(812);
    expect(formatBudgetYear(thisGameYear, frost)).toBe("812 AE");
  });

  it("counts other budget years from it, one calendar year per budget year (no skips on a short year)", () => {
    expect(realmYearOfGameYear(thisGameYear - 1, frost)).toBe(811);
    expect(realmYearOfGameYear(thisGameYear + 1, frost)).toBe(813);
    expect(realmYearOfGameYear(thisGameYear + 5, frost)).toBe(817);
  });

  it("leaves Ixnay's years as they are", () => {
    expect(realmYearOfGameYear(thisGameYear, ixnay)).toBe(thisGameYear);
    expect(formatBudgetYear(2039, ixnay)).toBe("2039");
  });

  it("writes a year with its era, or bare without one", () => {
    expect(formatRealmYear(812, frost.calendar)).toBe("812 AE");
    expect(formatRealmYear(2041, ixnay.calendar)).toBe("2041");
  });
});

describe("election names on the realm calendar", () => {
  it("swap the stored game year for the year the election's date falls in", () => {
    expect(electionDisplayName("General Election (Year 2041)", CLOCK_NOW, frost.calendar)).toBe(
      "General Election (812 AE)"
    );
    expect(electionDisplayName("Snap Election (Year 2041)", CLOCK_NOW, ixnay.calendar)).toBe(
      "Snap Election (2041)"
    );
  });

  it("stay as stored without a calendar, a date or a stored year", () => {
    expect(electionDisplayName("General Election (Year 2041)", CLOCK_NOW, null)).toBe(
      "General Election (Year 2041)"
    );
    expect(electionDisplayName("General Election (Year 2041)", null, frost.calendar)).toBe(
      "General Election (Year 2041)"
    );
    expect(electionDisplayName("Founding vote", CLOCK_NOW, frost.calendar)).toBe("Founding vote");
  });
});
