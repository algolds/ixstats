/**
 * Runs a suite in both WikiOS modes: `v1` (WIKIOS_V1_ENABLED on) and `editing-switch` (the admin editing switch on,
 * v1 off). Every WikiOS data-safety suite should cover both, since the sync paths differ between them.
 *
 * `describeEachWikiosMode` reads the switch row through the mocked `~/server/db` (`db.systemConfig.findUnique`), so the
 * suite must mock that module; suites with an in-memory table use `seedWikiosMode` instead.
 */
import { db } from "~/server/db";
import {
  __resetWikiosEditingCacheForTests,
  WIKIOS_EDITING_KEY,
} from "~/lib/wiki-os/editing-switch";

export type WikiosMode = "v1" | "editing-switch";
export const WIKIOS_MODES: readonly WikiosMode[] = ["v1", "editing-switch"];

function setV1Env(mode: WikiosMode): () => void {
  const previous = process.env.WIKIOS_V1_ENABLED;
  if (mode === "v1") process.env.WIKIOS_V1_ENABLED = "true";
  else delete process.env.WIKIOS_V1_ENABLED;
  return () => {
    if (previous === undefined) delete process.env.WIKIOS_V1_ENABLED;
    else process.env.WIKIOS_V1_ENABLED = previous;
    __resetWikiosEditingCacheForTests();
  };
}

/** Puts the process in `mode` over a mocked `systemConfig`; the returned function undoes it. */
export function applyWikiosMode(
  mode: WikiosMode,
  systemConfig: { findUnique: jest.Mock }
): () => void {
  const restoreEnv = setV1Env(mode);
  systemConfig.findUnique.mockImplementation(async (args: { where: { key: string } }) =>
    mode === "editing-switch" && args.where.key === WIKIOS_EDITING_KEY ? { value: "true" } : null
  );
  __resetWikiosEditingCacheForTests();
  return () => {
    systemConfig.findUnique.mockReset();
    restoreEnv();
  };
}

interface UpsertArgs {
  where: { key: string };
  create: { key: string; value: string };
  update: { value: string };
}

/** Same as `applyWikiosMode` for an in-memory table: the switch is a real row. */
export async function seedWikiosMode(
  database: { systemConfig: { upsert(args: UpsertArgs): Promise<object> } },
  mode: WikiosMode
): Promise<() => void> {
  const restoreEnv = setV1Env(mode);
  if (mode === "editing-switch") {
    await database.systemConfig.upsert({
      where: { key: WIKIOS_EDITING_KEY },
      create: { key: WIKIOS_EDITING_KEY, value: "true" },
      update: { value: "true" },
    });
  }
  __resetWikiosEditingCacheForTests();
  return restoreEnv;
}

/** `describe.each` over both modes, applying the mode before each test and restoring it after. */
export function describeEachWikiosMode(name: string, body: (mode: WikiosMode) => void): void {
  describe.each(WIKIOS_MODES)(`${name} [%s]`, (mode) => {
    let restore: () => void = () => undefined;
    beforeEach(() => {
      restore = applyWikiosMode(mode, {
        findUnique: jest.mocked(db.systemConfig.findUnique) as jest.Mock,
      });
    });
    afterEach(() => restore());
    body(mode);
  });
}
