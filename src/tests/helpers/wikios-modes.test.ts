/** @jest-environment node */
/**
 * The both-modes harness: in each WikiOS mode editing is on (the protections marker included), v1 is on only in the v1
 * mode, and the restore puts WIKIOS_V1_ENABLED back as it was.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

import { db } from "~/server/db";
import {
  isWikiosEditingEnabled,
  refreshWikiosEditingFlag,
  wikiosProtectionsImported,
} from "~/lib/wiki-os/editing-switch";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import {
  applyWikiosMode,
  describeEachWikiosMode,
  seedWikiosMode,
  WIKIOS_MODES,
  type WikiosMode,
} from "./wikios-modes";

const systemConfig = {
  findUnique: jest.mocked(db.systemConfig.findUnique) as jest.Mock,
  upsert: jest.mocked(db.systemConfig.upsert) as jest.Mock,
};

describe("applyWikiosMode", () => {
  const original = process.env.WIKIOS_V1_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.WIKIOS_V1_ENABLED;
    else process.env.WIKIOS_V1_ENABLED = original;
  });

  it.each(WIKIOS_MODES)("%s: editing on, v1 only in the v1 mode", async (mode: WikiosMode) => {
    const restore = applyWikiosMode(mode, systemConfig);
    await refreshWikiosEditingFlag(true);
    expect(isWikiosEditingEnabled()).toBe(true);
    expect(isWikiosV1Enabled()).toBe(mode === "v1");
    expect(wikiosProtectionsImported()).toBe(true);
    restore();
  });

  it.each(WIKIOS_MODES)(
    "%s: restore puts WIKIOS_V1_ENABLED back when it was set",
    (mode: WikiosMode) => {
      process.env.WIKIOS_V1_ENABLED = "false";
      applyWikiosMode(mode, systemConfig)();
      expect(process.env.WIKIOS_V1_ENABLED).toBe("false");
    }
  );

  it.each(WIKIOS_MODES)(
    "%s: restore puts WIKIOS_V1_ENABLED back when it was unset",
    (mode: WikiosMode) => {
      delete process.env.WIKIOS_V1_ENABLED;
      applyWikiosMode(mode, systemConfig)();
      expect(process.env.WIKIOS_V1_ENABLED).toBeUndefined();
    }
  );

  it("restore drops the editing switch cache", async () => {
    const restore = applyWikiosMode("editing-switch", systemConfig);
    await refreshWikiosEditingFlag(true);
    restore();
    systemConfig.findUnique.mockResolvedValue(null);
    delete process.env.WIKIOS_V1_ENABLED;
    await refreshWikiosEditingFlag(true);
    expect(isWikiosEditingEnabled()).toBe(false);
  });
});

describe("seedWikiosMode", () => {
  const original = process.env.WIKIOS_V1_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.WIKIOS_V1_ENABLED;
    else process.env.WIKIOS_V1_ENABLED = original;
  });

  it.each(WIKIOS_MODES)("%s: seeds the switch row and restores", async (mode: WikiosMode) => {
    const upsert = jest.fn().mockResolvedValue({});
    const restore = await seedWikiosMode({ systemConfig: { upsert } }, mode);
    expect(isWikiosV1Enabled()).toBe(mode === "v1");
    // the protections marker in both modes, the switch row only in the editing-switch mode
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "wikios_protections_imported_at" } })
    );
    const switchRow = {
      where: { key: "wikios_editing_enabled" },
      create: { key: "wikios_editing_enabled", value: "true" },
      update: { value: "true" },
    };
    if (mode === "editing-switch") expect(upsert).toHaveBeenCalledWith(switchRow);
    else expect(upsert).not.toHaveBeenCalledWith(switchRow);
    restore();
    expect(process.env.WIKIOS_V1_ENABLED).toBe(original);
  });
});

describeEachWikiosMode("describeEachWikiosMode", (mode) => {
  it("applies the mode before each test", async () => {
    await refreshWikiosEditingFlag(true);
    expect(isWikiosEditingEnabled()).toBe(true);
    expect(isWikiosV1Enabled()).toBe(mode === "v1");
  });
});
