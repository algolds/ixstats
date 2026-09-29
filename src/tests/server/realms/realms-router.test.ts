/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmsRouter } from "~/server/api/routers/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

function caller(findUnique: jest.Mock) {
  const ctx = createMockRouterContext({ db: { realm: { findUnique } }, auth: null, user: null });
  return realmsRouter.createCaller(ctx as never);
}

describe("realms.getBySlug", () => {
  it("replaces owner ids with a claimed flag", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: "default",
      slug: "ixworld",
      name: "IxWorld",
      description: null,
      thumbnail: null,
      status: "active",
      visibility: "public",
      countries: [
        { id: "c1", name: "Aurelia", slug: "aurelia", flag: null, ownerUserId: "u_secret" },
        { id: "c2", name: "Borea", slug: "borea", flag: null, ownerUserId: null },
      ],
    });
    const realm = await caller(findUnique).getBySlug({ slug: "ixworld" });

    expect(realm?.countries).toEqual([
      { id: "c1", name: "Aurelia", slug: "aurelia", flag: null, claimed: true },
      { id: "c2", name: "Borea", slug: "borea", flag: null, claimed: false },
    ]);
    for (const c of realm?.countries ?? []) expect(c).not.toHaveProperty("ownerUserId");
    expect(JSON.stringify(realm)).not.toContain("u_secret");
  });

  it("returns null for an unknown slug", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    await expect(caller(findUnique).getBySlug({ slug: "nowhere" })).resolves.toBeNull();
  });
});
