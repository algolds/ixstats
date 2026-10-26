/** @jest-environment node */
/**
 * Politics writes keep their history and their invariants (WP-DE: P1-06, P2-04, P2-03). A party edit cannot set its
 * support (drift and elections own it); a party that stood in an election is deactivated instead of deleted (its
 * candidates and results cascade from it); a bill is voted once even when two votes race; the whip count and a
 * meeting's notes and decisions are the owning government's alone; reconfiguring the legislature writes the chamber
 * and its seats in one transaction.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/government/election-lifecycle", () => ({
  ensureUpcomingElection: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { Government: { onLawPassed: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/policies", () => ({ applyPolicyEffect: jest.fn().mockResolvedValue(undefined) }));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { electionsRouter } from "~/server/api/routers/elections";
import { legislationRouter } from "~/server/api/routers/legislation";
import { meetingsRouter } from "~/server/api/routers/meetings";
import { applyPolicyEffect } from "~/lib/policies";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const elections = createCallerFactory(electionsRouter);
const legislation = createCallerFactory(legislationRouter);
const meetings = createCallerFactory(meetingsRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parties", () => {
  const party = { id: "p1", countryId: CALLER_COUNTRY, name: "Greens", currentSupport: 31 };

  it("an edit never writes currentSupport, even when the client sends it", async () => {
    const update = jest.fn(async ({ data }: { data: object }) => ({ ...party, ...data }));
    const ctx = createIdorContext({
      politicalParty: { findUnique: jest.fn().mockResolvedValue(party), update },
    });
    await elections(ctx as never).updateParty({
      id: "p1",
      name: "New Greens",
      currentSupport: 90,
    } as never);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].data).toEqual({ name: "New Greens" });
  });

  it("a party with candidates is deactivated, not deleted; one without is deleted", async () => {
    const update = jest.fn().mockResolvedValue({});
    const remove = jest.fn().mockResolvedValue({});
    const count = jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const ctx = createIdorContext({
      politicalParty: { findUnique: jest.fn().mockResolvedValue(party), update, delete: remove },
      electionCandidate: { count },
    });
    const caller = elections(ctx as never);

    await expect(caller.deleteParty({ id: "p1" })).resolves.toEqual({
      id: "p1",
      deactivated: true,
    });
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { isActive: false } });
    expect(remove).not.toHaveBeenCalled();

    await expect(caller.deleteParty({ id: "p1" })).resolves.toEqual({
      id: "p1",
      deactivated: false,
    });
    expect(remove).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});

describe("legislature", () => {
  it("reconfiguring writes the chamber and its seats inside one transaction", async () => {
    const tx = {
      legislature: { upsert: jest.fn().mockResolvedValue({ id: "leg1", name: "Diet" }) },
      legislativeSeat: {
        deleteMany: jest.fn().mockResolvedValue({ count: 100 }),
        createMany: jest.fn().mockResolvedValue({ count: 50 }),
      },
    };
    const $transaction = jest.fn(async (work: (t: typeof tx) => Promise<unknown>) => work(tx));
    const ctx = createIdorContext({ $transaction } as never);
    await elections(ctx as never).configureLegislature({
      countryId: CALLER_COUNTRY,
      name: "Diet",
      chamberType: "unicameral",
      totalSeats: 50,
      electoralSystem: "proportional",
      termLength: 4,
    });
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.legislativeSeat.deleteMany).toHaveBeenCalledWith({
      where: { legislatureId: "leg1" },
    });
    const seats = tx.legislativeSeat.createMany.mock.calls[0]![0].data as Array<{
      seatNumber: number;
    }>;
    expect(seats).toHaveLength(50);
    expect(seats.map((s) => s.seatNumber)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });
});

describe("bills", () => {
  const bill = {
    id: "b1",
    countryId: CALLER_COUNTRY,
    name: "Rail Act",
    policyType: "legislative_bill",
    status: "in_committee",
    gdpEffect: 1,
    reviewNotes: JSON.stringify({ ideologyTarget: 0 }),
  };
  const seatedLegislature = {
    id: "leg1",
    seats: Array.from({ length: 10 }, (_, i) => ({
      seatNumber: i + 1,
      party: { id: "p1", name: "Centrists", ideology: "center" },
    })),
  };
  const billDb = (claimCount: number) => ({
    policy: {
      findUnique: jest.fn().mockResolvedValue(bill),
      updateMany: jest.fn().mockResolvedValue({ count: claimCount }),
      update: jest.fn().mockResolvedValue(bill),
    },
    legislature: { findUnique: jest.fn().mockResolvedValue(seatedLegislature) },
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        publicApproval: 70,
      })),
    },
  });

  it("a vote claims the bill conditionally; the loser of a race applies nothing", async () => {
    const db = billDb(0);
    await expect(
      legislation(createIdorContext(db) as never).holdVote({ billId: "b1" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.policy.updateMany.mock.calls[0]![0].where).toEqual({
      id: "b1",
      status: "in_committee",
    });
    expect(db.policy.update).not.toHaveBeenCalled();
    expect(applyPolicyEffect).not.toHaveBeenCalled();
  });

  it("the whip count is refused to another nation's player", async () => {
    const db = billDb(1);
    db.policy.findUnique.mockResolvedValue({ ...bill, countryId: FOREIGN_COUNTRY });
    await expect(
      legislation(createIdorContext(db) as never).previewBillVote({ billId: "b1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("the owner's whip count reads standing from public approval", async () => {
    const result = await legislation(createIdorContext(billDb(1)) as never).previewBillVote({
      billId: "b1",
    });
    expect(result).toMatchObject({ available: true, standing: 70 });
  });
});

describe("cabinet meetings", () => {
  const meeting = (countryId: string) => ({
    id: `m-${countryId}`,
    countryId,
    targetCountryId: null,
    title: "Spring cabinet",
    notes: "Agreed to cut the port budget",
    attendances: [],
    agendaItems: [{ id: "a1", title: "Port", outcome: "Approved" }],
    decisions: [{ id: "d1", title: "Port cut" }],
    actionItems: [],
  });

  it("notes, decisions and agenda outcomes are the host's alone", async () => {
    const ctx = createIdorContext({
      cabinetMeeting: {
        findMany: jest.fn().mockResolvedValue([meeting(CALLER_COUNTRY), meeting(FOREIGN_COUNTRY)]),
      },
    });
    (ctx.db as { country: Record<string, jest.Mock> }).country.findMany = jest
      .fn()
      .mockResolvedValue([]);
    const [own, foreign] = await meetings(ctx as never).getMeetings({ countryId: FOREIGN_COUNTRY });
    expect(own).toMatchObject({
      notes: "Agreed to cut the port budget",
      decisions: [{ id: "d1" }],
    });
    expect(foreign).toMatchObject({
      notes: null,
      decisions: [],
      agendaItems: [{ id: "a1", outcome: null }],
      title: "Spring cabinet",
    });
  });
});
