/** @jest-environment node */
const findUnique = jest.fn();
const upsert = jest.fn();
// Imports are hoisted above the consts, so the factory forwards lazily instead of reading them at mock time.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

import {
  __resetWikiosEditingCacheForTests,
  isWikiosEditingEnabled,
  isWikiosEditingForcedByEnv,
  refreshWikiosEditingFlag,
  setWikiosEditingFlag,
  WIKIOS_EDITING_KEY,
} from "~/lib/wiki-os/editing-switch";

let was: string | undefined;
beforeEach(() => {
  was = process.env.WIKIOS_V1_ENABLED;
  delete process.env.WIKIOS_V1_ENABLED;
  __resetWikiosEditingCacheForTests();
  jest.clearAllMocks();
  findUnique.mockReset().mockResolvedValue(null);
  upsert.mockReset().mockResolvedValue(undefined);
  jest.useRealTimers();
});
afterEach(() => {
  if (was === undefined) delete process.env.WIKIOS_V1_ENABLED;
  else process.env.WIKIOS_V1_ENABLED = was;
});

describe("editing switch", () => {
  it("is off before any load and when no row exists", async () => {
    expect(isWikiosEditingEnabled()).toBe(false);
    findUnique.mockResolvedValue(null);
    await expect(refreshWikiosEditingFlag()).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledWith({ where: { key: WIKIOS_EDITING_KEY }, select: { value: true } });
  });

  it("follows the row", async () => {
    findUnique.mockResolvedValue({ value: "true" });
    await refreshWikiosEditingFlag();
    expect(isWikiosEditingEnabled()).toBe(true);
  });

  it("is forced on by WIKIOS_V1_ENABLED", () => {
    process.env.WIKIOS_V1_ENABLED = "true";
    expect(isWikiosEditingForcedByEnv()).toBe(true);
    expect(isWikiosEditingEnabled()).toBe(true);
  });

  it("serves the cached value for 15 s, then reads again", async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    findUnique.mockResolvedValue({ value: "true" });
    await refreshWikiosEditingFlag();
    findUnique.mockResolvedValue({ value: "false" });
    await refreshWikiosEditingFlag();
    expect(isWikiosEditingEnabled()).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);
    jest.setSystemTime(1_000_000 + 15_001);
    await refreshWikiosEditingFlag();
    expect(isWikiosEditingEnabled()).toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("shares one query between concurrent refreshes", async () => {
    findUnique.mockResolvedValue({ value: "true" });
    await Promise.all([refreshWikiosEditingFlag(), refreshWikiosEditingFlag(), refreshWikiosEditingFlag()]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("keeps the last value when the read fails", async () => {
    findUnique.mockResolvedValueOnce({ value: "true" });
    await refreshWikiosEditingFlag();
    findUnique.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("set writes the row and updates this process at once", async () => {
    await setWikiosEditingFlag(true);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: WIKIOS_EDITING_KEY },
      create: expect.objectContaining({ key: WIKIOS_EDITING_KEY, value: "true" }),
      update: { value: "true" },
    });
    expect(isWikiosEditingEnabled()).toBe(true);
  });

  it("a stale synchronous read starts a background refresh", async () => {
    findUnique.mockResolvedValue({ value: "true" });
    expect(isWikiosEditingEnabled()).toBe(false);
    await new Promise((r) => setImmediate(r));
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(isWikiosEditingEnabled()).toBe(true);
  });
});
