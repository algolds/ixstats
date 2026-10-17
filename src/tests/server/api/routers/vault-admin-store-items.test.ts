/** @jest-environment node */
/**
 * Lore tokens were withdrawn with paid lore requests (cards refresh spec §2.2): no admin update can put one back on
 * sale. A null `effects` clears the column (Prisma needs `DbNull` there) instead of failing the save.
 */
import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultAdminStoreRouter } from "~/server/api/routers/vault/admin/store";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const admin = {
  id: "u_admin",
  clerkUserId: "admin_clerk",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const tokenItem = {
  id: "upgrade_lore_token",
  name: "Lore Request Token",
  price: 2500,
  category: "upgrades",
  isActive: false,
  effects: { perks: { loreTokens: 1 } },
};
const clubItem = {
  ...tokenItem,
  id: "upgrade_myclub_license",
  name: "MyClub Team License Token",
  price: 5000,
  isActive: true,
};

function setup(existing: typeof tokenItem) {
  const db = createMockPrisma();
  db.vaultStoreItem.findUnique.mockResolvedValue(existing);
  db.vaultStoreItem.update.mockImplementation(async ({ data }: { data: object }) => ({
    ...existing,
    ...data,
  }));
  const caller = createCallerFactory(vaultAdminStoreRouter)(
    createMockRouterContext({ auth: { userId: admin.clerkUserId }, user: admin, db }) as never
  );
  return { db, caller };
}

const edit = { id: tokenItem.id, name: tokenItem.name, price: 2500, category: "upgrades" };

describe("adminUpdateStoreItem and the withdrawn lore tokens", () => {
  it("refuses to put a lore token item back on sale, explicitly or through the isActive default", async () => {
    const { db, caller } = setup(tokenItem);

    for (const input of [{ ...edit, isActive: true }, edit]) {
      await expect(caller.adminUpdateStoreItem(input)).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This item was withdrawn and cannot be put back on sale.",
      });
    }
    expect(db.vaultStoreItem.update).not.toHaveBeenCalled();
  });

  it("still saves a lore token item that stays off sale", async () => {
    const { db, caller } = setup(tokenItem);

    await expect(caller.adminUpdateStoreItem({ ...edit, isActive: false })).resolves.toMatchObject({
      success: true,
    });
    expect(db.vaultStoreItem.update.mock.calls[0][0].data).toMatchObject({ isActive: false });
  });
});

describe("adminUpdateStoreItem effects", () => {
  const clubEdit = { id: clubItem.id, name: clubItem.name, price: 5000, category: "upgrades" };

  it("clears the column for a null effects", async () => {
    const { db, caller } = setup(clubItem);

    await caller.adminUpdateStoreItem({ ...clubEdit, effects: null });

    expect(db.vaultStoreItem.update.mock.calls[0][0].data.effects).toBe(Prisma.DbNull);
  });

  it("leaves the column alone when effects is omitted, and writes one that is sent", async () => {
    const { db, caller } = setup(clubItem);

    await caller.adminUpdateStoreItem(clubEdit);
    await caller.adminUpdateStoreItem({ ...clubEdit, effects: { perks: { cardCapacity: 50 } } });

    expect(db.vaultStoreItem.update.mock.calls[0][0].data).not.toHaveProperty("effects");
    expect(db.vaultStoreItem.update.mock.calls[1][0].data.effects).toEqual({
      perks: { cardCapacity: 50 },
    });
  });
});
