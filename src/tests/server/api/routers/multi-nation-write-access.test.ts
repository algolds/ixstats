/**
 * Multi-nation accounts: write actions authorise against any nation the caller owns
 * (Country.ownerUserId), not only the active-nation pointer (User.countryId).
 */
import { electionsPartiesRouter } from "~/server/api/routers/elections/parties";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("country writes for a non-active owned nation", () => {
  const createCaller = createCallerFactory(electionsPartiesRouter);

  function setup(ownerUserId: string | null) {
    const db = createMockPrisma();
    // The caller's active nation is country_active; the target is country_second.
    db.user.findUnique.mockResolvedValue({
      id: "user_db_id_1",
      clerkUserId: "test_user_clerk_id",
      countryId: "country_active",
      role: null,
    });
    db.country.findUnique.mockResolvedValue({ id: "country_second", ownerUserId });
    db.politicalParty.findUnique.mockResolvedValue({ id: "party_1", countryId: "country_second" });
    db.politicalParty.delete.mockResolvedValue({ id: "party_1" });
    const ctx = createMockRouterContext({
      db,
      user: { id: "user_db_id_1", countryId: "country_active", role: null } as any,
    });
    return { db, caller: createCaller(ctx as any) };
  }

  it("lets the owner manage a party of a nation that is not their active one", async () => {
    const { db, caller } = setup("user_db_id_1");
    await expect(caller.deleteParty({ id: "party_1" })).resolves.toEqual({ id: "party_1" });
    expect(db.politicalParty.delete).toHaveBeenCalledWith({ where: { id: "party_1" } });
  });

  it("still refuses a nation owned by someone else", async () => {
    const { db, caller } = setup("user_someone_else");
    await expect(caller.deleteParty({ id: "party_1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.politicalParty.delete).not.toHaveBeenCalled();
  });
});
