/** @jest-environment node */
// `jest` is the ambient global on purpose: the hoisted jest.mock() factories rely on it.
//
// Stability deltas from national issues survive the Defense panel's recalculation
// (security.getInternalStability used to upsert the raw formula over them), and an issue that
// targets stability on a country with no InternalStabilityMetrics row creates the row from the
// same formula first instead of being dropped. Viewing never writes (MC-13): the panel computes
// on the fly and the stat-progression job re-persists stored rows.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/statecraft/stability-formulas", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/statecraft/stability-formulas"),
  calculateStabilityMetrics: jest.fn(),
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/activity/hooks", () => ({ ActivityHooks: {} }));
jest.mock("~/lib/activity", () => ({
  CountryEventSpine: jest.requireActual("~/lib/activity/event-spine").CountryEventSpine,
}));
jest.mock("~/lib/national-issues/engine", () => ({
  NationalIssuesEngine: { forceGenerate: jest.fn() },
}));
jest.mock("~/lib/gameplay-flags", () => ({ GAMEPLAY_FLAGS: {} }));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { securityStabilityRouter } from "~/server/api/routers/security/stability";
import { NationalIssuesConsequences } from "~/lib/national-issues/consequences";
import { CountryEventSpine } from "~/lib/activity/event-spine";
import { calculateStabilityMetrics } from "~/lib/statecraft/stability-formulas";
import {
  refreshStoredInternalStability,
  STABILITY_NUMERIC_FIELDS,
} from "~/lib/statecraft/stability-store";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const formulaMock = calculateStabilityMetrics as unknown as jest.Mock;
const COUNTRY = "c1";

function formula(stabilityScore: number, extra: Record<string, number> = {}) {
  const values: Record<string, number | string> = { stabilityTrend: "stable" };
  for (const f of STABILITY_NUMERIC_FIELDS) values[f] = 40;
  return { ...values, stabilityScore, ...extra };
}

/** A db whose InternalStabilityMetrics row is real state across calls. */
function makeDb(
  initialRow: Record<string, unknown> | null = null,
  policies: Record<string, unknown>[] = []
) {
  const state = {
    row: initialRow ? { id: "ism1", countryId: COUNTRY, ...initialRow } : null,
    owned: false,
  } as {
    row: Record<string, unknown> | null;
    owned: boolean;
  };
  const db = {
    state,
    country: {
      findUnique: jest.fn(async () => ({
        name: "Testland",
        publicApproval: 50,
        currentPopulation: 10_000_000,
        currentGdpPerCapita: 30_000,
      })),
      update: jest.fn(async () => ({})),
      // The refresh job's list: countries with a row, plus owned ones (`owned`).
      findMany: jest.fn(async () => (state.row || state.owned ? [{ id: COUNTRY }] : [])),
    },
    economicProfile: { findUnique: jest.fn(async () => null) },
    demographics: { findUnique: jest.fn(async () => null) },
    governmentStructure: { findUnique: jest.fn(async () => null) },
    policy: { findMany: jest.fn(async () => policies) },
    internalStabilityMetrics: {
      findUnique: jest.fn(async () => (state.row ? { ...state.row } : null)),
      upsert: jest.fn(
        async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          state.row = state.row ? { ...state.row, ...args.update } : { id: "ism1", ...args.create };
          return { ...state.row };
        }
      ),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => {
        state.row = { ...state.row, ...args.data };
        return { ...state.row };
      }),
    },
    securityEvent: { findMany: jest.fn(async () => []) },
    nationalIssue: {
      findUnique: jest.fn(async () => ({
        id: "issue1",
        countryId: COUNTRY,
        title: "Riots",
        status: "pending",
        intentId: null,
        responseOptions: JSON.stringify([
          {
            id: "o1",
            label: "Crack down",
            consequences: [
              {
                targetModel: "InternalStabilityMetrics",
                targetField: "stabilityScore",
                operation: "subtract",
                value: 3,
              },
            ],
          },
        ]),
      })),
      update: jest.fn(async () => ({})),
    },
    nationalIssueConsequence: { create: jest.fn(async () => ({})) },
    countryChangeLog: { create: jest.fn(async () => ({})) },
    politicalParty: { findFirst: jest.fn() },
  };
  return db;
}

function viewDefensePanel(db: ReturnType<typeof makeDb>) {
  // The owner views the panel (crime and stability metrics are owner-only).
  const caller = createCallerFactory(securityStabilityRouter)(
    createMockRouterContext({
      db,
      user: { id: "user_db_id_1", clerkUserId: "test_user_clerk_id", countryId: COUNTRY },
    }) as never
  );
  return caller.getInternalStability({ countryId: COUNTRY });
}

describe("stability event deltas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the missing row from the formula, then applies the issue delta", async () => {
    formulaMock.mockReturnValue(formula(70));
    const db = makeDb();

    const result = await NationalIssuesConsequences.resolveIssue("issue1", "o1", db as any);

    expect(db.internalStabilityMetrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ countryId: COUNTRY, stabilityScore: 70 }),
      })
    );
    expect(db.state.row?.stabilityScore).toBe(67);
    expect(result.consequences).toEqual([
      expect.objectContaining({ targetField: "stabilityScore", previousValue: 70, newValue: 67 }),
    ]);
  });

  it("keeps an issue delta through later Defense panel recalculations", async () => {
    formulaMock.mockReturnValue(formula(70));
    const db = makeDb();
    await NationalIssuesConsequences.resolveIssue("issue1", "o1", db as any);
    db.internalStabilityMetrics.upsert.mockClear();

    // The formula moves (economy changed) and the panel recalculates: the -3 is carried over.
    formulaMock.mockReturnValue(formula(72, { trustInGovernment: 55 }));
    const first = await viewDefensePanel(db);
    expect(first.metrics.stabilityScore).toBe(69);
    expect(first.metrics.trustInGovernment).toBe(55);

    // Recalculating again with the same inputs does not drift.
    const second = await viewDefensePanel(db);
    expect(second.metrics.stabilityScore).toBe(69);

    // The job persists the same values; the panel then reads them back unchanged.
    await refreshStoredInternalStability(db as any);
    expect(db.state.row?.stabilityScore).toBe(69);
    expect((await viewDefensePanel(db)).metrics.stabilityScore).toBe(69);
  });

  it("never writes when the panel is viewed", async () => {
    formulaMock.mockReturnValue(formula(70));
    const db = makeDb();

    const view = await viewDefensePanel(db);

    expect(view.metrics).toEqual(
      expect.objectContaining({ id: null, countryId: COUNTRY, stabilityScore: 70 })
    );
    expect(db.internalStabilityMetrics.upsert).not.toHaveBeenCalled();
    expect(db.internalStabilityMetrics.update).not.toHaveBeenCalled();
    expect(db.state.row).toBeNull();
  });

  it("creates the row for a directive's stability consequence (no issue path involved)", async () => {
    formulaMock.mockReturnValue(formula(70));
    const db = makeDb();

    const applied = await CountryEventSpine.recordCountryEvent({
      db: db as never,
      countryId: COUNTRY,
      sourceType: "decision",
      sourceId: "intent1",
      description: "Intent (measured): secure the borders",
      consequences: [
        {
          targetModel: "InternalStabilityMetrics",
          targetField: "stabilityScore",
          operation: "add",
          value: 1,
        },
      ],
    });

    expect(db.state.row?.stabilityScore).toBe(71);
    expect(applied).toEqual([expect.objectContaining({ previousValue: 70, newValue: 71 })]);
  });

  it("the refresh job creates the row for an owned country that has none", async () => {
    formulaMock.mockReturnValue(formula(64));
    const db = makeDb();
    db.state.owned = true;

    expect(await refreshStoredInternalStability(db as never)).toEqual({ refreshed: 1, failed: 0 });
    expect(db.state.row?.stabilityScore).toBe(64);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ stabilityMetrics: { isNot: null } }, { ownerUserId: { not: null } }] },
      })
    );
  });

  it("keeps a legacy row's stored values once, then tracks the formula from there", async () => {
    const legacy: Record<string, unknown> = { formulaSnapshot: null };
    for (const f of STABILITY_NUMERIC_FIELDS) legacy[f] = 40;
    legacy.stabilityScore = 55;
    const db = makeDb(legacy);

    formulaMock.mockReturnValue(formula(72));
    expect((await viewDefensePanel(db)).metrics.stabilityScore).toBe(55);
    await refreshStoredInternalStability(db as any);

    formulaMock.mockReturnValue(formula(74));
    expect((await viewDefensePanel(db)).metrics.stabilityScore).toBe(57);
  });
});
