/** @jest-environment node */
/**
 * Issue content tuning T: the generation cron ranks a nation against its realm (a `rank` trigger fires for the realm's
 * worst inflation, not for its best) with one rank table per realm per run, and paces each nation to one issue per
 * gap instead of a burst of the session cap.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/national-issues/country-snapshot", () => {
  const actual = jest.requireActual("~/lib/national-issues/country-snapshot");
  return { ...actual, buildCountrySnapshot: jest.fn(actual.buildCountrySnapshot) };
});

import { IxTime } from "~/lib/ixtime";
import { NationalIssuesEngine } from "~/lib/national-issues";
import { buildCountrySnapshot } from "~/lib/national-issues/country-snapshot";
import { generateNationalIssues } from "~/lib/national-issues/generation-cron";
import { issueGapMs } from "~/lib/national-issues/evaluators/pacing";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIssueTemplate, addIxnay, addNation, addOwner } from "~/tests/helpers/nation-world";

const DAY = 86_400_000;
const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

async function addTemplate(id: string, trigger: object) {
  await addIssueTemplate(db as never, {
    id,
    title: `Issue ${id}`,
    domain: "economic",
    options: [{ id: "accept", label: "Accept", consequences: [] }],
  });
  await db.nationalIssueTemplate.update({
    where: { id },
    data: { triggerConditions: JSON.stringify(trigger), baseSeverity: "medium", cooldownDays: 1 },
  });
}

const issuesOf = async (countryId: string) => db.nationalIssue.findMany({ where: { countryId } });

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  // A running clock (a paused realm gets no issues); the override pins it near NOW.
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  // Twelve nations, inflation 1% .. 12%: the realm's worst quarter is n10, n11 and n12
  for (let i = 1; i <= 12; i++) {
    await addNation(db as never, { id: `n${i}`, baselineDate: new Date(NOW - 365 * DAY) });
    await db.country.update({ where: { id: `n${i}` }, data: { inflationRate: i } });
  }
  await addOwner(db as never, "u-worst", "n12");
  await addOwner(db as never, "u-best", "n1");
  await addTemplate("price_protests", { rank: { field: "inflationRate" } });
  await addTemplate("rate_debate", { rank: { field: "inflationRate", share: 0.5 } });
});
afterEach(() => {
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("gives the realm's worst inflation one paced issue and its best none, ranking the realm once per run", async () => {
  jest.mocked(buildCountrySnapshot).mockClear();
  await generateNationalIssues();

  expect(await issuesOf("n12")).toHaveLength(1); // paced: one, though two templates triggered
  expect(await issuesOf("n1")).toHaveLength(0);
  // the realm's 12 nations once for the rank table, plus each owned nation's own snapshot
  expect(buildCountrySnapshot).toHaveBeenCalledTimes(12 + 2);
});

it("hands the next issue only once the nation's gap since its last one is up", async () => {
  await generateNationalIssues();
  const [first] = await issuesOf("n12");
  const gap = issueGapMs("n12", first!.createdIxTime);

  IxTime.setTimeOverride(first!.createdIxTime + gap - 60_000);
  await generateNationalIssues();
  expect(await issuesOf("n12")).toHaveLength(1);

  IxTime.setTimeOverride(first!.createdIxTime + gap + 60_000);
  await generateNationalIssues();
  expect(await issuesOf("n12")).toHaveLength(2);
});

it("keeps an admin evaluation unpaced: every triggered template up to the session cap", async () => {
  const result = await NationalIssuesEngine.evaluateCountry("n12", db as never, { now: NOW });
  expect(result.issuesGenerated).toBe(2);
});
