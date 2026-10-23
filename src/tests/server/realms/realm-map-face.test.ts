import { faceViewBox, getRealmMapFace } from "~/server/modules/realms/realms.map-face";

const row = (status: string, d: string, box = [-10, -5, 10, 5]) => ({
  status, d, xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3],
});
const dbWith = (political: object[], land: object[] = [{ d: null, xmin: null, ymin: null, xmax: null, ymax: null }]) => {
  const $queryRawUnsafe = jest.fn().mockResolvedValueOnce(political).mockResolvedValueOnce(land);
  return { $queryRawUnsafe };
};

it("widens a tall extent to the band aspect", () => {
  expect(faceViewBox({ minX: -500, minY: -300, width: 1000, height: 600 }, 2.4, 0)).toBe("-720 -300 1440 600");
});
it("heightens a wide extent to the band aspect", () => {
  expect(faceViewBox({ minX: 0, minY: 0, width: 240, height: 50 }, 2.4, 0)).toBe("0 -25 240 100");
});
it("groups nations by status and flips the extent into SVG y", async () => {
  const db = dbWith([row("open", "M 0 0 l 1 1 z"), row("claimed", "M 2 2 l 1 1 z", [0, 0, 20, 10])]);
  const face = await getRealmMapFace(db as never, "realm-a", 0);
  expect(face).toMatchObject({ open: "M 0 0 l 1 1 z", claimed: "M 2 2 l 1 1 z", other: "", land: "" });
  // union extent x -10..20, y -5..10, so SVG minY = -10
  expect(face?.viewBox.split(" ").map(Number)[1]).toBeLessThan(-10);
});
it("returns null without political rows and skips the land query", async () => {
  const db = dbWith([]);
  expect(await getRealmMapFace(db as never, "realm-b", 0)).toBeNull();
  expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
});
it("serves a cached face for an hour", async () => {
  const db = dbWith([row("open", "M 0 0 z")]);
  await getRealmMapFace(db as never, "realm-c", 0);
  await getRealmMapFace(db as never, "realm-c", 3_599_999);
  expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(2); // political + land, once
  db.$queryRawUnsafe.mockResolvedValueOnce([row("open", "M 0 0 z")]).mockResolvedValueOnce([]);
  await getRealmMapFace(db as never, "realm-c", 3_600_001);
  expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(4);
});
it("passes the realm id as a bound parameter, never in the SQL text", async () => {
  const db = dbWith([row("open", "M 0 0 z")]);
  await getRealmMapFace(db as never, "realm'; drop", 0);
  expect(db.$queryRawUnsafe.mock.calls[0][0]).not.toContain("drop");
  expect(db.$queryRawUnsafe.mock.calls[0][1]).toBe("realm'; drop");
});
it("path strings carry no collection separators", async () => {
  const db = dbWith([row("open", "M 0 0 z")]);
  await getRealmMapFace(db as never, "realm-d", 0);
  const sql: string = db.$queryRawUnsafe.mock.calls[0][0];
  expect(sql).toContain("ST_CollectionExtract");
  expect(sql).toMatch(/ST_CollectionExtract\(ST_Collect\(g\), 3\)/);
});
it("frames the face on the nations alone, never on the land", async () => {
  const bare = dbWith([row("open", "M 0 0 z")]);
  const withLand = dbWith([row("open", "M 0 0 z")], [{ d: "M -900 -300 z", xmin: -900, ymin: -300, xmax: 900, ymax: 300 }]);
  const a = await getRealmMapFace(bare as never, "realm-e", 0);
  const b = await getRealmMapFace(withLand as never, "realm-f", 0);
  expect(b?.land).toBe("M -900 -300 z");
  expect(b?.viewBox).toBe(a?.viewBox);
});
it("clips nations and land to the latitude band before drawing", async () => {
  const db = dbWith([row("open", "M 0 0 z")]);
  await getRealmMapFace(db as never, "realm-g", 0);
  for (const [sql] of db.$queryRawUnsafe.mock.calls) expect(sql).toContain("ST_ClipByBox2D");
});
