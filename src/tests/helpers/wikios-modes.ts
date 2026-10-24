/**
 * Runs a suite in both WikiOS modes: `v1` (WIKIOS_V1_ENABLED on) and `editing-switch` (the admin editing switch on,
 * v1 off). Every WikiOS data-safety suite should cover both, since the sync paths differ between them.
 *
 * Both modes also have the protections marker (the rights import has run), without which WikiOS takes no write.
 *
 * `describeEachWikiosMode` reads the switch row through the mocked `~/server/db` (`db.systemConfig.findUnique`), so the
 * suite must mock that module; suites with an in-memory table use `seedWikiosMode` instead.
 */
import { db } from "~/server/db";
import {
  __resetWikiosEditingCacheForTests,
  WIKIOS_EDITING_KEY,
} from "~/lib/wiki-os/editing-switch";
import { WIKIOS_PROTECTIONS_MARKER_KEY } from "~/lib/wiki-os/v1-switch";

export type WikiosMode = "v1" | "editing-switch";
export const WIKIOS_MODES: readonly WikiosMode[] = ["v1", "editing-switch"];

/** The marker row's value, as the rights import writes it. */
const MARKER_VALUE = JSON.stringify({ at: "2026-10-24T00:00:00.000Z", restrictions: 0 });

/** The rows a mode holds: the marker always, the switch row in the editing-switch mode. */
function modeRows(mode: WikiosMode): Map<string, string> {
  const rows = new Map([[WIKIOS_PROTECTIONS_MARKER_KEY, MARKER_VALUE]]);
  if (mode === "editing-switch") rows.set(WIKIOS_EDITING_KEY, "true");
  return rows;
}

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
  const rows = modeRows(mode);
  systemConfig.findUnique.mockImplementation(async (args: { where: { key: string } }) => {
    const value = rows.get(args.where.key);
    return value === undefined ? null : { value };
  });
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

/** Same as `applyWikiosMode` for an in-memory table: the switch and the marker are real rows. */
export async function seedWikiosMode(
  database: { systemConfig: { upsert(args: UpsertArgs): Promise<object> } },
  mode: WikiosMode
): Promise<() => void> {
  const restoreEnv = setV1Env(mode);
  for (const [key, value] of modeRows(mode)) {
    await database.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
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
