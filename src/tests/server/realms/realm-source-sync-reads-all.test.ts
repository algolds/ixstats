/** @jest-environment node */
/**
 * The source sync's plan reads past the guarded client's 1000-row cap: Eurth has 2,750 realm pages, and a plan
 * built from the first 1000 would create nations for pages it never saw or miss the ones it did.
 * The fake answers at most 1000 rows to a findMany with no `take`, as src/server/db.ts does.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { DEFAULT_SYNC_OPTIONS } from "~/lib/realms/sources/config";
import { buildSyncPlan, type SourceSyncConfig } from "~/server/modules/realms/realms.source-sync";

const GUARD_CAP = 1000;

/** A table whose findMany answers at most GUARD_CAP rows when no take is given. */
function cappedTable(rows: Array<Record<string, unknown>>) {
  return {
    findMany: jest.fn(async ({ take }: { take?: number } = {}) => rows.slice(0, take ?? GUARD_CAP)),
  };
}

const config: SourceSyncConfig = {
  realmId: "eurth-id",
  enabled: true,
  provider: "github",
  repo: "x/y",
  ref: "main",
  format: "eurth-map",
  settings: {},
  intervalHours: 24,
  options: DEFAULT_SYNC_OPTIONS,
  continentMap: {},
  overrides: { nations: {}, organizations: {} },
};

describe("buildSyncPlan reads every row", () => {
  it("plans a nation for each of 1,500 realm pages, not the first 1000", async () => {
    const pages = Array.from({ length: 1500 }, (_, i) => ({
      title: `Page${String.fromCharCode(97 + (i % 26))}${i}x${i * 7}`,
      kind: "nation",
      wikiSource: "iiwiki",
    }));
    const db = {
      country: cappedTable([]),
      realmPage: cappedTable(pages),
      mapLayer: cappedTable([]),
      alliance: cappedTable([]),
    };
    const { plan } = await buildSyncPlan(db as never, config, {
      nations: [],
      organizations: [],
      features: [],
      warnings: [],
    });
    expect(plan.creates).toHaveLength(1500);
  });
});
