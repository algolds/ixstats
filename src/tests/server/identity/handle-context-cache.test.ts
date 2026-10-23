/** @jest-environment node */
/**
 * The request context caches a user for 5 seconds. A handle picked from the WikiOS first-save dialog drops that user's
 * cached entry, so the save retried right after it is signed with the new handle instead of being refused.
 * (Read-only mode loads the user with one `findUnique`; the cache in front of it is the same in both modes.)
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    wikiNameClaim: { findFirst: jest.fn().mockResolvedValue(null) },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((work: (tx: object) => Promise<object>) => work(db)),
  };
  return { __esModule: true, db, isDatabaseReadOnly: true };
});
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: (req: { auth?: object } | undefined) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { createCallerFactory, createTRPCContext } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { db } from "~/server/db";

const findUnique = jest.mocked(db.user.findUnique);
const update = jest.mocked(db.user.update);
const createCaller = createCallerFactory(ixnayidCoreRouter);

/** The stored row each test's player starts from, by Clerk id. */
const rows = new Map<string, { handle: string | null }>();

function contextFor(clerkUserId: string) {
  const req = { auth: { userId: clerkUserId } } as NextRequest & { auth: { userId: string } };
  return createTRPCContext({ headers: new Headers(), req });
}

beforeEach(() => {
  findUnique.mockImplementation((async ({
    where,
  }: {
    where: { clerkUserId?: string; id?: string };
  }) => {
    const clerkUserId = where.clerkUserId ?? where.id!.replace(/^db_/, "");
    return {
      id: `db_${clerkUserId}`,
      clerkUserId,
      handle: rows.get(clerkUserId)?.handle ?? null,
      handleChangedAt: null,
      lastSeenAt: new Date(),
      role: { id: "r", name: "user", level: 100 },
    };
  }) as never);
  jest.mocked(db.user.findFirst).mockResolvedValue(null as never);
  update.mockImplementation((async ({
    where,
    data,
  }: {
    where: { id: string };
    data: { handle: string };
  }) => {
    rows.set(where.id.replace(/^db_/, ""), { handle: data.handle });
    return { handle: data.handle };
  }) as never);
});

it("serves a cached player for a few seconds, so a direct change is not seen at once", async () => {
  expect((await contextFor("clerk_a")).user?.handle).toBeNull();
  rows.set("clerk_a", { handle: "alpha" });
  expect((await contextFor("clerk_a")).user?.handle).toBeNull();
});

it("sees a handle picked through setHandle on the very next request", async () => {
  const first = await contextFor("clerk_b");
  expect(first.user?.handle).toBeNull();

  await createCaller(first).setHandle({ handle: "bravo" });

  expect((await contextFor("clerk_b")).user?.handle).toBe("bravo");
});
