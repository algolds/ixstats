import { DAY_MS } from "~/lib/realms/realm-calendar";
import { summitDate, summitPartners, summitPhase } from "./summits";

describe("summits", () => {
  it("sets the date a month, a quarter or half a year ahead on the realm clock", () => {
    expect(summitDate(1_000, "month")).toBe(1_000 + 30 * DAY_MS);
    expect(summitDate(1_000, "half")).toBe(1_000 + 182 * DAY_MS);
  });

  it("is upcoming until its date, then held", () => {
    expect(summitPhase(2_000, 1_000)).toBe("upcoming");
    expect(summitPhase(1_000, 1_000)).toBe("held");
    expect(summitPhase(null, 1_000)).toBe("held");
  });

  it("counts each partner once, whichever side proposed", () => {
    const held = [
      { initiatorId: "me", targetId: "a" },
      { initiatorId: "a", targetId: "me" },
      { initiatorId: "b", targetId: "me" },
    ];
    expect(summitPartners("me", held)).toBe(2);
  });
});
