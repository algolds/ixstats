import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const NPC_COUNTRY = "country_npc";

function targetsDb() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ countryId: CALLER_COUNTRY }),
    },
    diplomaticRelation: {
      findMany: jest.fn().mockResolvedValue([
        { country1: CALLER_COUNTRY, country2: FOREIGN_COUNTRY },
        { country1: NPC_COUNTRY, country2: CALLER_COUNTRY },
      ]),
    },
    country: {
      // FOREIGN_COUNTRY is owned by a player, so the unowned filter leaves only the NPC nation.
      findMany: jest.fn().mockResolvedValue([{ id: NPC_COUNTRY, name: "Npcland" }]),
    },
  };
}

function premiumCaller(db: ReturnType<typeof targetsDb>) {
  const ctx = createIdorContext(db);
  ctx.user = { ...ctx.user!, membershipTier: "mycountry_premium" };
  return securityConflictsRouter.createCaller(ctx);
}

describe("security.getPvNPCTargets lists only NPC nations", () => {
  it("drops related nations claimed by a player", async () => {
    const db = targetsDb();
    const targets = await premiumCaller(db).getPvNPCTargets();

    expect(targets).toEqual([{ id: NPC_COUNTRY, name: "Npcland" }]);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [FOREIGN_COUNTRY, NPC_COUNTRY] }, ownerUserId: null },
      })
    );
  });

  it("returns nothing when the caller has no relations", async () => {
    const db = targetsDb();
    db.diplomaticRelation.findMany.mockResolvedValue([]);

    await expect(premiumCaller(db).getPvNPCTargets()).resolves.toEqual([]);
    expect(db.country.findMany).not.toHaveBeenCalled();
  });
});
