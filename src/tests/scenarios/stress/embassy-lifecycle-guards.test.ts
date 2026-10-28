/** @jest-environment node */
/**
 * Stress findings C-17..C-20 on embassies: a blank or oversized name is refused; a concurrent double submit is a
 * CONFLICT (it was a raw unique violation, HTTP 500); two concurrent closes apply the closing penalties once (both
 * applied, and a closed embassy could be "closed" again for another event and notice); and the owner of a nation
 * they do not currently act as can close, reopen and sever its embassies, as they can establish them.
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
import { diplomaticEmbassiesRouter } from "~/server/api/routers/diplomacy/embassies";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
const embassies = createCallerFactory(diplomaticEmbassiesRouter);
let db: MemoryPrisma;
let caller: ReturnType<typeof embassies>;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  for (const id of ["home", "second", "host"]) {
    await addNation(db as never, { id, baselineDate: new Date(NOW - 365 * 86_400_000) });
  }
  // Lena acts as "home" and also owns "second"
  const lena = await addOwner(db as never, "lena", "home");
  await db.country.update({ where: { id: "second" }, data: { ownerUserId: lena.id } });
  caller = embassies(asOwner(db as never, lena));
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const open = (guestCountryId: string, name = "Embassy") =>
  caller.establishEmbassy({ hostCountryId: "host", guestCountryId, name });

it("refuses a blank or oversized embassy name", async () => {
  await expect(open("home", "   ")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(open("home", "x".repeat(121))).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("answers a double submit that loses the race to the unique as a CONFLICT", async () => {
  await open("home");
  // The second submit's existence check ran before the first one's row landed
  jest.spyOn(db.embassy, "findUnique").mockResolvedValueOnce(null as never);
  await expect(open("home")).rejects.toMatchObject({ code: "CONFLICT" });
});

it("closes once under concurrent closes, and refuses to close a closed embassy", async () => {
  const { id } = await open("home");
  const closes = await Promise.allSettled([1, 2].map(() => caller.closeEmbassy({ embassyId: id })));
  expect(closes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.diplomaticEvent.count({ where: { eventType: "embassy_closed" } })).toBe(1);
  const relation = await db.diplomaticRelation.findFirst({});
  expect(relation?.strength).toBe(55 - 15);
  await expect(caller.closeEmbassy({ embassyId: id })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("lets the owner close, reopen and sever an embassy of a nation they do not act as", async () => {
  const { id } = await open("second");
  await expect(caller.closeEmbassy({ embassyId: id })).resolves.toMatchObject({ success: true });
  await expect(caller.reopenEmbassy({ embassyId: id })).resolves.toMatchObject({ success: true });
  await expect(caller.deleteEmbassy({ embassyId: id })).resolves.toMatchObject({ success: true });
  expect(await db.embassy.count()).toBe(0);
});
