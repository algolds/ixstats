/** @jest-environment node */
/**
 * atlas.studio.createRealm and applyStatus: a draft, unlisted realm owned by the admin who made it, and the
 * world status Ixnay's layer choice reads (the founder's worldStatus refuses Ixnay).
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { atlasStudioRouter } from "~/server/api/routers/atlas/studio";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, fakeDb, founder } from "~/tests/server/maps/map-import-fakes";

function caller(user: typeof admin, create = jest.fn()) {
  const createMany = jest.fn().mockResolvedValue({ count: 4 });
  const threadCreateMany = jest.fn().mockResolvedValue({ count: 1 });
  const db = Object.assign(fakeDb(), {
    $transaction: jest.fn(async (fn: (tx: object) => Promise<object>) =>
      fn({
        realm: { create },
        forumCategory: { createMany, findFirst: jest.fn().mockResolvedValue({ id: "cat_board" }) },
        forumThread: { createMany: threadCreateMany },
      })
    ),
  });
  const api = createCallerFactory(atlasStudioRouter)(
    createMockRouterContext({
      db,
      auth: { userId: user.clerkUserId },
      user: { ...user, country: null },
    }) as never
  );
  return { api, db, create, createMany };
}

describe("atlas.studio.createRealm", () => {
  const made = { id: "r_new", slug: "new-world", name: "New world" };

  it("creates a draft, unlisted realm owned by the calling admin, and seeds its forum categories", async () => {
    const { api, create, createMany } = caller(admin, jest.fn().mockResolvedValue(made));
    await expect(api.createRealm({ name: " New world ", slug: "new-world" })).resolves.toEqual({
      realmId: "r_new",
      slug: "new-world",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        name: "New world",
        slug: "new-world",
        ownerId: admin.clerkUserId,
        visibility: "unlisted",
        status: "draft",
      },
    });
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ realmId: "r_new", key: "hub" })]),
      })
    );
  });

  it.each(["Eurth", "e", "mine", "ixnay", "ixworld", "default", "a".repeat(41), "eu rth"])(
    "rejects the slug %p without touching the database",
    async (slug) => {
      const { api, create } = caller(admin);
      await expect(api.createRealm({ name: "X", slug })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("rejects an empty name, turns a taken slug into CONFLICT, and is admin-only", async () => {
    await expect(
      caller(admin).api.createRealm({ name: "  ", slug: "ok-slug" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const taken = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    await expect(
      caller(admin, jest.fn().mockRejectedValue(taken)).api.createRealm({
        name: "Copy",
        slug: "taken-slug",
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "That slug is taken" });
    const { api, create } = caller(founder);
    await expect(api.createRealm({ name: "X", slug: "ok-slug" })).rejects.toMatchObject({
      cause: { code: "FORBIDDEN" },
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("atlas.studio.applyStatus", () => {
  const withRealm = (user: typeof admin, row: Record<string, unknown>) => {
    const ctx = caller(user);
    ctx.db.realm.rows.push({ settings: {}, ...row });
    return ctx;
  };

  it("answers for Ixnay, which the founder's worldStatus refuses, and is never locked by its claims", async () => {
    const { api, db } = withRealm(admin, { id: "default", slug: "ixnay", status: "active" });
    db.realmClaim.rows.push(
      { id: "q1", realmId: "default", status: "pending" },
      { id: "q2", realmId: "default", status: "approved" }
    );
    await expect(api.applyStatus({ realm: "ixnay" })).resolves.toEqual({
      realmId: "default",
      status: "active",
      pendingClaims: 1,
      approvedClaims: 1,
      locked: false,
      lockReason: null,
      canReviewClaims: true,
      reliefFailed: false,
    });
  });

  it("locks another realm on claims unless the apply is a layer choice, and always on an archived one", async () => {
    const { api, db } = withRealm(admin, { id: "r1", slug: "eurth", status: "active" });
    db.realmClaim.rows.push({ id: "q1", realmId: "r1", status: "approved" });
    expect(await api.applyStatus({ realm: "eurth" })).toMatchObject({
      locked: true,
      lockReason: "claims",
    });
    expect(await api.applyStatus({ realm: "r1", layers: true })).toMatchObject({
      locked: false,
      approvedClaims: 1,
    });
    db.realm.rows[0].status = "archived";
    expect(await api.applyStatus({ realm: "r1", layers: true })).toMatchObject({
      locked: true,
      lockReason: "archived",
    });
  });

  it("reports a failed relief step, a missing realm, and refuses everyone but site admins", async () => {
    const { api, db } = withRealm(admin, { id: "r1", slug: "eurth", status: "active" });
    db.mapImportJob.rows.push({
      id: "j1",
      realmId: "r1",
      kind: "world",
      dryRun: false,
      status: "succeeded",
      result: { relief: { status: "failed" } },
      createdAt: new Date(),
    });
    expect(await api.applyStatus({ realm: "r1" })).toMatchObject({ reliefFailed: true });
    await expect(api.applyStatus({ realm: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller(founder).api.applyStatus({ realm: "r1" })).rejects.toMatchObject({
      cause: { code: "FORBIDDEN" },
    });
  });
});
