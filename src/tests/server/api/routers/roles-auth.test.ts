import { describe, it, expect, jest } from "@jest/globals";

// Mock env and db
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { rolesRouter } from "~/server/api/routers/roles";

const createCaller = createCallerFactory(rolesRouter);

describe("roles auth boundary", () => {
  it("rejects assignUserRole from an unauthenticated caller", async () => {
    const caller = createCaller({ db: {}, user: null, auth: {} } as any);
    await expect(
      caller.assignUserRole({ clerkUserId: "attacker", roleId: "owner" })
    ).rejects.toThrow();
  });
});
