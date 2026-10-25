/** P1-21 (decision 4): threats, border security and military strength are derived on read. */
import { deriveThreatPicture, type ThreatPictureInput } from "~/lib/military/threat-picture";

const at = new Date("2026-10-01T00:00:00Z");
const base: ThreatPictureInput = {
  ownStrength: 10_000,
  neighbors: [],
  conflicts: [],
  hostileActions: [],
  crises: [],
  rivalStrengths: {},
};

describe("deriveThreatPicture", () => {
  it("gives a nation with no neighbours, threats or rivals full border security and strength", () => {
    const p = deriveThreatPicture(base);
    expect(p).toMatchObject({
      landBorders: 0,
      borderSecurity: 100,
      borderStatus: "secure",
      militaryStrength: 100,
      activeThreatCount: 0,
      securityLevel: "secure",
    });
  });

  it("scores military strength 0 with no forces", () => {
    expect(deriveThreatPicture({ ...base, ownStrength: 0 }).militaryStrength).toBe(0);
  });

  it("lists conflicts, hostile actions and crises as threats, worst first", () => {
    const p = deriveThreatPicture({
      ...base,
      conflicts: [
        {
          id: "c1",
          type: "pvp",
          status: "active",
          opponentId: "x",
          opponentName: "Xland",
          detectedAt: at,
        },
      ],
      hostileActions: [
        {
          id: "f1",
          actionType: "embargo",
          severity: "light",
          initiatorId: "y",
          initiatorName: "Yland",
          detectedAt: at,
        },
        {
          id: "f2",
          actionType: "blockade",
          severity: "moderate",
          initiatorId: "y",
          initiatorName: "Yland",
          detectedAt: at,
        },
      ],
      crises: [{ id: "k1", title: "Floods", severity: "MEDIUM", detectedAt: at }],
      rivalStrengths: { x: 0, y: 0 },
    });
    expect(p.threats.map((t) => [t.threatName, t.severity])).toEqual([
      ["Armed conflict with Xland", "critical"],
      ["Naval blockade by Yland", "high"],
      ["Floods", "moderate"],
      ["Trade embargo by Yland", "low"],
    ]);
    expect(p.activeThreatCount).toBe(4);
    expect(p.highSeverityThreats).toBe(2);
    expect(p.overallSecurityScore).toBeLessThan(100);
  });

  it("rates a stronger, hostile neighbour in conflict as a high threat and lowers border security", () => {
    const p = deriveThreatPicture({
      ...base,
      neighbors: [
        { countryId: "n1", name: "Bigland", strength: 30_000, relationStrength: 10 },
        { countryId: "n2", name: "Smallland", strength: 0, relationStrength: 90 },
      ],
      conflicts: [
        {
          id: "c1",
          type: "pvp",
          status: "proposed",
          opponentId: "n1",
          opponentName: "Bigland",
          detectedAt: at,
        },
      ],
    });
    const [big, small] = p.neighborThreats;
    expect(big).toMatchObject({
      neighborName: "Bigland",
      militaryThreat: 75,
      diplomaticRelations: "hostile",
      threatLevel: "critical",
      notes: "Conflict pending or under way",
    });
    expect(small).toMatchObject({ threatLevel: "minimal", diplomaticRelations: "allied" });
    expect(p.landBorders).toBe(2);
    expect(p.borderSecurity).toBeLessThan(40);
    // Own 10k against the strongest rival's 30k.
    expect(p.militaryStrength).toBe(25);
  });
});
