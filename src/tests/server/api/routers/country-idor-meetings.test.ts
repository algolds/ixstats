import { meetingsRouter } from "~/server/api/routers/meetings";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

/** Rows owned by each country, keyed by id; anything else is "not found". */
const MEETINGS: Record<string, string> = {
  meeting_own: CALLER_COUNTRY,
  meeting_foreign: FOREIGN_COUNTRY,
};
const STRUCTURES: Record<string, string> = {
  structure_own: CALLER_COUNTRY,
  structure_foreign: FOREIGN_COUNTRY,
};
const DEPARTMENTS: Record<string, string> = {
  department_own: CALLER_COUNTRY,
  department_foreign: FOREIGN_COUNTRY,
};
const OFFICIALS: Record<string, string> = {
  official_own: CALLER_COUNTRY,
  official_foreign: FOREIGN_COUNTRY,
};

type ById = { where: { id: string } };
const echoCreate = async ({ data }: { data: object }) => ({ id: "row_new", ...data });

function meetingsDb() {
  return {
    cabinetMeeting: {
      create: jest.fn(async ({ data }: { data: object }) => ({
        id: "meeting_new",
        title: "Summit",
        scheduledDate: new Date(),
        userId: CALLER_CLERK_ID,
        ...data,
      })),
      findUnique: jest.fn(async ({ where }: ById) =>
        MEETINGS[where.id] ? { countryId: MEETINGS[where.id] } : null
      ),
    },
    meetingAgendaItem: { create: jest.fn(echoCreate) },
    meetingAttendance: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(echoCreate),
    },
    governmentStructure: {
      findUnique: jest.fn(async ({ where }: ById) =>
        STRUCTURES[where.id] ? { countryId: STRUCTURES[where.id] } : null
      ),
    },
    governmentDepartment: {
      findUnique: jest.fn(async ({ where }: ById) =>
        DEPARTMENTS[where.id] ? { governmentStructure: { countryId: DEPARTMENTS[where.id] } } : null
      ),
    },
    governmentOfficial: {
      findUnique: jest.fn(async ({ where }: ById) =>
        OFFICIALS[where.id]
          ? { governmentStructure: { countryId: OFFICIALS[where.id] }, department: null }
          : null
      ),
      create: jest.fn(echoCreate),
      update: jest.fn(echoCreate),
    },
  };
}

function setup(role: "member" | "admin" = "member") {
  const db = meetingsDb();
  return { db, caller: meetingsRouter.createCaller(createIdorContext(db, role)) };
}

const agendaItem = (meetingId: string) => ({ meetingId, title: "Tariffs", order: 0 });
const attendance = (meetingId: string) => ({
  meetingId,
  attendeeName: "Minister",
  attendanceStatus: "invited" as const,
});
const appointment = { name: "A. Minister", title: "Minister", role: "Cabinet Member" };
const appointedDate = new Date("2026-10-01T00:00:00Z");

describe("Plan 332: meetings mutations require country ownership", () => {
  describe("createMeeting", () => {
    const input = { title: "Summit", scheduledDate: new Date(), userId: "someone_else" };

    it("rejects a member creating a meeting for another country", async () => {
      const { db, caller } = setup();
      await expect(
        caller.createMeeting({ ...input, countryId: FOREIGN_COUNTRY })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.cabinetMeeting.create).not.toHaveBeenCalled();
    });

    it("records the caller as organiser, ignoring the client-sent userId", async () => {
      const { db, caller } = setup();
      await caller.createMeeting({ ...input, countryId: CALLER_COUNTRY });
      expect(db.cabinetMeeting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ countryId: CALLER_COUNTRY, userId: CALLER_CLERK_ID }),
      });
    });
  });

  describe("addAgendaItem", () => {
    it("rejects a member adding to another country's meeting", async () => {
      const { db, caller } = setup();
      await expect(caller.addAgendaItem(agendaItem("meeting_foreign"))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.meetingAgendaItem.create).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND for an unknown meeting", async () => {
      const { db, caller } = setup();
      await expect(caller.addAgendaItem(agendaItem("meeting_missing"))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.meetingAgendaItem.create).not.toHaveBeenCalled();
    });

    it("lets the owner and an admin add items", async () => {
      await setup().caller.addAgendaItem(agendaItem("meeting_own"));
      const admin = setup("admin");
      await admin.caller.addAgendaItem(agendaItem("meeting_foreign"));
      expect(admin.db.meetingAgendaItem.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("recordAttendance", () => {
    it("rejects a member recording attendance on another country's meeting", async () => {
      const { db, caller } = setup();
      await expect(caller.recordAttendance(attendance("meeting_foreign"))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.meetingAttendance.create).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND for an unknown meeting", async () => {
      const { caller } = setup();
      await expect(caller.recordAttendance(attendance("meeting_missing"))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("lets the owner record attendance", async () => {
      const { db, caller } = setup();
      await caller.recordAttendance(attendance("meeting_own"));
      expect(db.meetingAttendance.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("appointOfficial", () => {
    it.each([
      ["a foreign structure", { governmentStructureId: "structure_foreign" }],
      ["a foreign department", { departmentId: "department_foreign" }],
      [
        "an own structure with a foreign department",
        { governmentStructureId: "structure_own", departmentId: "department_foreign" },
      ],
    ])("rejects a member appointing into %s", async (_label, placement) => {
      const { db, caller } = setup();
      await expect(
        caller.appointOfficial({ ...appointment, ...placement, appointedDate })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.governmentOfficial.create).not.toHaveBeenCalled();
    });

    it("rejects a member creating an official with no structure or department", async () => {
      const { db, caller } = setup();
      await expect(caller.appointOfficial({ ...appointment, appointedDate })).rejects.toMatchObject(
        { code: "NOT_FOUND" }
      );
      expect(db.governmentOfficial.create).not.toHaveBeenCalled();
    });

    it("lets the owner appoint into their own structure and department", async () => {
      const { db, caller } = setup();
      await caller.appointOfficial({
        ...appointment,
        governmentStructureId: "structure_own",
        departmentId: "department_own",
        appointedDate,
      });
      expect(db.governmentOfficial.create).toHaveBeenCalledTimes(1);
    });

    it("lets an admin appoint into a foreign structure", async () => {
      const { db, caller } = setup("admin");
      await caller.appointOfficial({
        ...appointment,
        governmentStructureId: "structure_foreign",
        appointedDate,
      });
      expect(db.governmentOfficial.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeOfficial", () => {
    it("rejects a member removing another country's official", async () => {
      const { db, caller } = setup();
      await expect(caller.removeOfficial({ id: "official_foreign" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.governmentOfficial.update).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND for an unknown official", async () => {
      const { caller } = setup();
      await expect(caller.removeOfficial({ id: "official_missing" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("lets the owner remove their own official", async () => {
      const { db, caller } = setup();
      await caller.removeOfficial({ id: "official_own" });
      expect(db.governmentOfficial.update).toHaveBeenCalledTimes(1);
    });
  });
});
