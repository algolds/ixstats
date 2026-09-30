import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

const createCaller = createCallerFactory(diplomaticPoliciesRouter);

const matches = (row: any, where: any): boolean =>
  Object.entries(where ?? {}).every(([k, v]) => {
    if (k === "OR") return (v as any[]).some((w) => matches(row, w));
    if (v && typeof v === "object" && "in" in (v as any)) return (v as any).in.includes(row[k]);
    return row[k] === v;
  });

function makeDb(opts: { relation?: any; trade?: any } = {}) {
  const rows: any[] = [];
  let seq = 0;
  const names: Record<string, string> = { A: "Alpha", B: "Beta" };
  const withRefs = (r: any) => ({
    ...r,
    initiator: { id: r.initiatorId, name: names[r.initiatorId] ?? r.initiatorId },
    target: { id: r.targetId, name: names[r.targetId] ?? r.targetId },
  });
  const db: any = createMockPrisma({
    foreignPolicyAction: {
      rows,
      findUnique: jest.fn(async ({ where }: any) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? withRefs(r) : null;
      }),
      findFirst: jest.fn(async ({ where }: any) => rows.find((x) => matches(x, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter((x) => matches(x, where)).map(withRefs)
      ),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: `fp${++seq}`, createdAt: new Date(), ...data };
        rows.push(r);
        return withRefs(r);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = rows.find((x) => x.id === where.id);
        Object.assign(r, data);
        return withRefs(r);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((x) => matches(x, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    country: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        name: names[where.id] ?? where.id,
        currentGdpPerCapita: 30000,
        currentPopulation: 5_000_000,
      })),
    },
    diplomaticRelation: {
      findFirst: jest.fn().mockResolvedValue(opts.relation ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    bilateralTrade: {
      findUnique: jest.fn().mockResolvedValue(opts.trade ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    storytellerEffect: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ countryId: null, role: { name: "member" } }),
    },
  });
  return { db, rows };
}

const callerFor = (db: any, userId: string, countryId: string | null) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as any
  ) as any;

describe("foreign policy: cooperative consent", () => {
  it("stores a cooperative proposal as proposed with no effects applied", async () => {
    const { db } = makeDb();
    const res = await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(res.status).toBe("proposed");
    expect(res.pendingConsent).toBe(true);
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
  });

  it("applies hostile actions immediately (effects written, status active)", async () => {
    const { db } = makeDb({
      relation: { id: "rel1", strength: 50, tradeVolume: 100 },
      trade: { id: "t1", tradeVolume: 100, exportsFrom1: 60, exportsFrom2: 40 },
    });
    const res = await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "embargo",
    });
    expect(res.status).toBe("active");
    expect(db.storytellerEffect.createMany).toHaveBeenCalledTimes(1);
    expect(db.diplomaticRelation.update).toHaveBeenCalled();
    expect(db.bilateralTrade.update).toHaveBeenCalled();
  });

  it("lists incoming proposals only for the target's owner", async () => {
    const { db } = makeDb();
    await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "military_alliance",
    });
    const list = await callerFor(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" });
    expect(list).toHaveLength(1);
    expect(list[0].initiator.name).toBe("Alpha");
    await expect(
      callerFor(db, "uA", "A").getForeignPolicyProposals({ countryId: "B" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a response from anyone but the target's owner (including the initiator)", async () => {
    const { db, rows } = makeDb();
    await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    const id = rows[0].id;
    await expect(
      callerFor(db, "uA", "A").respondToForeignPolicyProposal({ actionId: id, choice: "accept" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerFor(db, "uC", "C").respondToForeignPolicyProposal({ actionId: id, choice: "decline" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows[0].status).toBe("proposed");
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
  });

  it("accept applies the stored effects on both sides and activates the action", async () => {
    const { db, rows } = makeDb({
      relation: { id: "rel1", strength: 60, tradeVolume: 100 },
      trade: { id: "t1", tradeVolume: 100, exportsFrom1: 60, exportsFrom2: 40 },
    });
    await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    const res = await callerFor(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: rows[0].id,
      choice: "accept",
    });
    expect(res.status).toBe("active");
    expect(rows[0].status).toBe("active");
    const effects = db.storytellerEffect.createMany.mock.calls[0][0].data;
    expect(effects.map((e: any) => e.countryId)).toEqual(["A", "B"]);
    expect(effects.every((e: any) => e.inputType === "TRADE_AGREEMENT")).toBe(true);
    expect(db.diplomaticRelation.update).toHaveBeenCalledTimes(1);
    expect(db.bilateralTrade.update.mock.calls[0][0].data.tradeVolume).toBeCloseTo(125);

    // A second response is refused rather than enacting twice.
    await expect(
      callerFor(db, "uB", "B").respondToForeignPolicyProposal({
        actionId: rows[0].id,
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.storytellerEffect.createMany).toHaveBeenCalledTimes(1);
  });

  it("decline applies nothing, and clears the re-proposal block", async () => {
    const { db, rows } = makeDb();
    const initiator = callerFor(db, "uA", "A");
    await initiator.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" });

    // While pending, re-proposing is blocked.
    await expect(
      initiator.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const res = await callerFor(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: rows[0].id,
      choice: "decline",
    });
    expect(res.status).toBe("declined");
    expect(rows[0].status).toBe("declined");
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();

    const again = await initiator.proposeForeignPolicyAction({
      targetId: "B",
      actionType: "military_alliance",
    });
    expect(again.status).toBe("proposed");
    expect(rows).toHaveLength(2);
  });
});

describe("alliances: invite requires consent", () => {
  function makeAllianceDb() {
    const members: any[] = [
      {
        id: "m1",
        allianceId: "al1",
        countryId: "A",
        role: "founder",
        isActive: true,
        status: "active",
      },
    ];
    const db: any = createMockPrisma({
      allianceMember: {
        members,
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return members.find((m) => m.id === where.id) ?? null;
          const k = where.allianceId_countryId;
          return (
            members.find((m) => m.allianceId === k.allianceId && m.countryId === k.countryId) ??
            null
          );
        }),
        findMany: jest.fn(async ({ where }: any) =>
          members
            .filter((m) => matches(m, where))
            .map((m) => ({
              ...m,
              createdAt: new Date(),
              updatedAt: new Date(),
              alliance: { id: m.allianceId, name: "League" },
            }))
        ),
        create: jest.fn(async ({ data }: any) => {
          const m = { id: `m${members.length + 1}`, ...data };
          members.push(m);
          return m;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const m = members.find((x) => x.id === where.id);
          Object.assign(m, data);
          return m;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const hit = members.filter((m) => matches(m, where));
          hit.forEach((m) => Object.assign(m, data));
          return { count: hit.length };
        }),
        count: jest.fn(async ({ where }: any) => members.filter((m) => matches(m, where)).length),
      },
      alliance: {
        findUnique: jest.fn().mockResolvedValue({ name: "League" }),
        update: jest.fn().mockResolvedValue({}),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue({ id: "B", owner: null }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ countryId: null, role: { name: "member" } }),
      },
    });
    return { db, members };
  }

  it("inviteMember creates a pending invite without granting membership", async () => {
    const { db, members } = makeAllianceDb();
    const res = await callerFor(db, "uA", "A").inviteMember({
      allianceId: "al1",
      targetCountryId: "B",
    });
    expect(res.pending).toBe(true);
    const invite = members.find((m) => m.countryId === "B");
    expect(invite).toMatchObject({ isActive: false, status: "invited" });
    expect(db.alliance.update).not.toHaveBeenCalled();
    // Not a member yet: nothing counts B as active.
    expect(members.filter((m) => m.isActive)).toHaveLength(1);
  });

  it("only the invited country's owner can list and answer the invite", async () => {
    const { db, members } = makeAllianceDb();
    await callerFor(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });

    const invites = await callerFor(db, "uB", "B").getAllianceInvites({ countryId: "B" });
    expect(invites).toHaveLength(1);
    await expect(
      callerFor(db, "uA", "A").getAllianceInvites({ countryId: "B" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerFor(db, "uA", "A").respondToAllianceInvite({
        allianceId: "al1",
        countryId: "B",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(members.find((m) => m.countryId === "B")!.isActive).toBe(false);
  });

  it("accepting activates membership and updates the member count", async () => {
    const { db, members } = makeAllianceDb();
    await callerFor(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });
    const res = await callerFor(db, "uB", "B").respondToAllianceInvite({
      allianceId: "al1",
      countryId: "B",
      choice: "accept",
    });
    expect(res.status).toBe("active");
    expect(members.find((m) => m.countryId === "B")).toMatchObject({
      isActive: true,
      status: "active",
    });
    expect(db.alliance.update).toHaveBeenCalledWith({
      where: { id: "al1" },
      data: { memberCount: 2 },
    });
    await expect(
      callerFor(db, "uB", "B").respondToAllianceInvite({
        allianceId: "al1",
        countryId: "B",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("declining leaves the country out and allows a fresh invite later", async () => {
    const { db, members } = makeAllianceDb();
    const founder = callerFor(db, "uA", "A");
    await founder.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    const res = await callerFor(db, "uB", "B").respondToAllianceInvite({
      allianceId: "al1",
      countryId: "B",
      choice: "decline",
    });
    expect(res.status).toBe("declined");
    expect(members.find((m) => m.countryId === "B")).toMatchObject({
      isActive: false,
      status: "declined",
    });
    expect(await callerFor(db, "uB", "B").getAllianceInvites({ countryId: "B" })).toHaveLength(0);

    await founder.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    expect(members.find((m) => m.countryId === "B")).toMatchObject({
      isActive: false,
      status: "invited",
    });
  });
});
