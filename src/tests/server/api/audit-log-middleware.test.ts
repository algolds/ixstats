/**
 * PL-1: the admin audit log persists. tRPC v11 `next()` resolves `{ ok: false }` rather than
 * throwing, so the middleware must read the result; every admin mutation and every failed admin
 * call is written to AuditLog, with the IP taken from trusted headers only.
 */
import { describe, it, expect, jest } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const router = createTRPCRouter({
  saveThing: adminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => ({ saved: input.name })),
  failThing: adminProcedure.mutation(() => {
    throw new TRPCError({ code: "BAD_REQUEST", message: "nope" });
  }),
  readThing: adminProcedure.query(() => "ok"),
  failRead: adminProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "missing" });
  }),
});

const createCaller = createCallerFactory(router);

function adminCaller(headers?: Headers) {
  const db = createMockDb();
  const caller = createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db,
      headers,
    }) as never
  );
  return { caller, create: db.auditLog.create as jest.Mock };
}

describe("auditLogMiddleware (adminProcedure)", () => {
  it("writes an AuditLog row for a successful admin mutation", async () => {
    const { caller, create } = adminCaller();

    await expect(caller.saveThing({ name: "x" })).resolves.toEqual({ saved: "x" });

    expect(create).toHaveBeenCalledTimes(1);
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ userId: "admin_1", action: "saveThing", success: true });
    expect(data.error).toBeNull();
  });

  it("records success=false with the error message when an admin mutation fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { caller, create } = adminCaller();

    await expect(caller.failThing()).rejects.toThrow("nope");

    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0]![0] as { data: unknown }).data).toMatchObject({
      action: "failThing",
      success: false,
      error: "nope",
    });
    errorSpy.mockRestore();
  });

  it("records a failed admin query", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { caller, create } = adminCaller();

    await expect(caller.failRead()).rejects.toThrow("missing");

    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0]![0] as { data: unknown }).data).toMatchObject({
      action: "failRead",
      success: false,
    });
    errorSpy.mockRestore();
  });

  it("does not write a row for a successful admin read", async () => {
    const { caller, create } = adminCaller();

    await expect(caller.readThing()).resolves.toBe("ok");

    expect(create).not.toHaveBeenCalled();
  });

  it("takes the IP from cf-connecting-ip, never x-forwarded-for", async () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "6.6.6.6");
    headers.set("cf-connecting-ip", "203.0.113.9");
    const { caller, create } = adminCaller(headers);

    await caller.saveThing({ name: "x" });

    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.ipAddress).toBe("203.0.113.9");
    expect(String(data.details)).not.toContain("6.6.6.6");
  });
});
