/** @jest-environment node */
/**
 * Stress finding C-11 (template sweep over all 150 Ixnay snapshots): alliances read Country.activeAlliances, which
 * nothing writes, so every nation had 0 and the alliance templates (trade agreement, arms deal, peacekeeping,
 * intelligence sharing, base controversy) never fired; crime_wave read policingEffectiveness, which the snapshot lacked;
 * income_inequality_protests compared the 0-1 coefficient with 45 and printed "{{incomeInequalityGini}}". C-12: the budget
 * balance is stored in currency, and templates read it as % of GDP (-3 / -5).
 */
import { buildCountrySnapshot } from "~/lib/national-issues/country-snapshot";
import { substituteVariables } from "~/lib/national-issues/evaluators/issue-generator";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW - 365 * 86_400_000) });
  await addNation(db as never, { id: "otherland", baselineDate: new Date(NOW - 365 * 86_400_000) });
});
afterEach(() => jest.restoreAllMocks());

it("counts alliances from memberships and military pacts, and reads policing and Gini in points", async () => {
  await db.country.update({
    where: { id: "testland" },
    data: { incomeInequalityGini: 0.42, budgetDeficitSurplus: -12e9 },
  });
  await db.internalStabilityMetrics.update({
    where: { countryId: "testland" },
    data: { policingEffectiveness: 35 },
  });
  await db.alliance.create({ data: { id: "pact", name: "Northern Pact", type: "military" } });
  await db.allianceMember.create({
    data: { allianceId: "pact", countryId: "testland", status: "active" },
  });
  await db.foreignPolicyAction.create({
    data: {
      initiatorId: "otherland",
      targetId: "testland",
      actionType: "military_alliance",
      status: "active",
    },
  });

  const snapshot = (await buildCountrySnapshot("testland", db as never, NOW))!;
  expect(snapshot.activeAllianceCount).toBe(2);
  expect(snapshot.policingEffectiveness).toBe(35);
  expect(snapshot.incomeInequalityGini).toBe(42);
  expect(snapshot.budgetDeficitSurplus).toBe(-4); // -$12B of a $300B economy
  expect(substituteVariables("A Gini coefficient of {{incomeInequalityGini}}", snapshot)).toBe(
    "A Gini coefficient of 42"
  );
});
