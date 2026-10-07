/** @jest-environment node */
/**
 * Realm map editing (the `map` officer power): site admins edit any map; a realm's founder and its officers
 * holding `map` edit their own realm's borders, region links and labels, never another realm's and never
 * IxWorld's.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { geoFeaturesRealmLabelsRouter } from "~/server/api/routers/geo/features/realm-labels";
import { geoFeaturesLabelsRouter } from "~/server/api/routers/geo/features/labels";
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
  ixworld: { id: DEFAULT_REALM_ID, slug: "ixworld", ownerId: "system", status: "active" },
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
    upsert: jest.fn().mockResolvedValue({ id: "session", sessionData: {} }),
  };
}

function realmDb(status: Record<string, string> = {}): Db {
  const models = new Map<string, ModelMock>();
  const db = new Proxy({} as Db, {
    get: (_t, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
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
  fontSize: 16,
  color: "#2874a6",
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

  it("IxWorld's map is for site admins only, whoever its realm row names", () => {
    const ixworld = { id: DEFAULT_REALM_ID, ownerId: FOUNDER };
    const grants = [{ userId: MAP_OFFICER, powers: ["map"] }];
    expect(canEditRealmMap(actor(FOUNDER), ixworld, grants)).toBe(false);
    expect(canEditRealmMap(actor(MAP_OFFICER), ixworld, grants)).toBe(false);
    expect(canEditRealmMap(actor(ADMIN, true), ixworld, grants)).toBe(true);
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

  it("nor IxWorld's, even with no ?realm= (the viewer's realm defaults to IxWorld)", async () => {
    for (const who of [FOUNDER, MAP_OFFICER]) {
      const db = withFeature(realmDb());
      await expect(start(db, who, "ixworld")).rejects.toMatchObject({ code: "FORBIDDEN" });
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
        realm: "ixworld",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.mapLayer!.findFirst).not.toHaveBeenCalled();
    expect(db.mapLayer!.findMany).not.toHaveBeenCalled();
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
    });
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
      validation(FOUNDER).repairLinkage({ action: "sync_all", realm: "ixworld" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
        fontStyle: "normal",
      });
    }
  });

  it("nobody else labels Eurth, and Eurth's staff never label IxWorld or another realm", async () => {
    const db = realmDb();
    await expect(
      labels(db, BOARD_OFFICER).createRealmLabel({ ...LABEL, realm: "eurth" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      labels(db, FOUNDER).createRealmLabel({ ...LABEL, realm: "ixworld" })
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

    db.mapLabel!.findFirst!.mockResolvedValue({ id: "l1" });
    await labels(db, MAP_OFFICER).updateRealmLabel({
      labelId: "l1",
      fontStyle: "italic",
      fontSize: 20,
      realm: "eurth",
    });
    expect(db.mapLabel!.update!.mock.calls[0][0]).toMatchObject({
      where: { id: "l1" },
      data: { fontStyle: "italic", fontSize: 20 },
    });
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
              fontStyle: "italic",
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
      fontStyle: "italic",
      countryName: null,
      realmLabel: true,
    });
  });
});
