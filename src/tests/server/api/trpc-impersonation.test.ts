// Mock Clerk before any imports
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: (req: any) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));
jest.mock("@clerk/nextjs", () => ({
  __esModule: true,
  getAuth: (req: any) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));

// Mock dependencies
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
}));

// Note: `jest` is deliberately NOT imported from "@jest/globals" here — the mock factories above
// call `jest.fn()` inline, and jest.mock() calls are hoisted above imports, so importing `jest`
// under that same name would shadow the ambient global the hoisted factories rely on. Use the
// ambient global `jest` (available automatically in every Jest test file) instead.
import { describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC, TRPCError } from "@trpc/server";
import { createTRPCContext } from "~/server/api/trpc/context";
import { decidePlayAs } from "~/server/api/trpc/impersonation";
import { adminMiddleware } from "~/server/api/trpc/middleware";
import { db } from "~/server/db";
import { UserManagementService } from "~/lib/auth";

describe("TRPC Context Impersonation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("swaps context to target user when requested by an authorized system owner", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "system_owner_id") {
        return { clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } } as any;
      }
      if (where.clerkUserId === "target_user_id") {
        return { clerkUserId: "target_user_id", role: null } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const reqHeaders = new Headers();
    reqHeaders.set("x-clerk-auth-status", "signed-in");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "system_owner_id" },
        headers: reqHeaders,
      } as any,
    });

    expect(ctx.auth?.userId).toBe("target_user_id");
    expect(ctx.user?.clerkUserId).toBe("target_user_id");
    expect(ctx.impersonatorId).toBe("system_owner_id");
    logSpy.mockRestore();
  });

  it("does NOT swap context if the requester is not an admin", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "regular_user_id") {
        return { clerkUserId: "regular_user_id", role: null } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const reqHeaders = new Headers();
    reqHeaders.set("x-clerk-auth-status", "signed-in");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "regular_user_id" },
        headers: reqHeaders,
      } as any,
    });

    expect(ctx.auth?.userId).toBe("regular_user_id");
    expect(ctx.user?.clerkUserId).toBe("regular_user_id");
    expect(ctx.impersonatorId).toBeUndefined();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("does not swap when a staff member requests the system owner (target-is-system-owner)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "staff_id") {
        return { clerkUserId: "staff_id", role: { name: "staff", level: 20 } } as any;
      }
      if (where.clerkUserId === "system_owner_id") {
        return { clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "system_owner_id");
    const reqHeaders = new Headers();

    const ctx = await createTRPCContext({
      headers,
      req: { auth: { userId: "staff_id" }, headers: reqHeaders } as any,
    });

    expect(ctx.auth?.userId).toBe("staff_id");
    expect(ctx.impersonatorId).toBeUndefined();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("denies an admin (level 10) attempting to play as another admin (level 10) or the owner (level 0)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "admin_a_id") {
        return { clerkUserId: "admin_a_id", role: { name: "admin", level: 10 } } as any;
      }
      if (where.clerkUserId === "admin_b_id") {
        return { clerkUserId: "admin_b_id", role: { name: "admin", level: 10 } } as any;
      }
      if (where.clerkUserId === "owner_id") {
        return { clerkUserId: "owner_id", role: { name: "owner", level: 0 } } as any;
      }
      return null;
    }) as any);

    // Requesting another admin at the same level
    const headers1 = new Headers();
    headers1.set("x-play-as-user", "admin_b_id");
    const ctx1 = await createTRPCContext({
      headers: headers1,
      req: { auth: { userId: "admin_a_id" }, headers: new Headers() } as any,
    });
    expect(ctx1.auth?.userId).toBe("admin_a_id");
    expect(ctx1.impersonatorId).toBeUndefined();

    // Requesting the owner (more privileged)
    const headers2 = new Headers();
    headers2.set("x-play-as-user", "owner_id");
    const ctx2 = await createTRPCContext({
      headers: headers2,
      req: { auth: { userId: "admin_a_id" }, headers: new Headers() } as any,
    });
    expect(ctx2.auth?.userId).toBe("admin_a_id");
    expect(ctx2.impersonatorId).toBeUndefined();

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("grants an admin playing as an ordinary user, drops sessionClaims, and sets realUserId", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "admin_a_id") {
        return { clerkUserId: "admin_a_id", role: { name: "admin", level: 10 } } as any;
      }
      if (where.clerkUserId === "user_id") {
        return { clerkUserId: "user_id", role: { name: "user", level: 100 } } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "user_id");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "admin_a_id", sessionClaims: { metadata: { role: "admin" } } },
        headers: new Headers(),
      } as any,
    });

    expect(ctx.auth?.userId).toBe("user_id");
    expect(ctx.auth && "sessionClaims" in ctx.auth).toBe(false);
    expect(ctx.impersonatorId).toBe("admin_a_id");
    expect(ctx.realUserId).toBe("admin_a_id");
    logSpy.mockRestore();
  });

  it("denies play-as when the target does not exist in the database, without constructing UserManagementService", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "admin_a_id") {
        return { clerkUserId: "admin_a_id", role: { name: "admin", level: 10 } } as any;
      }
      return null; // target "ghost_id" does not exist
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "ghost_id");

    const ctx = await createTRPCContext({
      headers,
      req: { auth: { userId: "admin_a_id" }, headers: new Headers() } as any,
    });

    expect(ctx.auth?.userId).toBe("admin_a_id");
    expect(ctx.impersonatorId).toBeUndefined();
    expect(UserManagementService).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe("decidePlayAs (pure function)", () => {
    const isSystemOwnerMock = (id: string) => id === "system_owner_id";

    it("returns none when there is no play-as header", () => {
      expect(
        decidePlayAs({
          realUserId: "u1",
          requestedUserId: null,
          requesterRole: null,
          target: null,
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "none" });
    });

    it("returns none when the header targets the requester's own id", () => {
      expect(
        decidePlayAs({
          realUserId: "u1",
          requestedUserId: "u1",
          requesterRole: null,
          target: null,
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "none" });
    });

    it("denies not-staff requesters", () => {
      expect(
        decidePlayAs({
          realUserId: "u1",
          requestedUserId: "u2",
          requesterRole: { name: "user", level: 100 },
          target: { clerkUserId: "u2", role: { level: 100 } },
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "denied", reason: "not-staff" });
    });

    it("denies targeting the system owner", () => {
      expect(
        decidePlayAs({
          realUserId: "admin_id",
          requestedUserId: "system_owner_id",
          requesterRole: { name: "admin", level: 10 },
          target: { clerkUserId: "system_owner_id", role: { level: 0 } },
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "denied", reason: "target-is-system-owner" });
    });

    it("denies a target that does not exist", () => {
      expect(
        decidePlayAs({
          realUserId: "admin_id",
          requestedUserId: "ghost_id",
          requesterRole: { name: "admin", level: 10 },
          target: null,
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "denied", reason: "target-not-found" });
    });

    it("denies a target that outranks (or equals) the requester", () => {
      expect(
        decidePlayAs({
          realUserId: "admin_id",
          requestedUserId: "admin_b_id",
          requesterRole: { name: "admin", level: 10 },
          target: { clerkUserId: "admin_b_id", role: { level: 10 } },
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "denied", reason: "target-outranks" });
    });

    it("grants when the target is strictly lower-privileged", () => {
      expect(
        decidePlayAs({
          realUserId: "admin_id",
          requestedUserId: "user_id",
          requesterRole: { name: "admin", level: 10 },
          target: { clerkUserId: "user_id", role: { level: 100 } },
          isSystemOwner: isSystemOwnerMock,
        })
      ).toEqual({ kind: "granted", targetUserId: "user_id" });
    });
  });

  describe("adminMiddleware + impersonation", () => {
    it("rejects with a FORBIDDEN-class error while playing as another user", async () => {
      const t = initTRPC.context<any>().create();
      const router = t.router({
        adminOnly: t.procedure.use(adminMiddleware).query(() => "ok"),
      });
      const createCaller = t.createCallerFactory(router);
      const caller = createCaller({
        auth: { userId: "target_user_id" },
        user: { id: "db1", clerkUserId: "target_user_id", role: { name: "admin", level: 10 } },
        impersonatorId: "admin_a_id",
      } as any);

      // adminMiddleware throws a ForbiddenError (~/lib/app-error), which the tRPC caller wraps
      // as TRPCError{code: INTERNAL_SERVER_ERROR, cause: ForbiddenError{code: "FORBIDDEN"}}.
      await expect(caller.adminOnly()).rejects.toBeInstanceOf(TRPCError);
      await expect(caller.adminOnly()).rejects.toMatchObject({
        cause: { code: "FORBIDDEN" },
      });
    });

    it("resolves normally for an admin who is not impersonating anyone", async () => {
      const t = initTRPC.context<any>().create();
      const router = t.router({
        adminOnly: t.procedure.use(adminMiddleware).query(() => "ok"),
      });
      const createCaller = t.createCallerFactory(router);
      const caller = createCaller({
        auth: { userId: "admin_a_id" },
        user: { id: "db1", clerkUserId: "admin_a_id", role: { name: "admin", level: 10 } },
      } as any);

      await expect(caller.adminOnly()).resolves.toBe("ok");
    });
  });
});
