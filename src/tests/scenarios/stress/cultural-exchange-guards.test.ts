/** @jest-environment node */
/**
 * Stress findings C-22..C-24 on cultural exchanges: a blank title, an unparseable date (HTTP 500) and an end before the
 * start were accepted; a javascript: artifact link was stored (it renders as a link and image); a cancelled exchange
 * could still be edited, and two concurrent cancels both applied the penalties.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn(async () => null),
}));

import { IxTime } from "~/lib/ixtime";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticCulturalRouter } from "~/server/api/routers/diplomacy/cultural";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;
let caller: ReturnType<ReturnType<typeof createCallerFactory<typeof diplomaticCulturalRouter>>>;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, {
    id: "home",
    name: "Home",
    baselineDate: new Date(NOW - 365 * 86_400_000),
  });
  caller = createCallerFactory(diplomaticCulturalRouter)(
    asOwner(db as never, await addOwner(db as never, "lena", "home"))
  );
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const create = (over: Record<string, string> = {}) =>
  caller.createCulturalExchange({
    title: "Home Fest",
    type: "festival",
    description: "A festival",
    hostCountryId: "home",
    hostCountryName: "Home",
    startDate: "2043-02-01",
    endDate: "2043-03-01",
    autoCreateMissions: false,
    ...over,
  });

it("refuses a blank title, an unparseable date and an end before the start", async () => {
  await expect(create({ title: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(create({ startDate: "not a date" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(create({ startDate: "2043-03-01", endDate: "2043-02-01" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("refuses a javascript: artifact link", async () => {
  const { id } = await create();
  await expect(
    caller.uploadCulturalArtifact({
      exchangeId: id,
      type: "photo",
      title: "pic",
      fileUrl: "javascript:alert(1)",
      contributor: "Lena",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("cancels once under concurrent cancels and refuses to edit a cancelled exchange", async () => {
  const { id } = await create();
  const results = await Promise.allSettled(
    [1, 2].map(() => caller.cancelCulturalExchange({ exchangeId: id }))
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    caller.updateCulturalExchange({ exchangeId: id, title: "Renamed", description: "After" })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
