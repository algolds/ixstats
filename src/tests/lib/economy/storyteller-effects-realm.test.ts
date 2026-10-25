/** @jest-environment node */
/**
 * Realm time design §2: a StorytellerEffect starts on its country's realm clock. A draft without a time is stamped
 * with its country's realm now (Ixnay's IxTime, a paused realm's frozen time, a 6× realm's time years ahead); a time
 * the caller passes is kept; a level sync with no time stamps each country's delta with its own realm's now.
 */
import { IxTime } from "~/lib/ixtime";
import {
  createStorytellerEffect,
  createStorytellerEffects,
  syncLevelEffects,
} from "~/lib/economy/storyteller-effects";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addRealm } from "~/tests/helpers/nation-world";

const YEAR = 365.25 * 86_400_000;
const IXNAY_NOW = Date.UTC(2043, 0, 15);
const FROZEN_NOW = IXNAY_NOW - YEAR;
const FAST_NOW = IXNAY_NOW + 3 * YEAR;

let db: MemoryPrisma;

beforeEach(async () => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(IXNAY_NOW);
  resetRealmClockCache();
  db = createMemoryPrisma();
  await addIxnay(db as never);
  await addRealm(db as never, "frozen", { nowMs: FROZEN_NOW, multiplier: 0 });
  await addRealm(db as never, "fast", { nowMs: FAST_NOW, multiplier: 6 });
  const baselineDate = new Date(FROZEN_NOW - YEAR);
  await addNation(db as never, { id: "ixland", baselineDate });
  await addNation(db as never, { id: "frostland", baselineDate, realmId: "frozen" });
  await addNation(db as never, { id: "swiftland", baselineDate, realmId: "fast" });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});

const startOf = async (countryId: string) =>
  (await db.storytellerEffect.findFirstOrThrow({ where: { countryId } })).ixTimeTimestamp.getTime();

const draft = (countryId: string) => ({
  countryId,
  inputType: "gdp_level_adjustment",
  value: 0.01,
  duration: 1,
  createdBy: "test:key",
});

it("stamps each country's effect with its realm's now", async () => {
  expect(
    await createStorytellerEffects(db as never, ["ixland", "frostland", "swiftland"].map(draft))
  ).toBe(3);
  expect(await startOf("ixland")).toBe(IXNAY_NOW);
  expect(await startOf("frostland")).toBe(FROZEN_NOW);
  expect(await startOf("swiftland")).toBeGreaterThanOrEqual(FAST_NOW);
  expect((await startOf("swiftland")) - FAST_NOW).toBeLessThan(60_000);
});

it("keeps the time the caller passes", async () => {
  await createStorytellerEffect(db as never, { ...draft("swiftland"), ixTime: FAST_NOW - YEAR });
  expect(await startOf("swiftland")).toBe(FAST_NOW - YEAR);
});

it("a level sync stamps each country's delta with its own realm's now", async () => {
  await syncLevelEffects(
    db as never,
    { createdBy: "test:key" },
    ["frostland", "ixland"].map((countryId) => ({ ...draft(countryId), description: "Level" }))
  );
  expect(await startOf("frostland")).toBe(FROZEN_NOW);
  expect(await startOf("ixland")).toBe(IXNAY_NOW);
});
