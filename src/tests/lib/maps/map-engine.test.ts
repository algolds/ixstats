/**
 * The map engine keeps one MapLibre instance per role and parks it between surfaces. The world surface refreshes
 * its sources in place, so borrowing the parked map again with the same theme keeps its sources, layers and
 * tiles (no style reset); the editor starts clean every time.
 */
type FakeMapInstance = {
  setStyle: jest.Mock;
  resize: jest.Mock;
  once: (event: string, callback: () => void) => void;
  isStyleLoaded: () => boolean;
};

jest.mock("~/lib/maps/load-maplibre", () => {
  const instances: unknown[] = [];
  class FakeMap {
    setStyle = jest.fn();
    resize = jest.fn();
    isStyleLoaded = () => false;
    constructor() {
      instances.push(this);
    }
    // The base style loads (and a replaced one reloads) a tick after it is asked for
    once(_event: string, callback: () => void) {
      queueMicrotask(callback);
    }
  }
  return { loadMaplibre: jest.fn(async () => ({ Map: FakeMap })), instances };
});

type Engine = typeof import("~/lib/maps/map-engine");
let engine: Engine;
let instances: FakeMapInstance[];

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.resetModules();
  document.body.innerHTML = "";
  engine = require("~/lib/maps/map-engine") as Engine;
  instances = (require("~/lib/maps/load-maplibre") as { instances: FakeMapInstance[] }).instances;
});

afterEach(() => jest.restoreAllMocks());

/** Borrow the role's map on a fresh container, wait until it is ready, hand it back. */
async function borrow(
  role: "world" | "editor",
  opts: Partial<Parameters<Engine["acquireSurface"]>[1]>
) {
  const onReady = jest.fn();
  const handle = engine.acquireSurface(role, {
    container: document.body.appendChild(document.createElement("div")),
    ...opts,
    onReady,
  });
  await handle.ready;
  return { handle, onReady };
}

describe("acquireSurface", () => {
  it("keeps the world map's sources when it is borrowed again with the same theme", async () => {
    const first = await borrow("world", { theme: "standard" });
    first.handle.release();

    const second = await borrow("world", { theme: "standard" });

    expect(instances).toHaveLength(1);
    expect(instances[0]!.setStyle).not.toHaveBeenCalled();
    expect(second.onReady).toHaveBeenCalledWith(instances[0], { styleReset: false });
  });

  it("keeps them when only the projection differs: the surface applies its own on mount", async () => {
    const first = await borrow("world", { theme: "standard", projectionMode: "dynamic" });
    first.handle.release();

    await borrow("world", { theme: "standard", projectionMode: "mercator" });

    expect(instances[0]!.setStyle).not.toHaveBeenCalled();
  });

  it("puts the base style back when the theme changed, and says so", async () => {
    const first = await borrow("world", { theme: "standard" });
    first.handle.release();

    const second = await borrow("world", { theme: "dark" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
    expect(instances[0]!.setStyle).toHaveBeenCalledWith(expect.anything(), { diff: false });
    expect(second.onReady).toHaveBeenCalledWith(instances[0], { styleReset: true });
  });

  it("does not reset again once the changed theme is the one in place", async () => {
    (await borrow("world", { theme: "standard" })).handle.release();
    (await borrow("world", { theme: "dark" })).handle.release();

    await borrow("world", { theme: "dark" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
  });

  it("puts the base style back when the map last showed another realm, and says so", async () => {
    (await borrow("world", { theme: "standard", warmKey: "default" })).handle.release();

    const second = await borrow("world", { theme: "standard", warmKey: "r_eurth" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
    expect(second.onReady).toHaveBeenCalledWith(instances[0], { styleReset: true });
  });

  it("keeps the map when it is borrowed again for the realm it last showed", async () => {
    (await borrow("world", { theme: "standard", warmKey: "r_eurth" })).handle.release();

    await borrow("world", { theme: "standard", warmKey: "r_eurth" });

    expect(instances[0]!.setStyle).not.toHaveBeenCalled();
  });

  it("starts clean when the realm is not known and the map last showed one", async () => {
    (await borrow("world", { theme: "standard", warmKey: "default" })).handle.release();

    const second = await borrow("world", { theme: "standard" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
    expect(second.onReady).toHaveBeenCalledWith(instances[0], { styleReset: true });
  });

  it("does not reset again once the new realm is the one in place", async () => {
    (await borrow("world", { theme: "standard", warmKey: "default" })).handle.release();
    (await borrow("world", { theme: "standard", warmKey: "r_eurth" })).handle.release();

    await borrow("world", { theme: "standard", warmKey: "r_eurth" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
  });

  it("takes the realm named after the map was borrowed as the one it shows", async () => {
    // the first visit does not know its realm yet; the surface names it once it does
    const first = await borrow("world", { theme: "standard" });
    engine.setSurfaceWarmKey("world", "r_eurth");
    first.handle.release();

    await borrow("world", { theme: "standard", warmKey: "r_eurth" });
    expect(instances[0]!.setStyle).not.toHaveBeenCalled();

    (await borrow("world", { theme: "standard", warmKey: "default" })).handle.release();
    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
  });

  it("takes the first realm it is borrowed for as the one a map nobody named shows", async () => {
    (await borrow("world", { theme: "standard" })).handle.release();

    await borrow("world", { theme: "standard", warmKey: "r_eurth" });

    expect(instances[0]!.setStyle).not.toHaveBeenCalled();
  });

  it("names nothing for a role that has no map yet", () => {
    expect(() => engine.setSurfaceWarmKey("editor", "r_eurth")).not.toThrow();
  });

  it("starts the editor clean every time it is borrowed", async () => {
    const first = await borrow("editor", { theme: "standard" });
    first.handle.release();

    const second = await borrow("editor", { theme: "standard" });

    expect(instances[0]!.setStyle).toHaveBeenCalledTimes(1);
    expect(second.onReady).toHaveBeenCalledWith(instances[0], { styleReset: true });
  });

  it("reports a fresh instance as not reset", async () => {
    const { onReady } = await borrow("world", { theme: "standard" });
    expect(onReady).toHaveBeenCalledWith(instances[0], { styleReset: false });
  });
});
