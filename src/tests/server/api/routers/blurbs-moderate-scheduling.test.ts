/** @jest-environment node */
/**
 * SL-23: nothing acts on a blurb prompt's scheduledFor / closedAt / isRecurring, so the admin
 * prompt mutations no longer accept or write them (prompts open and close by status only).
 */
jest.mock("~/server/db", () => ({
  db: {
    blurbPrompt: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "p1", ...data })),
      update: jest.fn(async ({ data }: { data: object }) => ({ id: "p1", ...data })),
      findUnique: jest.fn(async () => ({ publishedAt: null })),
    },
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { blurbsModerateRouter } from "~/server/api/routers/blurbs/moderate";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const blurbPrompt = (db as unknown as { blurbPrompt: Record<string, jest.Mock> }).blurbPrompt;

function adminCaller() {
  return createCallerFactory(blurbsModerateRouter)(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
      db: createMockPrisma(),
    }) as never
  );
}

const SCHEDULING = ["scheduledFor", "closedAt", "isRecurring"];

describe("blurbs prompt scheduling fields", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createPrompt ignores scheduling input and writes no scheduling columns", async () => {
    await adminCaller().createPrompt({
      title: "Food",
      question: "What do you eat?",
      slug: "food",
      scheduledFor: "2026-12-01T00:00:00.000Z",
      closedAt: "2026-12-08T00:00:00.000Z",
      isRecurring: true,
    } as never);
    const data = blurbPrompt.create.mock.calls[0]![0].data;
    expect(Object.keys(data)).toEqual(expect.not.arrayContaining(SCHEDULING));
    expect(data).toMatchObject({ slug: "food", status: "DRAFT", createdBy: "db_admin" });
  });

  it("updatePrompt ignores scheduling input", async () => {
    await adminCaller().updatePrompt({
      id: "p1",
      status: "ACTIVE",
      closedAt: "2026-12-08T00:00:00.000Z",
      isRecurring: true,
    } as never);
    const data = blurbPrompt.update.mock.calls[0]![0].data;
    expect(Object.keys(data)).toEqual(expect.not.arrayContaining(SCHEDULING));
    expect(data).toMatchObject({ status: "ACTIVE", publishedAt: expect.any(Date) });
  });
});
