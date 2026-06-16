import { groupIncidentsByCountry, type DiplomaticEventLite } from "./diplomatic-incidents";

const ev = (over: Partial<DiplomaticEventLite>): DiplomaticEventLite => ({
  country1Id: "A",
  country2Id: "B",
  eventType: "embargo",
  title: "Embargo imposed",
  severity: "info",
  ...over,
});

describe("groupIncidentsByCountry", () => {
  it("buckets by the counterparty (handles either side)", () => {
    const m = groupIncidentsByCountry(
      [ev({}), ev({ country1Id: "C", country2Id: "A", title: "Treaty" })],
      "A"
    );
    expect(m.get("B")).toEqual(["Embargo imposed"]);
    expect(m.get("C")).toEqual(["Treaty"]);
  });
  it("prefixes non-info severity and caps per counterparty", () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      ev({ title: `E${i}`, severity: "critical" })
    );
    const m = groupIncidentsByCountry(events, "A", 5);
    expect(m.get("B")).toHaveLength(5);
    expect(m.get("B")![0]).toBe("[critical] E0");
  });
  it("skips events with no counterparty", () => {
    const m = groupIncidentsByCountry([ev({ country2Id: null })], "A");
    expect(m.size).toBe(0);
  });
});
