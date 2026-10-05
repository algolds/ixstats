/** @jest-environment node */
/**
 * intelligence router (templates): active templates are public to read; creating, editing and
 * retiring them is admin only, validates the findings JSON and writes an audit row.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intelligenceRouter } from "~/server/api/routers/intelligence";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(intelligenceRouter);

function callerAs(db: MockPrismaProxy, who: "admin" | "player" | null) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: who ? { userId: `clerk_${who}` } : null,
      user: who
        ? {
            id: who,
            clerkUserId: `clerk_${who}`,
            role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
          }
        : null,
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

const template = {
  reportType: "economic" as const,
  classification: "PUBLIC" as const,
  summaryTemplate: "{country} grows",
  findingsTemplate: '["GDP up"]',
  minimumLevel: 2,
  confidenceBase: 60,
};

let db: MockPrismaProxy;

beforeEach(() => {
  db = createMockPrisma();
  db.intelligenceTemplate.create.mockImplementation(async ({ data }: any) => ({
    id: "t1",
    ...data,
  }));
  db.intelligenceTemplate.update.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    reportType: "economic",
    ...data,
  }));
});

it("lists active templates publicly", async () => {
  await callerAs(db, null).getAllTemplates();
  expect(db.intelligenceTemplate.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { isActive: true } })
  );
});

describe("admin writes", () => {
  it("refuses players", async () => {
    const player = callerAs(db, "player");
    await expect(player.createTemplate(template)).rejects.toThrow(/Admin privileges required/);
    await expect(player.updateTemplate({ id: "t1", minimumLevel: 3 })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(player.deleteTemplate({ id: "t1" })).rejects.toThrow(/Admin privileges required/);
    expect(db.intelligenceTemplate.create).not.toHaveBeenCalled();
    expect(db.intelligenceTemplate.update).not.toHaveBeenCalled();
  });

  it("creates an active template and audits it", async () => {
    const { template: created } = await callerAs(db, "admin").createTemplate(template);

    expect(created).toMatchObject({ id: "t1", isActive: true, minimumLevel: 2 });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "INTELLIGENCE_TEMPLATE_CREATED",
        target: "t1",
        userId: "clerk_admin",
      }),
    });
  });

  it("rejects findings that are not a JSON array", async () => {
    const admin = callerAs(db, "admin");
    await expect(
      admin.createTemplate({ ...template, findingsTemplate: '{"a":1}' })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Invalid findings template format" });
    await expect(
      admin.updateTemplate({ id: "t1", findingsTemplate: "not json" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.intelligenceTemplate.create).not.toHaveBeenCalled();
    expect(db.intelligenceTemplate.update).not.toHaveBeenCalled();
  });

  it("validates level and confidence ranges", async () => {
    await expect(
      callerAs(db, "admin").createTemplate({ ...template, minimumLevel: 6 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerAs(db, "admin").createTemplate({ ...template, confidenceBase: 101 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("retires a template instead of deleting it", async () => {
    await callerAs(db, "admin").deleteTemplate({ id: "t1" });
    expect(db.intelligenceTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isActive: false },
    });
    expect(db.intelligenceTemplate.delete).not.toHaveBeenCalled();
  });

  it("still succeeds when the audit write fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    db.auditLog.create.mockRejectedValue(new Error("audit down"));
    await expect(
      callerAs(db, "admin").updateTemplate({ id: "t1", minimumLevel: 4 })
    ).resolves.toMatchObject({ success: true });
    errorSpy.mockRestore();
  });
});
