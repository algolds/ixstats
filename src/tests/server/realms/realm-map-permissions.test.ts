/** @jest-environment node */
/**
 * Realm map editing (the `map` officer power): site admins edit any map; a realm's founder and its officers
 * holding `map` edit their own realm's borders, region links and labels, never another realm's and never
 * Ixnay's.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { geoEditorQueueRouter } from "~/server/api/routers/geo/editor/queue";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { geoFeaturesRealmLabelsRouter } from "~/server/api/routers/geo/features/realm-labels";
import { geoFeaturesLabelsRouter } from "~/server/api/routers/geo/features/labels";
import { realmMapPipelineRouter } from "~/server/api/routers/realms/map-pipeline";
import { canEditRealmMap, canImportRealmMap } from "~/server/modules/realms/realms.access";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import {
  REALM_POWERS,
  REALM_POWER_DESCRIPTIONS,
  REALM_POWER_LABELS,
} from "~/lib/realms/realm-region";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const OTHER = "r_other";
const FOUNDER = "clerk_founder";
const MAP_OFFICER = "clerk_mapper";
const BOARD_OFFICER = "clerk_board";
const PLAYER = "clerk_player";
const ADMIN = "clerk_admin";

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock>;

const REALMS: Record<string, { id: string; slug: string; ownerId: string; status: string }> = {
  eurth: { id: EURTH, slug: "eurth", ownerId: FOUNDER, status: "active" },
  other: { id: OTHER, slug: "other", ownerId: "clerk_someone_else", status: "active" },
  ixnay: { id: DEFAULT_REALM_ID, slug: "ixnay", ownerId: "system", status: "active" },
};
const OFFICERS: Record<string, Array<{ userId: string; powers: string[] }>> = {
  [EURTH]: [
    { userId: MAP_OFFICER, powers: ["map"] },
    { userId: BOARD_OFFICER, powers: ["board", "appearance"] },
  ],
  [OTHER]: [],
  [DEFAULT_REALM_ID]: [],
};

function modelMock(): ModelMock {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "created" }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    upsert: jest.fn().mockResolvedValue({ id: "session", sessionData: {} }),
  };
}

function realmDb(status: Record<string, string> = {}): Db {
  const models = new Map<string, ModelMock>();
  // The map version bump after a map write (invalidateRealmMap)
  const queryRaw = jest.fn().mockResolvedValue([{ mapVersion: 1 }]);
  // The nation's outline union after a merge (syncCountryGeometryFromMapLayer): no PostGIS geometry here
  const queryRawUnsafe = jest.fn().mockResolvedValue([]);
  const db = new Proxy({} as Db, {
    get: (_t, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
      if (key === "$queryRaw") return queryRaw;
      if (key === "$queryRawUnsafe") return queryRawUnsafe;
      if (!models.has(key)) models.set(key, modelMock());
      return models.get(key);
    },
  });
  db.realm!.findUnique!.mockImplementation(
    async ({ where }: { where: { slug?: string; id?: string } }) => {
      const realm = where.slug
        ? REALMS[where.slug]
        : Object.values(REALMS).find((r) => r.id === where.id);
      if (!realm) return null;
      return { ...realm, status: status[realm.id] ?? realm.status, officers: OFFICERS[realm.id] };
    }
  );
  return db;
}

function ctxAs(db: Db, clerkUserId: string) {
  return createMockRouterContext({
    db,
    auth: { userId: clerkUserId },
    user: {
      id: `db_${clerkUserId}`,
      clerkUserId,
      role: clerkUserId === ADMIN ? { name: "admin", level: 10 } : { name: "member", level: 100 },
      country: null,
    },
    rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
  }) as never;
}

const borders = (db: Db, who: string) =>
  createCallerFactory(geoEditorBordersRouter)(ctxAs(db, who));
const labels = (db: Db, who: string) =>
  createCallerFactory(geoFeaturesRealmLabelsRouter)(ctxAs(db, who));

const LABEL = {
  text: "Sunless Sea",
  labelType: "sea" as const,
  coordinates: [10, 20] as [number, number],
};

beforeEach(() => clearTrpcMemoryCache());

describe("the map power", () => {
  it("is an officer power with a label and a description for the Officers section", () => {
    expect(REALM_POWERS).toContain("map");
    expect(REALM_POWER_LABELS.map).toBe("Map");
    expect(REALM_POWER_DESCRIPTIONS.map).toBe(
      "Edit the realm's map, borders and labels, and import maps"
    );
  });

  const realm = { id: EURTH, ownerId: FOUNDER };
  const officers = OFFICERS[EURTH]!;
  const actor = (clerkUserId: string, admin = false) => ({
    id: `db_${clerkUserId}`,
    clerkUserId,
    role: admin ? { name: "admin", level: 10 } : { name: "member", level: 100 },
  });

  it("canEditRealmMap: site admins, the founder and map officers; nobody else", () => {
    expect(canEditRealmMap(actor(ADMIN, true), realm, officers)).toBe(true);
    expect(canEditRealmMap(actor(FOUNDER), realm, officers)).toBe(true);
    expect(canEditRealmMap(actor(MAP_OFFICER), realm, officers)).toBe(true);
    expect(canEditRealmMap(actor(BOARD_OFFICER), realm, officers)).toBe(false);
    expect(canEditRealmMap(actor(PLAYER), realm, officers)).toBe(false);
    expect(canEditRealmMap(null, realm, officers)).toBe(false);
  });

  it("Ixnay's map is for site admins only, whoever its realm row names", () => {
    const ixnay = { id: DEFAULT_REALM_ID, ownerId: FOUNDER };
    const grants = [{ userId: MAP_OFFICER, powers: ["map"] }];
    expect(canEditRealmMap(actor(FOUNDER), ixnay, grants)).toBe(false);
    expect(canEditRealmMap(actor(MAP_OFFICER), ixnay, grants)).toBe(false);
    expect(canEditRealmMap(actor(ADMIN, true), ixnay, grants)).toBe(true);
  });

  it("canImportRealmMap follows the same rule", () => {
    expect(canImportRealmMap(actor(MAP_OFFICER), realm, officers)).toBe(true);
    expect(canImportRealmMap(actor(BOARD_OFFICER), realm, officers)).toBe(false);
  });
});

describe("world-mode border editing is realm-scoped", () => {
  const start = (db: Db, who: string, realm: string) =>
    borders(db, who).startBorderEditSession({ featureId: "Gallambria", realm });

  function withFeature(db: Db) {
    db.mapLayer!.findFirst!.mockResolvedValue({
      id: "ml1",
      featureId: "Gallambria",
      boundingBox: null,
    });
    return db;
  }

  it.each([FOUNDER, MAP_OFFICER, ADMIN])("%s edits Eurth's borders", async (who) => {
    const db = withFeature(realmDb());
    await expect(start(db, who, "eurth")).resolves.toMatchObject({
      feature: { featureId: "Gallambria" },
    });
    expect(db.mapLayer!.findFirst!.mock.calls[0][0].where.realmId).toBe(EURTH);
  });

  it.each([BOARD_OFFICER, PLAYER])("%s cannot edit Eurth's borders", async (who) => {
    const db = withFeature(realmDb());
    await expect(start(db, who, "eurth")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.mapLayer!.findFirst).not.toHaveBeenCalled();
  });

  it("Eurth's founder and map officer cannot edit another realm's map", async () => {
    for (const who of [FOUNDER, MAP_OFFICER]) {
      const db = withFeature(realmDb());
      await expect(start(db, who, "other")).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("nor Ixnay's, even with no ?realm= (the viewer's realm defaults to Ixnay)", async () => {
    for (const who of [FOUNDER, MAP_OFFICER]) {
      const db = withFeature(realmDb());
      await expect(start(db, who, "ixnay")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        borders(db, who).startBorderEditSession({ featureId: "Gallambria" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("an archived realm's map is read-only to its founder", async () => {
    const db = withFeature(realmDb({ [EURTH]: "archived" }));
    await expect(start(db, FOUNDER, "eurth")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("split and merge are refused outside the editor's realm before any read", async () => {
    const db = realmDb();
    await expect(
      borders(db, MAP_OFFICER).splitCountry({
        featureId: "A",
        splitLine: [
          [0, 0],
          [1, 1],
        ],
        nameA: "A1",
        nameB: "A2",
        realm: "other",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      borders(db, FOUNDER).mergeCountries({
        featureIds: ["A", "B"],
        newName: "AB",
        realm: "ixnay",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.mapLayer!.findFirst).not.toHaveBeenCalled();
    expect(db.mapLayer!.findMany).not.toHaveBeenCalled();
  });

  it("split keeps the nation on the larger part, merge on the largest linked source", async () => {
    const db = realmDb();
    const rect = (x0: number, x1: number) => ({
      type: "Polygon",
      coordinates: [
        [
          [x0, 0],
          [x1, 0],
          [x1, 1],
          [x0, 1],
          [x0, 0],
        ],
      ],
    });
    db.mapLayer!.findFirst!.mockResolvedValue({
      id: "ml1",
      featureId: "A",
      countryId: "c1",
      geometry: rect(0, 3),
    });
    db.mapLayer!.createMany = jest.fn();
    await borders(db, MAP_OFFICER).splitCountry({
      featureId: "A",
      splitLine: [
        [1, -1],
        [1, 2],
      ],
      nameA: "West",
      nameB: "East",
      realm: "eurth",
    });
    const parts: Array<{ areaSqKm: number; countryId: string | null }> =
      db.mapLayer!.createMany.mock.calls[0][0].data;
    const [small, large] = [...parts].sort((a, b) => a.areaSqKm - b.areaSqKm);
    expect(large!.countryId).toBe("c1");
    expect(small!.countryId).toBeNull();

    db.mapLayer!.findMany!.mockResolvedValue([
      { id: "m1", featureId: "A", countryId: "c1", areaSqKm: 10, geometry: rect(0, 1) },
      { id: "m2", featureId: "B", countryId: "c2", areaSqKm: 30, geometry: rect(1, 2) },
    ]);
    await borders(db, MAP_OFFICER).mergeCountries({
      featureIds: ["A", "B"],
      newName: "Union",
      realm: "eurth",
    });
    expect(db.mapLayer!.create!.mock.calls[0][0].data.countryId).toBe("c2");
  });

  it("an editor saves only into their own draft session", async () => {
    const db = realmDb();
    db.mapEditorSession!.updateMany!.mockResolvedValue({ count: 0 });
    await expect(
      borders(db, MAP_OFFICER).saveBorderEditDraft({
        sessionId: `${FOUNDER}_Gallambria`,
        sessionData: {},
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.mapEditorSession!.updateMany!.mock.calls[0][0].where).toEqual({
      id: `${FOUNDER}_Gallambria`,
      userId: MAP_OFFICER,
    });
  });

  describe("opening the border editor offers the editor's own newer draft", () => {
    const SAVED = new Date("2026-10-11T10:00:00Z");
    const square = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };

    function open(
      session: { userId?: string; featureId?: string; sessionData: object },
      featureUpdatedAt: Date
    ) {
      const db = realmDb();
      db.mapLayer!.findFirst!.mockResolvedValue({
        id: "ml1",
        featureId: "Gallambria",
        boundingBox: null,
        updatedAt: featureUpdatedAt,
      });
      db.mapEditorSession!.upsert!.mockResolvedValue({
        id: "s1",
        userId: MAP_OFFICER,
        featureId: "Gallambria",
        ...session,
      });
      return borders(db, MAP_OFFICER)
        .startBorderEditSession({ featureId: "Gallambria", realm: "eurth" })
        .then((result) => ({ result, db }));
    }
    const draftData = (savedAt: Date, featureId = "Gallambria") => ({
      featureId,
      geometry: square,
      dirtyNeighbors: {},
      savedAt: savedAt.getTime(),
    });
    const hoursBefore = (date: Date, hours: number) => new Date(date.getTime() - hours * 3_600_000);

    beforeEach(() => jest.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") }));
    afterEach(() => jest.useRealTimers());

    it("returns a draft saved after the feature last changed, and never the raw session data", async () => {
      const { result } = await open({ sessionData: draftData(SAVED) }, hoursBefore(SAVED, 1));
      expect(result.draft).toEqual(draftData(SAVED));
      expect(result.session).toEqual({ id: "s1" });
    });

    it("names the realm in the session id, since feature ids repeat across realms", async () => {
      const { db } = await open({ sessionData: draftData(SAVED) }, hoursBefore(SAVED, 1));
      expect(db.mapEditorSession!.upsert!.mock.calls[0][0].where.id).toBe(
        `${MAP_OFFICER}_${EURTH}_Gallambria`
      );
    });

    it("stamps the save time itself, so the comparison with the feature's update time uses one clock", async () => {
      const db = realmDb();
      await borders(db, MAP_OFFICER).saveBorderEditDraft({
        sessionId: `${MAP_OFFICER}_${EURTH}_Gallambria`,
        sessionData: { ...draftData(SAVED), savedAt: 1 },
      });
      const saved = db.mapEditorSession!.updateMany!.mock.calls[0][0].data.sessionData;
      expect(saved.savedAt).toBe(Date.now());
      expect(saved.geometry).toEqual(square);
    });

    it("offers nothing on the next open once the draft was reset by a discard", async () => {
      const db = realmDb();
      const sessionId = `${MAP_OFFICER}_${EURTH}_Gallambria`;
      let stored: object = { undoStack: [], mode: "select" };
      db.mapLayer!.findFirst!.mockResolvedValue({
        id: "ml1",
        featureId: "Gallambria",
        boundingBox: null,
        updatedAt: hoursBefore(SAVED, 1),
      });
      db.mapEditorSession!.updateMany!.mockImplementation(
        async ({ data }: { data: { sessionData: object } }) => {
          stored = data.sessionData;
          return { count: 1 };
        }
      );
      db.mapEditorSession!.upsert!.mockImplementation(async () => ({
        id: sessionId,
        userId: MAP_OFFICER,
        featureId: "Gallambria",
        sessionData: stored,
      }));
      const caller = borders(db, MAP_OFFICER);
      const open = () => caller.startBorderEditSession({ featureId: "Gallambria", realm: "eurth" });

      await caller.saveBorderEditDraft({ sessionId, sessionData: draftData(SAVED) });
      expect((await open()).draft).not.toBeNull();

      await caller.saveBorderEditDraft({
        sessionId,
        sessionData: { undoStack: [], mode: "select" },
      });
      expect((await open()).draft).toBeNull();
    });

    it("applying an edit clears this realm's draft of the feature, not another realm's", async () => {
      const db = realmDb();
      db.mapLayer!.findFirst!.mockResolvedValue({
        id: "ml1",
        geometry: square,
        countryId: null,
        displayName: "Gallambria",
        areaSqKm: 1,
      });

      await borders(db, MAP_OFFICER).submitBorderEdit({
        featureId: "Gallambria",
        editSubtype: "vertex_edit",
        proposedGeometry: square,
        applyDirectly: true,
        realm: "eurth",
      });

      expect(db.mapEditorSession!.deleteMany!.mock.calls).toEqual([
        [{ where: { id: `${MAP_OFFICER}_${EURTH}_Gallambria` } }],
      ]);
    });

    it("offers no draft once the feature was saved after it", async () => {
      const { result } = await open({ sessionData: draftData(SAVED) }, hoursBefore(SAVED, -1));
      expect(result.draft).toBeNull();
    });

    it("offers no draft written for another feature", async () => {
      const other = draftData(SAVED, "Daxia");
      const { result } = await open({ sessionData: other }, hoursBefore(SAVED, 1));
      expect(result.draft).toBeNull();
    });

    it("offers no draft that belongs to another user", async () => {
      const { result } = await open(
        { userId: PLAYER, sessionData: draftData(SAVED) },
        hoursBefore(SAVED, 1)
      );
      expect(result.draft).toBeNull();
    });

    it("offers no draft from a fresh session or an older autosave format", async () => {
      const fresh = await open({ sessionData: { undoStack: [], mode: "select" } }, SAVED);
      expect(fresh.result.draft).toBeNull();
      const legacy = await open(
        { sessionData: { geometry: square, undoStack: { entries: [] }, mode: "vertex_edit" } },
        hoursBefore(SAVED, 1)
      );
      expect(legacy.result.draft).toBeNull();
    });
  });

  it("a border edit filed for review records its realm", async () => {
    const db = realmDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", countryId: "c1", geometry: null });
    db.mapEditRequest!.create!.mockResolvedValue({ id: "req1" });
    await borders(db, MAP_OFFICER).submitBorderEdit({
      featureId: "Gallambria",
      editSubtype: "redraw",
      proposedGeometry: { type: "Polygon", coordinates: [] },
      realm: "eurth",
    });
    expect(db.mapEditRequest!.create!.mock.calls[0][0].data).toMatchObject({
      realmId: EURTH,
      countryId: "c1",
      targetId: "ml1",
      proposedData: { geometry: { type: "Polygon", coordinates: [] } },
    });
  });

  it("approving a queued border edit reshapes its own feature, or refuses without approving", async () => {
    const db = realmDb();
    const geometry = { type: "Polygon", coordinates: [] };
    db.mapEditRequest!.findUnique!.mockResolvedValue({
      id: "req1",
      status: "pending",
      editType: "border_adjust",
      operation: "update",
      countryId: "c1",
      realmId: EURTH,
      targetId: "ml1",
      proposedData: { geometry },
    });
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", areaSqKm: null, realmId: EURTH });
    const queue = createCallerFactory(geoEditorQueueRouter)(ctxAs(db, ADMIN));
    await queue.approveEdit({ editId: "req1" });
    expect(db.mapLayer!.findFirst!.mock.calls[0][0].where).toEqual({
      id: "ml1",
      layerType: "political",
      isActive: true,
      realmId: EURTH,
    });
    expect(db.mapLayer!.update!.mock.calls[0][0]).toEqual({
      where: { id: "ml1" },
      data: { geometry },
    });
    expect(db.mapEditRequest!.update!.mock.calls[0][0].data.status).toBe("approved");

    db.mapLayer!.findFirst!.mockResolvedValue(null);
    await expect(queue.approveEdit({ editId: "req1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.mapEditRequest!.update).toHaveBeenCalledTimes(1);
  });
});

describe("linkage and auto-match are realm-scoped", () => {
  it("a map officer validates and auto-matches Eurth; a board officer cannot", async () => {
    const db = realmDb();
    const validation = (who: string) =>
      createCallerFactory(geoEditorLinkageValidationRouter)(ctxAs(db, who));
    await expect(
      validation(MAP_OFFICER).validateLinkage({ realm: "eurth" })
    ).resolves.toMatchObject({ totalCountries: 0 });
    await expect(
      validation(BOARD_OFFICER).repairLinkage({ action: "auto_match", realm: "eurth" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      validation(FOUNDER).repairLinkage({ action: "sync_all", realm: "ixnay" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows realm staff nation owners by forum name only, never their account id", async () => {
    const unlinkedNation = (db: Db) =>
      db.country!.findMany!.mockResolvedValue([
        {
          id: "c1",
          name: "Ostia",
          flag: null,
          landArea: null,
          geometry: null,
          owner: { clerkUserId: "clerk_owner", forumUsername: null },
        },
      ]);
    const validate = async (who: string) => {
      const db = realmDb();
      unlinkedNation(db);
      const result = await createCallerFactory(geoEditorLinkageValidationRouter)(
        ctxAs(db, who)
      ).validateLinkage({ realm: "eurth" });
      return result.unlinked[0]!.ownerName;
    };
    await expect(validate(MAP_OFFICER)).resolves.toBeNull();
    await expect(validate(ADMIN)).resolves.toBe("clerk_owner");
  });

  it("a map officer renames a region but not the nation linked to it", async () => {
    const db = realmDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ id: "ml1", featureId: "F", countryId: "c1" });
    await createCallerFactory(geoEditorLinkageAssignmentRouter)(
      ctxAs(db, MAP_OFFICER)
    ).updateFeatureProperties({ featureId: "F", displayName: "New name", realm: "eurth" });
    expect(db.mapLayer!.update!.mock.calls[0][0].data).toEqual({ displayName: "New name" });
    expect(db.country!.update).not.toHaveBeenCalled();
  });

  it("an admin saving a region's other fields keeps the linked nation's name", async () => {
    const db = realmDb();
    db.mapLayer!.findFirst!.mockResolvedValue({
      id: "ml1",
      featureId: "F",
      countryId: "c1",
      displayName: "Region",
    });
    const caller = createCallerFactory(geoEditorLinkageAssignmentRouter)(ctxAs(db, ADMIN));
    await caller.updateFeatureProperties({
      featureId: "F",
      displayName: "Region",
      properties: { note: "x" },
      realm: "eurth",
    });
    expect(db.country!.update).not.toHaveBeenCalled();
    await caller.updateFeatureProperties({
      featureId: "F",
      displayName: "New name",
      realm: "eurth",
    });
    expect(db.country!.update!.mock.calls[0][0].data).toEqual({
      name: "New name",
      slug: "new-name",
    });
  });

  it("a founder cannot link regions of another realm", async () => {
    const db = realmDb();
    await expect(
      createCallerFactory(geoEditorLinkageAssignmentRouter)(
        ctxAs(db, FOUNDER)
      ).assignCountryGeometry({ featureId: "F", countryId: "c1", realm: "other" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });
});

describe("realm labels", () => {
  it("the founder and a map officer label Eurth's seas and oceans", async () => {
    for (const who of [FOUNDER, MAP_OFFICER]) {
      const db = realmDb();
      await labels(db, who).createRealmLabel({ ...LABEL, realm: "eurth" });
      expect(db.mapLabel!.create!.mock.calls[0][0].data).toMatchObject({
        text: "Sunless Sea",
        labelType: "sea",
        realmId: EURTH,
        countryId: null,
        metadata: { rank: "medium" },
      });
    }
  });

  it("nobody else labels Eurth, and Eurth's staff never label Ixnay or another realm", async () => {
    const db = realmDb();
    await expect(
      labels(db, BOARD_OFFICER).createRealmLabel({ ...LABEL, realm: "eurth" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      labels(db, FOUNDER).createRealmLabel({ ...LABEL, realm: "ixnay" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      labels(db, MAP_OFFICER).createRealmLabel({ ...LABEL, realm: "other" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.mapLabel!.create).not.toHaveBeenCalled();
  });

  it("updates and deletes only the realm's own labels, never a nation's", async () => {
    const db = realmDb();
    await expect(
      labels(db, MAP_OFFICER).deleteRealmLabel({ labelId: "nation_label", realm: "eurth" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.mapLabel!.findFirst!.mock.calls[0][0].where).toEqual({
      id: "nation_label",
      realmId: EURTH,
      countryId: null,
    });
    expect(db.mapLabel!.delete).not.toHaveBeenCalled();

    db.mapLabel!.findFirst!.mockResolvedValue({ id: "l1", metadata: { seedKey: "Sunless Sea" } });
    await labels(db, MAP_OFFICER).updateRealmLabel({
      labelId: "l1",
      rank: "minor",
      text: "Sunless Bay",
      realm: "eurth",
    });
    expect(db.mapLabel!.update!.mock.calls[0][0]).toEqual({
      where: { id: "l1" },
      data: { text: "Sunless Bay", metadata: { seedKey: "Sunless Sea", rank: "minor" } },
      select: expect.any(Object),
    });
  });

  it("lists the realm's labels for its editors with each one's rank", async () => {
    const db = realmDb();
    db.mapLabel!.findMany!.mockResolvedValue([
      {
        id: "l1",
        text: "Auraid Bay",
        labelType: "sea",
        coordinates: [6, 38],
        metadata: { rank: "minor" },
      },
      { id: "l2", text: "Argic Ocean", labelType: "ocean", coordinates: [0, 80], metadata: null },
    ]);
    const list = await labels(db, MAP_OFFICER).listRealmLabels({ realm: "eurth" });
    expect(list).toEqual([
      { id: "l1", text: "Auraid Bay", labelType: "sea", coordinates: [6, 38], rank: "minor" },
      { id: "l2", text: "Argic Ocean", labelType: "ocean", coordinates: [0, 80], rank: "major" },
    ]);
  });

  it("the public map lists the realm's own labels next to its nations' labels", async () => {
    const db = realmDb();
    db.mapLabel!.findMany!.mockImplementation(async ({ where }: { where: { countryId?: null } }) =>
      where.countryId === null
        ? [
            {
              id: "l1",
              text: "Sunless Sea",
              labelType: "sea",
              coordinates: [10, 20],
              metadata: { rank: "minor" },
              countryId: null,
              country: null,
            },
          ]
        : []
    );
    const result = await createCallerFactory(geoFeaturesLabelsRouter)(
      ctxAs(db, PLAYER)
    ).getAllMapLabels({ realm: "eurth" });
    expect(result.features).toHaveLength(1);
    expect(result.features[0]!.properties).toMatchObject({
      text: "Sunless Sea",
      rank: "minor",
      countryName: null,
      realmLabel: true,
    });
  });
});

describe("the map pipeline (realms.mapPipeline) is for the realm's map editors", () => {
  const pipeline = (db: Db, who: string) =>
    createCallerFactory(realmMapPipelineRouter)(ctxAs(db, who));

  it.each([FOUNDER, MAP_OFFICER, ADMIN])("%s reads Eurth's pipeline", async (who) => {
    await expect(pipeline(realmDb(), who).get({ realm: "eurth" })).resolves.toMatchObject({
      realm: { slug: "eurth" },
      pipeline: null,
    });
  });

  it.each([BOARD_OFFICER, PLAYER])("%s may not read or run it", async (who) => {
    const caller = pipeline(realmDb(), who);
    await expect(caller.get({ realm: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.start({ realm: "eurth", steps: ["repair"], dryRun: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Ixnay's pipeline is for site admins only; an archived realm's is read-only", async () => {
    await expect(pipeline(realmDb(), FOUNDER).get({ realm: "ixnay" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      pipeline(realmDb({ [EURTH]: "archived" }), FOUNDER).loadPreset({
        realm: "eurth",
        presetId: "eurth-map",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
