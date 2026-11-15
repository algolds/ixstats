/**
 * The priority card reads executive bandwidth from the same sum the Standing band shows (so the two
 * never disagree) and features the newest active directive, not the oldest.
 */
jest.mock("iconoir-react", () => new Proxy({}, { get: () => () => null }));

import {
  deriveOpportunity,
  type OpportunityContext,
} from "~/components/mycountry/shell/opportunityRules";

const base: OpportunityContext = {
  country: null,
  issues: [],
  intents: [],
  execBandwidth: undefined,
  isDismissed: () => false,
};

describe("deriveOpportunity", () => {
  it("raises the bottleneck from executive bandwidth", () => {
    const opportunity = deriveOpportunity({
      ...base,
      execBandwidth: { capacity: 100, used: 130, overCapacity: true },
    });
    expect(opportunity?.id).toBe("civil-service-overcap");
    expect(opportunity?.metricValue).toBe("130 of 100 used");
  });

  it("stays quiet about bandwidth when the band has room", () => {
    const opportunity = deriveOpportunity({
      ...base,
      execBandwidth: { capacity: 100, used: 40, overCapacity: false },
    });
    expect(opportunity?.id).toBe("economy-growth");
  });

  it("features the newest active directive (getTree lists oldest first)", () => {
    const opportunity = deriveOpportunity({
      ...base,
      intents: [
        { id: "old", goal: "Old goal", status: "active" },
        { id: "done", goal: "Done", status: "completed" },
        { id: "new", goal: "New goal", status: "active", category: "diplomatic" },
      ],
    });
    expect(opportunity?.intentId).toBe("new");
    expect(opportunity?.category).toBe("diplomatic");
  });

  it("tags national issues with their resolved category and human label", () => {
    const opportunity = deriveOpportunity({
      ...base,
      issues: [
        {
          id: "iss-1",
          title: "Port congestion along the strait",
          description: "Freight queues are backing up.",
          severity: "critical",
          urgency: 85,
          domain: "infrastructure",
          category: "infrastructure",
        },
      ],
    });
    expect(opportunity?.subtitle).toBe("Priority national issue");
    expect(opportunity?.category).toBe("infrastructure");
    expect(opportunity?.categoryLabel).toBe("Infrastructure");
  });
});
