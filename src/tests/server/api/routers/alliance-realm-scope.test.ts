import { Prisma } from "@prisma/client";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";

jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { Diplomatic: { onAllianceFormed: jest.fn(), onAllianceJoined: jest.fn() } },
}));

const createCaller = createCallerFactory(diplomaticPoliciesRouter);

const callerFor = (db: any, userId = "uA", countryId = "A") =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as any
  ) as any;

function seed() {
  const { db } = createDiplomacyFakeDb({
    countries: [
      { id: "A", name: "Alpha", realmId: "eurth-id", ownerUserId: "uA", owner: { clerkUserId: "clerk_uA" } },
      { id: "E", name: "Esonice", realmId: "eurth-id", ownerUserId: "uE", owner: { clerkUserId: "clerk_uE" } },
      { id: "I", name: "Ixia", realmId: "default", ownerUserId: "uI", owner: { clerkUserId: "clerk_uI" } },
    ],
    alliances: [{ id: "al1", name: "Aurelian League", realmId: "eurth-id", memberCount: 1 }],
    allianceMembers: [
      { id: "mA", allianceId: "al1", countryId: "A", role: "founder", isActive: true, status: "active" },
    ],
    relations: [],
    actingUsers: [],
  });
  return db;
}

describe("alliances are realm-scoped", () => {
  it("refuses to invite a nation of another realm", async () => {
    const db = seed();
    await expect(callerFor(db).inviteMember({ allianceId: "al1", targetCountryId: "I" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("realm-scoped"),
    });
    expect(db.allianceMember.create).not.toHaveBeenCalled();
  });

  it("invites a nation of the alliance's own realm", async () => {
    const db = seed();
    await expect(callerFor(db).inviteMember({ allianceId: "al1", targetCountryId: "E" })).resolves.toMatchObject({
      success: true,
      pending: true,
    });
  });

  it("refuses to accept a (legacy) invite across realms", async () => {
    const { db } = createDiplomacyFakeDb({
      countries: [
        { id: "A", name: "Alpha", realmId: "eurth-id", ownerUserId: "uA", owner: { clerkUserId: "clerk_uA" } },
        { id: "I", name: "Ixia", realmId: "default", ownerUserId: "uI", owner: { clerkUserId: "clerk_uI" } },
      ],
      alliances: [{ id: "al1", name: "Aurelian League", realmId: "eurth-id", memberCount: 1 }],
      allianceMembers: [
        { id: "mA", allianceId: "al1", countryId: "A", role: "founder", isActive: true, status: "active" },
        {
          id: "mI",
          allianceId: "al1",
          countryId: "I",
          role: "member",
          isActive: false,
          status: "invited",
          invitedByCountryId: "A",
          invitedAt: new Date(),
        },
      ],
      relations: [],
      actingUsers: [],
    });
    await expect(
      callerFor(db, "uI", "I").respondToAllianceInvite({ allianceId: "al1", countryId: "I", choice: "accept" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates an alliance in the founding nation's realm and explains a same-realm name clash", async () => {
    const create = jest.fn().mockResolvedValue({ id: "al2", members: [] });
    const db: any = {
      country: { findUnique: jest.fn().mockResolvedValue({ name: "Alpha", realmId: "eurth-id" }) },
      alliance: { create },
      user: { findUnique: jest.fn().mockResolvedValue({ countryId: "A", role: { name: "member" } }) },
    };
    await callerFor(db).createAlliance({ name: "Aurelian League", type: "political" });
    expect(create.mock.calls[0][0].data).toMatchObject({ realmId: "eurth-id", name: "Aurelian League" });

    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { modelName: "Alliance", target: ["realmId", "name"] },
      })
    );
    await expect(callerFor(db).createAlliance({ name: "Aurelian League", type: "political" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("in this realm"),
    });
  });

  it("allows the same name in two realms: the name is unique per realm, not globally", () => {
    const alliance = Prisma.dmmf.datamodel.models.find((m) => m.name === "Alliance")!;
    expect(alliance.fields.find((f) => f.name === "name")!.isUnique).toBe(false);
    expect(alliance.uniqueFields).toEqual(expect.arrayContaining([["realmId", "name"]]));
    expect(alliance.fields.find((f) => f.name === "realmId")!.default).toBe("default");
  });
});
