/**
 * @jest-environment node
 *
 * The map pipeline's `relief` step: it plans the realm's relief from its stored altitude bands, reports what an
 * apply would change on a dry run (writing nothing), builds on an apply, and skips a realm with no bands.
 */
jest.mock("~/server/modules/maps/realm-relief", () => ({
  planRealmRelief: jest.fn(),
  applyRealmRelief: jest.fn(),
}));

import type { PrismaClient } from "@prisma/client";
import { realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import { runReliefStep } from "~/server/modules/maps/realm-map-pipeline.relief";
import type { StepContext } from "~/server/modules/maps/realm-map-pipeline.context";
import {
  applyRealmRelief,
  planRealmRelief,
  type ReliefPlan,
} from "~/server/modules/maps/realm-relief";

const plan = (over: Partial<ReliefPlan> = {}): ReliefPlan => ({
  entry: {
    id: "relief",
    label: "Relief",
    kind: "overlay",
    version: "0123456789abcdef",
    maxZoom: 5,
    order: 10,
  },
  image: new Uint8Array(),
  built: false,
  changed: true,
  previous: undefined,
  ...over,
});

const db = {} as PrismaClient;

function context(dryRun: boolean): StepContext {
  return {
    db,
    realm: { id: "r1", slug: "ixnay", name: "Ixnay" },
    pipeline: realmMapPipelineSchema.parse({}),
    dryRun,
    art: async () => ({ bytes: new Uint8Array(), sha256: "" }),
    requestedBy: "script:test",
    actor: { id: "script:test", clerkUserId: "script:test", role: { name: "system", level: 0 } },
    jobId: null,
    progress: jest.fn(),
    isCancelled: () => false,
    deps: {},
  };
}

beforeEach(() => jest.clearAllMocks());

describe("runReliefStep", () => {
  it("reads the realm's stored bands", async () => {
    jest.mocked(planRealmRelief).mockResolvedValue(null);
    await runReliefStep(context(true));
    expect(planRealmRelief).toHaveBeenCalledWith(db, "r1", { bands: true });
  });

  it("skips a realm with no altitude bands", async () => {
    jest.mocked(planRealmRelief).mockResolvedValue(null);
    expect(await runReliefStep(context(false))).toMatchObject({ status: "skipped" });
    expect(applyRealmRelief).not.toHaveBeenCalled();
  });

  it("reports unchanged when the tiles are built and the entry is recorded", async () => {
    jest.mocked(planRealmRelief).mockResolvedValue(plan({ built: true, changed: false }));
    const report = await runReliefStep(context(false));
    expect(report).toMatchObject({ status: "unchanged" });
    expect(report.summary).toContain("0123456789abcdef");
    expect(applyRealmRelief).not.toHaveBeenCalled();
  });

  it("only reports on a dry run: tiles to build, or just the entry to record", async () => {
    jest.mocked(planRealmRelief).mockResolvedValue(plan());
    const build = await runReliefStep(context(true));
    expect(build).toMatchObject({ status: "would-change" });
    expect(build.summary).toMatch(/tiles to build/);

    jest.mocked(planRealmRelief).mockResolvedValue(plan({ built: true }));
    const record = await runReliefStep(context(true));
    expect(record).toMatchObject({ status: "would-change" });
    expect(record.summary).toMatch(/entry changes/);
    expect(applyRealmRelief).not.toHaveBeenCalled();
  });

  it("builds on an apply and reports the tiles", async () => {
    const planned = plan();
    jest.mocked(planRealmRelief).mockResolvedValue(planned);
    jest
      .mocked(applyRealmRelief)
      .mockResolvedValue({ ...planned.entry, built: true, tiles: 292, skipped: 733 });
    const report = await runReliefStep(context(false));
    expect(applyRealmRelief).toHaveBeenCalledWith(db, "r1", planned);
    expect(report).toMatchObject({
      status: "changed",
      counts: { tiles: 292, skipped: 733 },
    });
    expect(report.summary).toMatch(/292 tiles/);
    expect(report.summary).toMatch(/z0.5/);
  });
});
