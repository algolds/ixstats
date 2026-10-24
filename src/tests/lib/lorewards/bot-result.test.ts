/** @jest-environment node */
/**
 * Reading one result the Discord bot pushes: a weekly is keyed by its ISO week and keeps its real first and last day;
 * anything else keeps its date and no range.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/lorewards/sync", () => ({ recomputeUserStats: jest.fn() }));
jest.mock("~/lib/lorewards/settle", () => ({ settleLorewardPlaces: jest.fn() }));
jest.mock("~/lib/cache", () => ({ invalidateCache: jest.fn() }));

import { describe, expect, it } from "@jest/globals";
import { parseBotResult } from "~/lib/lorewards/bot-result";
import { contestIdentity } from "~/lib/lorewards/contest-identity";

const WEEKLY_ERROR =
  "A weekly date is an ISO week (2026-W34) or the week's first day (2026-08-17).";

describe("parseBotResult", () => {
  it("keys a weekly given as an ISO week, with its Monday to Sunday range", () => {
    const parsed = parseBotResult({ date: "2026-W34", type: "weekly", winnerUser: "Urcea" });
    expect(parsed).toMatchObject({
      ok: true,
      result: {
        date: "2026-W34",
        type: "weekly",
        dateStart: "2026-08-17",
        dateEnd: "2026-08-23",
        places: { winnerUser: "Urcea", runnerUpUser: null },
        status: "approved",
        metadata: null,
      },
    });
  });

  it("keys a weekly given as its first day the same way", () => {
    expect(parseBotResult({ date: "2026-08-17", type: "weekly" })).toMatchObject({
      ok: true,
      result: { date: "2026-W34", dateStart: "2026-08-17", dateEnd: "2026-08-23" },
    });
  });

  it("refuses a weekly date it cannot read", () => {
    expect(parseBotResult({ date: "34", type: "weekly" })).toEqual({
      ok: false,
      error: WEEKLY_ERROR,
    });
  });

  it("refuses a result without a date or a type", () => {
    expect(parseBotResult({ type: "daily" })).toEqual({
      ok: false,
      error: "Missing required fields: date, type",
    });
    expect(parseBotResult({ date: "2026-10-16" })).toEqual({
      ok: false,
      error: "Missing required fields: date, type",
    });
  });

  it("keeps a daily's date, a null range, its counts as numbers and its status", () => {
    const parsed = parseBotResult({
      date: "2026-10-16",
      type: "daily",
      winnerScore: "90",
      winnerBytes: 1200,
      status: "pending",
      metadata: "[]",
    });
    expect(parsed).toEqual({
      ok: true,
      result: {
        date: "2026-10-16",
        type: "daily",
        dateStart: null,
        dateEnd: null,
        places: {
          winnerUser: null,
          winnerPage: null,
          winnerScore: 90,
          winnerBytes: 1200,
          runnerUpUser: null,
          runnerUpPage: null,
          runnerUpScore: null,
          runnerUpBytes: null,
        },
        status: "pending",
        metadata: "[]",
      },
    });
  });

  it("gives a YYYY-MM monthly its UTC range, so it is the same contest as the OOL page's first-day row", () => {
    const parsed = parseBotResult({ date: "2028-02", type: "monthly" });
    expect(parsed).toMatchObject({
      ok: true,
      result: { date: "2028-02", dateStart: "2028-02-01", dateEnd: "2028-02-29" },
    });
    const result = parsed.ok ? parsed.result : null;
    expect(result && contestIdentity({ ...result })).toBe(
      contestIdentity({ type: "monthly", date: "2028-02-01", dateStart: null })
    );
  });

  it("leaves a monthly it cannot read as a month without a range", () => {
    expect(parseBotResult({ date: "2026-13", type: "monthly" })).toMatchObject({
      ok: true,
      result: { date: "2026-13", dateStart: null, dateEnd: null },
    });
  });
});
