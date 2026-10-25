/** @jest-environment node */
/** An issue card's deadline: real time left on the nation's realm clock at its speed; "Paused" when stopped. */
jest.mock("iconoir-react", () => new Proxy({}, { get: () => () => null }));

import { issueDeadlineOf } from "~/components/executive/issues/IssueCard";
import {
  CLOCK_NOW,
  DAY,
  ixnayReader,
  pausedReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

describe("issueDeadlineOf", () => {
  it("halves in-world days into real ones on Ixnay's ×2 clock", () => {
    expect(issueDeadlineOf(CLOCK_NOW + 10 * DAY, ixnayReader())).toEqual({
      text: "5d left",
      urgent: false,
    });
  });

  it("reads a 6× realm's clock: twelve in-world days are two real days, urgent", () => {
    expect(issueDeadlineOf(CLOCK_NOW + 12 * DAY, sixTimesReader())).toEqual({
      text: "2d left",
      urgent: true,
    });
  });

  it("shows Paused in a paused realm, and Expired once the deadline has passed", () => {
    expect(issueDeadlineOf(CLOCK_NOW + DAY, pausedReader())).toEqual({
      text: "Paused",
      urgent: false,
    });
    expect(issueDeadlineOf(CLOCK_NOW - DAY, pausedReader()).text).toBe("Expired");
  });

  it("shows a placeholder while the clock loads", () => {
    expect(issueDeadlineOf(CLOCK_NOW + DAY, null).text).toBe("–");
  });
});
