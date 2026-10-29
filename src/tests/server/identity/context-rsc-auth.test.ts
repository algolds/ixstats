/** @jest-environment node */
/**
 * A server component has no request object to read Clerk's session from, so it hands the context the auth it read itself
 * (`auth()` from Clerk). The context then acts as that player, exactly as it does for a request that carries a session.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    wikiNameClaim: { findFirst: jest.fn().mockResolvedValue(null) },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((work: (tx: object) => Promise<object>): Promise<object> => work(db)),
  };
  return { __esModule: true, db, isDatabaseReadOnly: true };
});
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: jest.fn(() => null),
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));

import { createTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";

beforeEach(() => {
  jest.mocked(db.user.findUnique).mockResolvedValue({
    id: "db_clerk_rsc",
    clerkUserId: "clerk_rsc",
    lastSeenAt: new Date(),
    role: { id: "r", name: "user", level: 100 },
  } as never);
});

it("acts as the player whose auth a server component passes in", async () => {
  const ctx = await createTRPCContext({
    headers: new Headers(),
    sessionAuth: { userId: "clerk_rsc" } as never,
  });

  expect(ctx.auth?.userId).toBe("clerk_rsc");
  expect(ctx.user?.clerkUserId).toBe("clerk_rsc");
});

it("stays anonymous when the server component passes signed-out auth", async () => {
  const ctx = await createTRPCContext({
    headers: new Headers(),
    sessionAuth: { userId: null } as never,
  });

  expect(ctx.auth?.userId).toBeNull();
  expect(ctx.user).toBeNull();
});
