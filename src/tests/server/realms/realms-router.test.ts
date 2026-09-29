/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
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

describe("realms.adminCreateRealm", () => {
  const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
  const member = { id: "db_member", clerkUserId: "member_1", role: { name: "user", level: 100 } };

  function adminCaller(create: jest.Mock, user = admin) {
    const ctx = createMockRouterContext({
      db: { realm: { create }, auditLog: { create: jest.fn() } },
      auth: { userId: user.clerkUserId },
      user,
    });
    return realmsRouter.createCaller(ctx as never);
  }

  it("creates an active realm owned by system unless an owner is given", async () => {
    const create = jest.fn().mockResolvedValue({ id: "r1", slug: "eurth", name: "Eurth" });

    await adminCaller(create).adminCreateRealm({ slug: "eurth", name: "Eurth", visibility: "public" });
    await adminCaller(create).adminCreateRealm({
      slug: "eurth-2",
      name: "Eurth II",
      description: "Second",
      visibility: "unlisted",
      ownerId: "user_founder",
    });

    expect(create).toHaveBeenNthCalledWith(1, {
      data: { slug: "eurth", name: "Eurth", visibility: "public", ownerId: "system", status: "active" },
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      data: {
        slug: "eurth-2",
        name: "Eurth II",
        description: "Second",
        visibility: "unlisted",
        ownerId: "user_founder",
        status: "active",
      },
    });
  });

  it.each(["Eurth", "e", "a".repeat(41), "eu rth", "eurth!", "eurth_2"])(
    "rejects the slug %p without touching the database",
    async (slug) => {
      const create = jest.fn();
      await expect(
        adminCaller(create).adminCreateRealm({ slug, name: "Eurth", visibility: "public" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("turns a duplicate slug (P2002) into CONFLICT", async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );
    await expect(
      adminCaller(create).adminCreateRealm({ slug: "ixworld", name: "Copy", visibility: "public" })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "That slug is taken" });
  });

  it("is admin-only", async () => {
    const create = jest.fn();
    await expect(
      adminCaller(create, member).adminCreateRealm({ slug: "eurth", name: "Eurth", visibility: "public" })
    ).rejects.toThrow("Admin privileges required");
    expect(create).not.toHaveBeenCalled();
  });
});
