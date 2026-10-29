/** @jest-environment node */
/**
 * Stress findings C-08/C-09: an unknown nation is NOT_FOUND on the MyCountry dashboard reads (they answered HTTP 500),
 * and another nation's embassy profile is FORBIDDEN to edit (a plain Error answered HTTP 500).
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { IxTime } from "~/lib/ixtime";
import { createCallerFactory } from "~/server/api/trpc";
import { myCountryRouter } from "~/server/api/routers/mycountry";
import { diplomaticEmbassiesRouter } from "~/server/api/routers/diplomacy/embassies";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", baselineDate: new Date(NOW - 365 * 86_400_000) });
  await addNation(db as never, { id: "otherland", baselineDate: new Date(NOW - 365 * 86_400_000) });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("answers an unknown nation as NOT_FOUND on the dashboard reads", async () => {
  const owner = createCallerFactory(myCountryRouter)(
    asOwner(db as never, await addOwner(db as never, "lena", "testland"))
  );
  await expect(owner.getCountryDashboard({ countryId: "nowhere" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(owner.getNationalSummary({ countryId: "nowhere" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});

it("refuses another nation's embassy profile as FORBIDDEN", async () => {
  await db.embassy.create({
    data: {
      id: "emb",
      hostCountryId: "testland",
      guestCountryId: "otherland",
      name: "Otherland in Testland",
    },
  });
  const owner = createCallerFactory(diplomaticEmbassiesRouter)(
    asOwner(db as never, await addOwner(db as never, "lena", "testland"))
  );
  await expect(
    owner.updateEmbassyProfile({ embassyId: "emb", description: "mine now" })
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
