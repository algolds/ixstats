// wikios/discussions writes through the module-level `db`, not ctx.db.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    $transaction: jest.fn().mockRejectedValue(new Error("write path reached")),
    wikiDiscussionThread: { findUnique: jest.fn().mockResolvedValue(null) },
  },
  isDatabaseReadOnly: false,
}));

import { db as moduleDb } from "~/server/db";
import { createTRPCRouter } from "~/server/api/trpc";
import { legislationRouter } from "~/server/api/routers/legislation";
import { diplomaticCulturalExchangesCoreMutationsRouter } from "~/server/api/routers/diplomacy/cultural/exchanges/core/mutations";
import { managementUpdateProcedures } from "~/server/api/routers/countries/management/update";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { onomaNameBankRouter } from "~/server/api/routers/onoma/namebank";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const writeReached = () => Promise.reject(new Error("write path reached"));
const moduleTransaction = jest.mocked(moduleDb.$transaction);

describe("Plan 332: legislation requires country ownership", () => {
  function legislationDb(billCountryId: string) {
    return {
      policy: {
        create: jest.fn().mockResolvedValue({ id: "bill_new" }),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: "bill_1",
          countryId: billCountryId,
          policyType: "legislative_bill",
          status: "in_committee",
          reviewNotes: JSON.stringify({ ideologyTarget: 0 }),
        }),
      },
      legislature: { findUnique: jest.fn().mockResolvedValue(null) },
    };
  }
  const bill = { name: "Act", description: "An act", ideology: "center" as const };

  it("proposeBill rejects a member proposing for another country", async () => {
    const db = legislationDb(CALLER_COUNTRY);
    const caller = legislationRouter.createCaller(createIdorContext(db));
    await expect(caller.proposeBill({ countryId: FOREIGN_COUNTRY, ...bill })).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    expect(db.policy.create).not.toHaveBeenCalled();
  });

  it("proposeBill lets the owner and an admin write", async () => {
    const db = legislationDb(CALLER_COUNTRY);
    await legislationRouter.createCaller(createIdorContext(db)).proposeBill({
      countryId: CALLER_COUNTRY,
      ...bill,
    });
    await legislationRouter.createCaller(createIdorContext(db, "admin")).proposeBill({
      countryId: FOREIGN_COUNTRY,
      ...bill,
    });
    expect(db.policy.create).toHaveBeenCalledTimes(2);
  });

  it("holdVote rejects a member voting on another country's bill", async () => {
    const db = legislationDb(FOREIGN_COUNTRY);
    const caller = legislationRouter.createCaller(createIdorContext(db));
    await expect(caller.holdVote({ billId: "bill_1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.legislature.findUnique).not.toHaveBeenCalled();
    expect(db.policy.update).not.toHaveBeenCalled();
  });

  it("holdVote lets the owner past the check", async () => {
    const db = legislationDb(CALLER_COUNTRY);
    const caller = legislationRouter.createCaller(createIdorContext(db));
    await expect(caller.holdVote({ billId: "bill_1" })).rejects.toThrow("No seated legislature");
  });
});

describe("Plan 332: diplomaticCultural.joinCulturalExchange requires country ownership", () => {
  function exchangeDb() {
    return {
      culturalExchange: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      culturalExchangeParticipant: { create: jest.fn().mockResolvedValue({ id: "p_1" }) },
    };
  }
  const join = (countryId: string) => ({ exchangeId: "ex_1", countryId, countryName: "X" });

  it("rejects a member joining as another country", async () => {
    const db = exchangeDb();
    const caller = diplomaticCulturalExchangesCoreMutationsRouter.createCaller(
      createIdorContext(db)
    );
    await expect(caller.joinCulturalExchange(join(FOREIGN_COUNTRY))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.culturalExchangeParticipant.create).not.toHaveBeenCalled();
  });

  it("lets the owner join", async () => {
    const db = exchangeDb();
    const caller = diplomaticCulturalExchangesCoreMutationsRouter.createCaller(
      createIdorContext(db)
    );
    await caller.joinCulturalExchange(join(CALLER_COUNTRY));
    expect(db.culturalExchangeParticipant.create).toHaveBeenCalledTimes(1);
  });
});

describe("Plan 332: countries.updateCountry requires country ownership", () => {
  const router = createTRPCRouter(managementUpdateProcedures);
  const update = (id: string) => ({ id, name: "Renamed", economicInputs: {} });

  it("rejects a member updating another country", async () => {
    const db = { $transaction: jest.fn(writeReached) };
    const caller = router.createCaller(createIdorContext(db));
    await expect(caller.updateCountry(update(FOREIGN_COUNTRY))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["member", "admin"] as const)("lets the %s reach the write", async (role) => {
    const db = { $transaction: jest.fn(writeReached) };
    const target = role === "admin" ? FOREIGN_COUNTRY : CALLER_COUNTRY;
    const caller = router.createCaller(createIdorContext(db, role));
    await expect(caller.updateCountry(update(target))).rejects.toThrow("write path reached");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("Plan 332: wikios discussions only post as a country the caller may write to", () => {
  beforeEach(() => moduleTransaction.mockClear());
  const thread = { articleTitle: "Page", title: "Thread", content: "Hello" };

  it("createThread rejects posting as another country", async () => {
    const caller = wikiosDiscussionsRouter.createCaller(createIdorContext({}));
    await expect(
      caller.createThread({ ...thread, countryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(moduleTransaction).not.toHaveBeenCalled();
  });

  it("createThread allows the caller's own country or no country", async () => {
    const caller = wikiosDiscussionsRouter.createCaller(createIdorContext({}));
    await expect(caller.createThread({ ...thread, countryId: CALLER_COUNTRY })).rejects.toThrow(
      "write path reached"
    );
    await expect(caller.createThread(thread)).rejects.toThrow("write path reached");
    expect(moduleTransaction).toHaveBeenCalledTimes(2);
  });

  it("postComment rejects posting as another country", async () => {
    const caller = wikiosDiscussionsRouter.createCaller(createIdorContext({}));
    await expect(
      caller.postComment({ threadId: "t_1", content: "Hi", countryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(moduleTransaction).not.toHaveBeenCalled();
  });
});

describe("Plan 332: security.resolvePvNPCConflict only strikes NPC nations", () => {
  it("rejects a strike on a nation claimed by a player", async () => {
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "db_user_caller", countryId: CALLER_COUNTRY }),
        findFirst: jest.fn().mockResolvedValue({ id: "db_user_foreign" }),
      },
      militaryBranch: { findMany: jest.fn() },
      storytellerEffect: { createMany: jest.fn() },
    };
    const ctx = createIdorContext(db);
    ctx.user = { ...ctx.user!, membershipTier: "mycountry_premium" };
    const caller = securityConflictsRouter.createCaller(ctx);

    await expect(
      caller.resolvePvNPCConflict({ targetCountryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("NPC") });
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownedCountries: { some: { id: FOREIGN_COUNTRY } } } })
    );
    expect(db.militaryBranch.findMany).not.toHaveBeenCalled();
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
  });

  it("rejects a strike on the caller's own nation even when nobody owns it (system-owner pointer)", async () => {
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "db_user_caller", countryId: CALLER_COUNTRY }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      militaryBranch: { findMany: jest.fn() },
      storytellerEffect: { createMany: jest.fn() },
    };
    const ctx = createIdorContext(db);
    ctx.user = { ...ctx.user!, membershipTier: "mycountry_premium" };
    const caller = securityConflictsRouter.createCaller(ctx);

    await expect(
      caller.resolvePvNPCConflict({ targetCountryId: CALLER_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.militaryBranch.findMany).not.toHaveBeenCalled();
  });
});

describe("Plan 332: onoma.saveToNameBank only tags a country the caller may write to", () => {
  const entry = {
    type: "saved-name" as const,
    title: "Name",
    values: ["A"],
    stashId: "standalone",
  };

  it("rejects tagging an entry to another country", async () => {
    const db = { nameBank: { create: jest.fn(writeReached) } };
    const caller = onomaNameBankRouter.createCaller(createIdorContext(db));
    await expect(
      caller.saveToNameBank({ ...entry, countryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.nameBank.create).not.toHaveBeenCalled();
  });

  it("lets the owner tag their own country", async () => {
    const db = { nameBank: { create: jest.fn(writeReached) } };
    const caller = onomaNameBankRouter.createCaller(createIdorContext(db));
    await expect(caller.saveToNameBank({ ...entry, countryId: CALLER_COUNTRY })).rejects.toThrow(
      "write path reached"
    );
    expect(db.nameBank.create).toHaveBeenCalledTimes(1);
  });
});

describe("onoma.saveToNameBank only writes the caller's own entries and stashes", () => {
  const base = { type: "saved-name" as const, title: "Name", values: ["A"] };

  it("refuses to update a standalone entry the caller does not own", async () => {
    const db = {
      nameBank: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn(writeReached) },
    };
    const caller = onomaNameBankRouter.createCaller(createIdorContext(db));
    await expect(
      caller.saveToNameBank({ ...base, stashId: "standalone", id: "someone_elses_entry" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.nameBank.update).not.toHaveBeenCalled();
  });

  it("refuses to write into a stash the caller does not own", async () => {
    const db = {
      stash: { findFirst: jest.fn().mockResolvedValue(null) },
      stashItem: { upsert: jest.fn(writeReached), findUnique: jest.fn(writeReached) },
    };
    const caller = onomaNameBankRouter.createCaller(createIdorContext(db));
    await expect(
      caller.saveToNameBank({ ...base, stashId: "someone_elses_stash" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Ownership accepts the caller's internal User id and (legacy) Clerk id, nobody else's.
    expect(db.stash.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "someone_elses_stash",
          userId: { in: expect.arrayContaining([CALLER_CLERK_ID]) },
        },
      })
    );
    expect(db.stashItem.upsert).not.toHaveBeenCalled();
  });
});
