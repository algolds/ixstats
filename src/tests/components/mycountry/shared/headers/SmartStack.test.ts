import { buildAgendaItems } from "~/components/mycountry/shared/headers/SmartStack";

const zero = {
  urgentIssueCount: 0,
  issueCount: 0,
  policiesTotal: 0,
  activePolicies: 0,
  pendingActions: 0,
  messageUnreadCount: 0,
  threats: 0,
  securityScore: 100,
  critAlerts: 0,
  pendingElections: 0,
  noEmbassies: false,
};

describe("buildAgendaItems", () => {
  it("returns nothing when all sectors are clear", () => {
    expect(buildAgendaItems(zero)).toEqual([]);
  });

  it("prefers urgent over pending cabinet issues", () => {
    const items = buildAgendaItems({ ...zero, urgentIssueCount: 2, issueCount: 5 });
    expect(items.map((i) => i.id)).toEqual(["exec-urgent"]);
  });

  it("flags low defense readiness only when no active threats", () => {
    expect(buildAgendaItems({ ...zero, securityScore: 40 })[0]?.id).toBe("def-low-score");
    expect(buildAgendaItems({ ...zero, threats: 1, securityScore: 40 })[0]?.id).toBe("def-threats");
  });

  it("counts inactive policies", () => {
    const item = buildAgendaItems({ ...zero, policiesTotal: 4, activePolicies: 1 }).find(
      (i) => i.id === "exec-policies"
    );
    expect(item?.text).toContain("3 draft/inactive");
  });
});
