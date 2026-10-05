/** @jest-environment node */
// Cabinet meetings conclude: meetings.concludeMeeting records the outcome and one
// MeetingDecision per decided agenda item, and marks the meeting completed.
import { describe, it, expect } from "@jest/globals";
import { meetingsRouter } from "~/server/api/routers/meetings";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

function meetingsDb(countryId: string, status = "scheduled") {
  const state = {
    meeting: {
      id: "m1",
      countryId,
      status,
      notes: null as string | null,
      completedAt: null as Date | null,
    },
    agendaItems: [
      { id: "a1", title: "Budget review", status: "pending", outcome: null as string | null },
      { id: "a2", title: "Port expansion", status: "pending", outcome: null as string | null },
    ],
    decisions: [] as Record<string, unknown>[],
  };
  const db: Record<string, any> = {
    state,
    cabinetMeeting: {
      findUnique: jest.fn(async () => ({
        ...state.meeting,
        agendaItems: state.agendaItems.map((a) => ({ ...a })),
        decisions: [...state.decisions],
      })),
      updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
        if (where.status.notIn.includes(state.meeting.status)) return { count: 0 };
        Object.assign(state.meeting, data);
        return { count: 1 };
      }),
    },
    meetingDecision: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.decisions.push(data);
        return data;
      }),
    },
    meetingAgendaItem: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
        const item = state.agendaItems.find((a) => a.id === where.id)!;
        Object.assign(item, data);
        return item;
      }),
    },
  };
  db.$transaction = jest.fn(async (cb: (tx: unknown) => unknown) => cb(db));
  return db;
}

describe("meetings.concludeMeeting", () => {
  it("records decisions on agenda items and completes the meeting", async () => {
    const db = meetingsDb(CALLER_COUNTRY);
    const caller = meetingsRouter.createCaller(createIdorContext(db));

    const result = await caller.concludeMeeting({
      meetingId: "m1",
      outcome: "Budget passed; port plan sent back for costing.",
      decisions: [
        { agendaItemId: "a1", decision: "approved" },
        { agendaItemId: "a2", decision: "deferred", notes: "Needs costing" },
      ],
    });

    expect(db.state.meeting).toEqual(
      expect.objectContaining({
        status: "completed",
        notes: "Budget passed; port plan sent back for costing.",
        completedAt: expect.any(Date),
      })
    );
    expect(db.state.decisions).toEqual([
      expect.objectContaining({
        meetingId: "m1",
        agendaItemId: "a1",
        title: "Budget review",
        description: "Approved",
        decisionType: "approved",
      }),
      expect.objectContaining({
        agendaItemId: "a2",
        description: "Needs costing",
        decisionType: "deferred",
      }),
    ]);
    expect(db.state.agendaItems.map((a: { status: string }) => a.status)).toEqual([
      "decided",
      "deferred",
    ]);
    expect(result?.decisions).toHaveLength(2);
  });

  it("rejects concluding another country's meeting", async () => {
    const db = meetingsDb(FOREIGN_COUNTRY);
    const caller = meetingsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.concludeMeeting({ meetingId: "m1", outcome: "Done" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.cabinetMeeting.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a meeting that is already over", async () => {
    const db = meetingsDb(CALLER_COUNTRY, "completed");
    const caller = meetingsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.concludeMeeting({ meetingId: "m1", outcome: "Again" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.meetingDecision.create).not.toHaveBeenCalled();
  });

  it("rejects a decision on an agenda item of another meeting, or a duplicate", async () => {
    const db = meetingsDb(CALLER_COUNTRY);
    const caller = meetingsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.concludeMeeting({
        meetingId: "m1",
        outcome: "Done",
        decisions: [{ agendaItemId: "elsewhere", decision: "approved" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.concludeMeeting({
        meetingId: "m1",
        outcome: "Done",
        decisions: [
          { agendaItemId: "a1", decision: "approved" },
          { agendaItemId: "a1", decision: "rejected" },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.state.meeting.status).toBe("scheduled");
  });
});
