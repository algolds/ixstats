/** @jest-environment node */
/** P1-21: the loader feeds map neighbours, live conflicts, hostile actions and this nation's crises. */
jest.mock("~/lib/national-issues/neighbors", () => ({
  resolveNeighbors: jest.fn(async () => [
    { name: "Bigland", countryId: "n1" },
    { name: "Unclaimed coast", countryId: null },
  ]),
}));

import { loadThreatPicture } from "~/lib/military/threat-picture-loader";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const DAY = 24 * 60 * 60 * 1000;
const branch = (countryId: string, personnel: number) => ({
  countryId,
  readinessLevel: 100,
  units: [{ personnel, readiness: 100 }],
  assets: [],
});

it("derives the picture from neighbours, live conflicts, hostile actions and own crises", async () => {
  const db = createMockPrisma();
  db.diplomaticRelation.findMany.mockResolvedValue([
    { country1: "c1", country2: "n1", strength: 20 },
  ]);
  db.militaryConflict.findMany.mockResolvedValue([
    {
      id: "live",
      type: "pvp",
      status: "active",
      winner: null,
      initiatorId: "n1",
      defenderId: "c1",
      startDate: new Date(),
      createdAt: new Date(),
      initiator: { name: "Bigland" },
      defender: { name: "Ownland" },
    },
    {
      id: "stale",
      type: "pvp",
      status: "proposed",
      winner: null,
      initiatorId: "c1",
      defenderId: "far",
      startDate: null,
      createdAt: new Date(Date.now() - 30 * DAY),
      initiator: { name: "Ownland" },
      defender: { name: "Farland" },
    },
  ]);
  db.foreignPolicyAction.findMany.mockResolvedValue([
    {
      id: "fp1",
      actionType: "sanction",
      severity: "moderate",
      initiatorId: "far",
      createdAt: new Date(),
      initiator: { name: "Farland" },
    },
  ]);
  db.crisisEvent.findMany.mockResolvedValue([
    {
      id: "k1",
      title: "Floods",
      severity: "high",
      timestamp: new Date(),
      affectedCountries: '["c1"]',
    },
    {
      id: "k2",
      title: "Elsewhere",
      severity: "critical",
      timestamp: new Date(),
      affectedCountries: '["c10"]',
    },
  ]);
  db.militaryBranch.findMany.mockImplementation(
    async ({ where }: { where: { countryId: unknown } }) =>
      where.countryId === "c1" ? [branch("c1", 1000)] : [branch("n1", 3000), branch("far", 500)]
  );

  const p = await loadThreatPicture(db as never, "c1");

  expect(p.landBorders).toBe(1);
  expect(p.neighborThreats[0]).toMatchObject({ neighborName: "Bigland", militaryThreat: 75 });
  expect(p.threats.map((t) => t.threatName)).toEqual([
    "Armed conflict with Bigland",
    "Floods",
    "Economic sanctions by Farland",
  ]);
  expect(p.combatStrength).toBe(1000);
  expect(p.militaryStrength).toBe(25);
});
