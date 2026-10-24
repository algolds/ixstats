import {
  faceViewBox,
  getRealmMapFace,
  getRealmMapGeo,
} from "~/server/modules/realms/realms.map-face";

const row = (status: string, d: string, box = [-10, -5, 10, 5]) => ({
  status,
  d,
  xmin: box[0],
  ymin: box[1],
  xmax: box[2],
  ymax: box[3],
});
const dbWith = (
  political: object[],
  land: object[] = [{ d: null, xmin: null, ymin: null, xmax: null, ymax: null }]
) => {
  const $queryRawUnsafe = jest.fn().mockResolvedValueOnce(political).mockResolvedValueOnce(land);
  return { $queryRawUnsafe };
};

it("widens a tall extent to the band aspect", () => {
  expect(faceViewBox({ minX: -500, minY: -300, width: 1000, height: 600 }, 2.4, 0)).toBe(
    "-720 -300 1440 600"
  );
});
it("heightens a wide extent to the band aspect", () => {
  expect(faceViewBox({ minX: 0, minY: 0, width: 240, height: 50 }, 2.4, 0)).toBe("0 -25 240 100");
});
it("groups nations by status and flips the extent into SVG y", async () => {
  const db = dbWith([
    row("open", "M 0 0 l 1 1 z"),
    row("claimed", "M 2 2 l 1 1 z", [0, 0, 20, 10]),
  ]);
  const face = await getRealmMapFace(db as never, "realm-a", 0);
  expect(face).toMatchObject({
    open: "M 0 0 l 1 1 z",
    claimed: "M 2 2 l 1 1 z",
    other: "",
    land: "",
  });
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
  const withLand = dbWith(
    [row("open", "M 0 0 z")],
    [{ d: "M -900 -300 z", xmin: -900, ymin: -300, xmax: 900, ymax: 300 }]
  );
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
describe("failure handling", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it("a rejected build is not retried within the short TTL", async () => {
    const $queryRawUnsafe = jest.fn().mockRejectedValue(new Error("boom"));
    const db = { $queryRawUnsafe };
    expect(await getRealmMapFace(db as never, "realm-fail", 0)).toBeNull();
    expect(await getRealmMapFace(db as never, "realm-fail", 299_999)).toBeNull();
    expect($queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
  it("a rejected build is retried after the short TTL", async () => {
    const $queryRawUnsafe = jest.fn().mockRejectedValueOnce(new Error("boom"));
    const db = { $queryRawUnsafe };
    await getRealmMapFace(db as never, "realm-retry", 0);
    $queryRawUnsafe.mockResolvedValueOnce([row("open", "M 0 0 z")]).mockResolvedValueOnce([]);
    const face = await getRealmMapFace(db as never, "realm-retry", 300_001);
    expect($queryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(face?.open).toBe("M 0 0 z");
  });
  it("concurrent callers share one build", async () => {
    const db = dbWith([row("open", "M 0 0 z")]);
    const [a, b, c] = await Promise.all([
      getRealmMapFace(db as never, "realm-shared", 0),
      getRealmMapFace(db as never, "realm-shared", 0),
      getRealmMapFace(db as never, "realm-shared", 0),
    ]);
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
  it("a land failure keeps the nations", async () => {
    const $queryRawUnsafe = jest
      .fn()
      .mockResolvedValueOnce([row("open", "M 0 0 z")])
      .mockRejectedValueOnce(new Error("GEOS"));
    const face = await getRealmMapFace({ $queryRawUnsafe } as never, "realm-land-fail", 0);
    expect(face).toMatchObject({ open: "M 0 0 z", land: "" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getRealmMapGeo", () => {
  const square = JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  });
  const nation = (status: string, id: string | null, box: number[]) => ({
    status,
    id,
    name: id ? `Nation ${id}` : "Wilds",
    slug: id,
    flag: null,
    geometry: square,
    xmin: box[0],
    ymin: box[1],
    xmax: box[2],
    ymax: box[3],
  });
  const geoDb = (nations: object[], land: Promise<object[]>) => ({
    $queryRawUnsafe: jest.fn().mockResolvedValueOnce(nations).mockReturnValueOnce(land),
  });

  it("returns each nation as a keyed feature with its status, and the nations' bounds", async () => {
    const db = geoDb(
      [nation("claimed", "c1", [-20, -10, 5, 30]), nation("other", null, [0, 0, 40, 12])],
      Promise.resolve([{ geometry: square }])
    );
    const geo = await getRealmMapGeo(db as never, "geo-a", 0);
    expect(geo?.bounds).toEqual([-20, -10, 40, 30]);
    expect(geo?.nations.map((f) => f.properties)).toEqual([
      { key: 0, id: "c1", name: "Nation c1", slug: "c1", flag: null, status: "claimed" },
      { key: 1, id: null, name: "Wilds", slug: null, flag: null, status: "other" },
    ]);
    expect(geo?.nations[0]?.geometry.type).toBe("Polygon");
    expect(geo?.land?.type).toBe("Polygon");
  });

  it("keeps the nations when the land query fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = geoDb([nation("open", "o1", [0, 0, 1, 1])], Promise.reject(new Error("GEOS")));
    const geo = await getRealmMapGeo(db as never, "geo-b", 0);
    expect(geo?.nations).toHaveLength(1);
    expect(geo?.land).toBeNull();
    error.mockRestore();
  });

  it("is null without nations and never asks for land", async () => {
    const db = geoDb([], Promise.resolve([]));
    expect(await getRealmMapGeo(db as never, "geo-c", 0)).toBeNull();
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("binds the realm id and clips to the latitude band", async () => {
    const db = geoDb([nation("open", "o1", [0, 0, 1, 1])], Promise.resolve([]));
    await getRealmMapGeo(db as never, "geo'; drop", 0);
    const [sql, id] = db.$queryRawUnsafe.mock.calls[0] as [string, string];
    expect(id).toBe("geo'; drop");
    expect(sql).not.toContain("drop");
    expect(sql).toContain("ST_ClipByBox2D");
  });
});
