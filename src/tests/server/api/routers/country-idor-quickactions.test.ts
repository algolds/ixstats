import { quickActionsRouter } from "~/server/api/routers/quickactions";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

function quickActionsDb() {
  return {
    cabinetMeeting: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "meeting_new", ...data })),
    },
    meetingAttendance: { createMany: jest.fn() },
    meetingAgendaItem: { createMany: jest.fn() },
    activitySchedule: { create: jest.fn() },
  };
}

const meeting = { title: "Budget review", scheduledDate: new Date("2026-10-01T00:00:00Z") };

describe("Plan 332: quickActions.createMeeting requires country ownership", () => {
  it("rejects a member scheduling a meeting for another country", async () => {
    const db = quickActionsDb();
    const caller = quickActionsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.createMeeting({ countryId: FOREIGN_COUNTRY, userId: "someone_else", meeting })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.cabinetMeeting.create).not.toHaveBeenCalled();
    expect(db.activitySchedule.create).not.toHaveBeenCalled();
  });

  it("records the caller as organiser, ignoring the client-sent userId", async () => {
    const db = quickActionsDb();
    const caller = quickActionsRouter.createCaller(createIdorContext(db));

    await caller.createMeeting({ countryId: CALLER_COUNTRY, userId: "someone_else", meeting });

    const organiser = expect.objectContaining({ userId: CALLER_CLERK_ID });
    expect(db.cabinetMeeting.create).toHaveBeenCalledWith({ data: organiser });
    expect(db.activitySchedule.create).toHaveBeenCalledWith({ data: organiser });
  });

  it("lets an admin schedule a meeting for a foreign country", async () => {
    const db = quickActionsDb();
    const caller = quickActionsRouter.createCaller(createIdorContext(db, "admin"));

    await caller.createMeeting({ countryId: FOREIGN_COUNTRY, meeting });

    expect(db.cabinetMeeting.create).toHaveBeenCalledTimes(1);
  });
});
