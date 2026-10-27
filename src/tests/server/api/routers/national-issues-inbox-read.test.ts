/** @jest-environment node */
/**
 * P2-11 (F-P2-16): opening the issue inbox never generates issues, even with auto-generation on and the country due.
 * Generation belongs to the `national-issues` cron job (and the admin `triggerEvaluation` mutation).
 */
jest.mock("~/lib/national-issues", () => ({
  __esModule: true,
  NationalIssuesEngine: {
    shouldEvaluate: jest.fn(async () => true),
    evaluateCountry: jest.fn(async () => ({ issuesGenerated: 1 })),
  },
  NationalIssuesConsequences: {},
}));
jest.mock("~/lib/gameplay-flags", () => {
  const actual = jest.requireActual("~/lib/gameplay-flags");
  return {
    __esModule: true,
    ...actual,
    GAMEPLAY_FLAGS: { ...actual.GAMEPLAY_FLAGS, issuesAutoGenerate: true },
  };
});

import { createTRPCRouter } from "~/server/api/trpc";
import { nationalIssuesPlayerRouter } from "~/server/api/routers/national-issues/player";
import { NationalIssuesEngine } from "~/lib/national-issues";
import { CALLER_COUNTRY, createIdorContext } from "~/tests/helpers/country-idor-context";

it("getMyIssues reads the inbox without evaluating the country", async () => {
  const findMany = jest.fn(async () => [
    { id: "i1", countryId: CALLER_COUNTRY, status: "pending", deadlineIxTime: null },
  ]);
  const ctx = createIdorContext({ nationalIssue: { findMany } });
  const caller = createTRPCRouter({ issues: nationalIssuesPlayerRouter }).createCaller(
    ctx as never
  );

  const result = await caller.issues.getMyIssues({ countryId: CALLER_COUNTRY });

  expect(result.issues).toHaveLength(1);
  expect(NationalIssuesEngine.evaluateCountry).not.toHaveBeenCalled();
  expect(NationalIssuesEngine.shouldEvaluate).not.toHaveBeenCalled();
});
