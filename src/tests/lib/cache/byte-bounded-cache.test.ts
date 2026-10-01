/** @jest-environment node */
/** Plan 404 review: the article view cache is bounded by the bytes it holds, not by entry count. */
import { ByteBoundedCache } from "~/lib/cache/byte-bounded-cache";

function cache(maxBytes: number, defaultTtlMs = 1_000) {
  const clock = { now: 0 };
  return {
    clock,
    cache: new ByteBoundedCache<string>({ maxBytes, defaultTtlMs, now: () => clock.now }),
  };
}

describe("ByteBoundedCache", () => {
  it("returns what was stored, and undefined for what was not", () => {
    const { cache: c } = cache(100);
    c.set("a", "A", 10);

    expect(c.get("a")).toBe("A");
    expect(c.get("b")).toBeUndefined();
    expect(c.totalBytes).toBe(10);
    expect(c.size).toBe(1);
  });

  it("drops the least recently used entries until the new one fits", () => {
    const { cache: c } = cache(100);
    c.set("a", "A", 40);
    c.set("b", "B", 40);
    c.get("a"); // b is now the least recently used
    c.set("c", "C", 40);

    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe("A");
    expect(c.get("c")).toBe("C");
    expect(c.totalBytes).toBe(80);
  });

  it("holds many small entries and few big ones, whatever their count", () => {
    const { cache: c } = cache(1_000);
    for (let n = 0; n < 100; n++) c.set(`small${n}`, "s", 5);
    expect(c.size).toBe(100);

    c.set("big", "B", 900);
    expect(c.totalBytes).toBeLessThanOrEqual(1_000);
    expect(c.get("big")).toBe("B");
    expect(c.size).toBeLessThan(100);
  });

  it("does not store a value bigger than the whole cache, and keeps what it has", () => {
    const { cache: c } = cache(100);
    c.set("a", "A", 50);
    c.set("huge", "H", 101);

    expect(c.get("huge")).toBeUndefined();
    expect(c.get("a")).toBe("A");
    expect(c.totalBytes).toBe(50);
  });

  it("counts a replaced key once", () => {
    const { cache: c } = cache(100);
    c.set("a", "A1", 60);
    c.set("a", "A2", 30);

    expect(c.get("a")).toBe("A2");
    expect(c.totalBytes).toBe(30);
    expect(c.size).toBe(1);
  });

  it("expires entries after their time to live, freeing their bytes", () => {
    const { cache: c, clock } = cache(100, 1_000);
    c.set("default", "D", 10);
    c.set("short", "S", 10, 100);

    clock.now = 500;
    expect(c.get("short")).toBeUndefined();
    expect(c.get("default")).toBe("D");
    expect(c.totalBytes).toBe(10);

    clock.now = 1_000;
    expect(c.get("default")).toBeUndefined();
    expect(c.totalBytes).toBe(0);
  });

  it("deleteWhere drops the matching entries and gives their bytes back", () => {
    const { cache: c } = cache(100);
    c.set("view:a1:1", "x", 10);
    c.set("chips:view:a1:1:fr", "y", 20);
    c.set("view:a2:1", "z", 30);

    expect(c.deleteWhere((key) => key.includes(":a1:"))).toBe(2);

    expect(c.get("view:a1:1")).toBeUndefined();
    expect(c.get("view:a2:1")).toBe("z");
    expect(c.totalBytes).toBe(30);
    expect(c.size).toBe(1);
  });
});
