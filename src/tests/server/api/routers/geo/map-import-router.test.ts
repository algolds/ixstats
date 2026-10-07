/** @jest-environment node */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, fakeDb, stranger } from "~/tests/server/maps/map-import-fakes";

function caller(user: typeof admin) {
  const db = fakeDb();
  db.realm.rows.push({ id: "r1", slug: "eurth", name: "Eurth", ownerId: "founder_1", settings: { map: { projection: "mercator" } } });
  db.country.rows.push({ id: "c1", name: "Aurelia", realmId: "r1", landArea: null });
  db.realmPage.rows.push({ realmId: "r1", kind: "nation", title: "Borealis" });
  return createCallerFactory(geoEditorMapImportRouter)(
    createMockRouterContext({ db, auth: { userId: user.clerkUserId }, user: { ...user, country: null } }) as never
  );
}

describe("geoEditor.mapImport", () => {
  it("gives staff the realm's nations and map settings", async () => {
    const context = await caller(admin).mapImport.context({ realmId: "r1" });
    expect(context.nations).toEqual([{ name: "Aurelia", countryId: "c1" }, { name: "Borealis" }]);
    expect(context.mapSettings).toEqual({ projection: "mercator" });
    expect(context.jobs).toEqual([]);
  });

  it("keeps other players out of every procedure", async () => {
    const api = caller(stranger).mapImport;
    await expect(api.context({ realmId: "r1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      api.start({ realmId: "r1", uploadId: "a".repeat(64), kind: "png", filename: "x.png" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.saveGeoreference({ realmId: "r1", georef: { projection: "mercator" } })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("previews a georeference's extent, and refuses one that cannot be fitted", async () => {
    const api = caller(admin).mapImport;
    const preview = await api.previewGeoreference({
      width: 600,
      height: 300,
      georef: { bounds: { west: -20, south: 30, east: 40, north: 60 } },
    });
    expect(preview).toMatchObject({ method: "bounds", extent: { west: -20, south: 30, east: 40, north: 60 } });
    await expect(
      api.previewGeoreference({
        width: 100,
        height: 100,
        georef: {
          controlPoints: [
            { x: 0, y: 0, lon: 0, lat: 0 },
            { x: 0, y: 10, lon: 0, lat: -1 },
            { x: 0, y: 20, lon: 0, lat: -2 },
          ],
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
