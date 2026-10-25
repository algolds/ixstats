/** @jest-environment node */
/** The election card dates elections in the nation's realm calendar, "–" while its clock loads. */
jest.mock("iconoir-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { describeElection } from "~/components/executive/politics/ElectionStatusCard";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

const status = (scheduledIxTime: number, isFirst = false) =>
  ({
    hasLegislature: true,
    activeParties: 3,
    minParties: 2,
    counting: false,
    upcoming: { name: "General election", scheduledIxTime, isDue: false, isFirst },
  }) as unknown as Parameters<typeof describeElection>[0];

describe("describeElection", () => {
  it("dates the next election in a custom realm calendar", () => {
    expect(describeElection(status(CLOCK_NOW + 20 * DAY), sixTimesReader()).headline).toBe(
      "Next election: 4 Frostfall 812 AE"
    );
  });

  it("keeps Ixnay's Gregorian date", () => {
    expect(describeElection(status(CLOCK_NOW, true), ixnayReader()).headline).toBe(
      "First election scheduled for 2 June 2041"
    );
  });

  it("names a due election by its year in the realm calendar, not the stored game year", () => {
    const due = {
      ...status(CLOCK_NOW),
      upcoming: {
        name: "General Election (Year 2041)",
        scheduledIxTime: CLOCK_NOW,
        isDue: true,
        isFirst: false,
      },
    } as unknown as Parameters<typeof describeElection>[0];
    expect(describeElection(due, sixTimesReader()).headline).toBe(
      "General Election (812 AE): polls have closed"
    );
  });

  it("shows a placeholder while the clock loads", () => {
    expect(describeElection(status(CLOCK_NOW), null).headline).toBe("Next election: –");
  });
});
