import { revealConsequences, classifyDomain } from "./statecraft-recon";

const democratic = {
  componentTypes: ["ELECTORAL_LEGITIMACY", "DEMOCRATIC_PROCESS", "MIXED_ECONOMY"],
  departmentCategories: ["Finance", "Foreign Affairs"],
  overCapacity: false,
  lowEfficiency: false,
};

const stratocracy = {
  componentTypes: ["MILITARY_ADMINISTRATION", "SURVEILLANCE_SYSTEM", "STATE_CAPITALISM"],
  departmentCategories: ["Defense", "Interior"],
  overCapacity: false,
  lowEfficiency: false,
};

describe("classifyDomain", () => {
  it("buckets fields by name", () => {
    expect(classifyDomain("publicApproval")).toBe("approval");
    expect(classifyDomain("gdpGrowthRate")).toBe("economic");
    expect(classifyDomain("crimeRate")).toBe("stability");
    expect(classifyDomain("diplomaticReputation")).toBe("diplomatic");
    expect(classifyDomain("lifeExpectancy")).toBe("economic"); // no social keyword → default
  });
});

describe("revealConsequences — fog is the build's blind spots", () => {
  const cs = [{ targetField: "publicApproval" }, { targetField: "gdpGrowth" }];

  it("a democratic+electoral build reveals approval", () => {
    const out = revealConsequences(cs, democratic);
    expect(out.find((r) => r.domain === "approval")!.state).toBe("revealed");
  });

  it("a stratocracy greys approval (can't read consent) but sees the economy", () => {
    const out = revealConsequences(cs, stratocracy);
    expect(out.find((r) => r.domain === "approval")!.state).toBe("greyed");
    expect(out.find((r) => r.domain === "economic")!.state).toBe("revealed");
  });

  it("over-capacity questions an otherwise-revealed point (never hides, captions)", () => {
    const out = revealConsequences(cs, { ...democratic, overCapacity: true });
    const approval = out.find((r) => r.domain === "approval")!;
    expect(approval.state).toBe("questioned");
    expect(approval.reason).toMatch(/over capacity/i);
  });
});
