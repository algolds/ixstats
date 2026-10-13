/** @jest-environment node */
/**
 * The Ixnay relief rebuild guard: Ixnay's map is hand drawn, so a world apply never reaches it, except a site admin's
 * relief rebuild (`ixnay: true`). `loadImportRealm` already refuses a person who may not edit Ixnay's map; the guard's
 * own site admin clause is pinned here by letting that check pass, as it would if the access rule ever widened.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/modules/maps/map-import.realm", () => ({
  ...jest.requireActual("~/server/modules/maps/map-import.realm"),
  loadImportRealm: jest.fn(async (_db: unknown, _actor: unknown, id: string) => ({
    id,
    slug: id,
    name: id,
    ownerId: "owner",
    settings: {},
  })),
}));

import { assertWorldImportAllowed } from "~/server/modules/maps/world-import.guards";

const claims = { realmClaim: { count: jest.fn().mockResolvedValue(0) } };
const db = { realm: {}, ...claims } as never;
const siteAdmin = { id: "u1", clerkUserId: "c1", role: { name: "admin", level: 10 } };
const officer = { id: "u2", clerkUserId: "c2", role: null };

describe("assertWorldImportAllowed on Ixnay", () => {
  it("lets a site admin rebuild its relief", async () => {
    await expect(
      assertWorldImportAllowed(db, siteAdmin, "default", { claims: false, ixnay: true })
    ).resolves.toMatchObject({ id: "default" });
  });

  it("refuses the relief rebuild to an actor who is not a site admin, even one who may edit the map", async () => {
    await expect(
      assertWorldImportAllowed(db, officer, "default", { claims: false, ixnay: true })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a world apply to a site admin without the relief option or a layer choice", async () => {
    await expect(assertWorldImportAllowed(db, siteAdmin, "default")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
