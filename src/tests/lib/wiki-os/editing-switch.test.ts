/** @jest-environment node */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

import type { SystemConfig } from "@prisma/client";
import {
  __resetWikiosEditingCacheForTests,
  isWikiosEditingEnabled,
  isWikiosEditingForcedByEnv,
  refreshWikiosEditingFlag,
  setWikiosEditingFlag,
  WIKIOS_EDITING_KEY,
} from "~/lib/wiki-os/editing-switch";
import { db } from "~/server/db";

const findUnique = jest.mocked(db.systemConfig.findUnique);
const upsert = jest.mocked(db.systemConfig.upsert);

/** The row the switch reads; only `value` matters to it. */
const configRow = (value: string): SystemConfig => ({
  id: "cfg_wikios_editing",
  key: WIKIOS_EDITING_KEY,
  value,
  description: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

let was: string | undefined;
beforeEach(() => {
  was = process.env.WIKIOS_V1_ENABLED;
  delete process.env.WIKIOS_V1_ENABLED;
  __resetWikiosEditingCacheForTests();
  jest.clearAllMocks();
  findUnique.mockReset().mockResolvedValue(null);
  upsert.mockReset().mockResolvedValue(configRow("false"));
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { key: WIKIOS_EDITING_KEY },
      select: { value: true },
    });
  });

  it("follows the row", async () => {
    findUnique.mockResolvedValue(configRow("true"));
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
    findUnique.mockResolvedValue(configRow("true"));
    await refreshWikiosEditingFlag();
    findUnique.mockResolvedValue(configRow("false"));
    await refreshWikiosEditingFlag();
    expect(isWikiosEditingEnabled()).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);
    jest.setSystemTime(1_000_000 + 15_001);
    await refreshWikiosEditingFlag();
    expect(isWikiosEditingEnabled()).toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("shares one query between concurrent refreshes", async () => {
    findUnique.mockResolvedValue(configRow("true"));
    await Promise.all([
      refreshWikiosEditingFlag(),
      refreshWikiosEditingFlag(),
      refreshWikiosEditingFlag(),
    ]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("keeps the last value when the read fails", async () => {
    findUnique.mockResolvedValueOnce(configRow("true"));
    await refreshWikiosEditingFlag();
    findUnique.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the last value when the read rejects with something other than an Error", async () => {
    findUnique.mockRejectedValueOnce("db down");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(refreshWikiosEditingFlag(true)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("editing switch"), "db down");
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
    findUnique.mockResolvedValue(configRow("true"));
    expect(isWikiosEditingEnabled()).toBe(false);
    await new Promise((r) => setImmediate(r));
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(isWikiosEditingEnabled()).toBe(true);
  });
});
