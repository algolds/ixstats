/** @jest-environment node */
import { ByteLru } from "~/server/shared/byte-lru";

describe("ByteLru", () => {
  it("sizes strings at two bytes per character and buffers at their byte length", () => {
    const lru = new ByteLru<string | Buffer>(1000);
    lru.set("s", "abcd");
    expect(lru.bytes).toBe(8);
    lru.set("b", Buffer.alloc(10));
    expect(lru.bytes).toBe(18);
  });

  it("evicts the least recently used entries until it is under the limit", () => {
    const lru = new ByteLru<string>(20); // ten characters
    lru.set("a", "12345");
    lru.set("b", "12345");
    lru.set("c", "12345"); // 30 bytes: "a" goes
    expect(lru.get("a")).toBeUndefined();
    expect(lru.get("b")).toBe("12345");
    expect(lru.get("c")).toBe("12345");
    expect(lru.bytes).toBe(20);
  });

  it("evicts several entries when one large value needs the room", () => {
    const lru = new ByteLru<string>(20);
    lru.set("a", "123");
    lru.set("b", "123");
    lru.set("big", "123456789"); // 18 bytes: both small entries go
    expect([...["a", "b", "big"]].map((k) => lru.get(k) !== undefined)).toEqual([
      false,
      false,
      true,
    ]);
    expect(lru.bytes).toBe(18);
  });

  it("get refreshes recency, so a read entry outlives an unread one", () => {
    const lru = new ByteLru<string>(20);
    lru.set("a", "12345");
    lru.set("b", "12345");
    expect(lru.get("a")).toBe("12345"); // "b" is now the oldest
    lru.set("c", "12345");
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("a")).toBe("12345");
  });

  it("replacing a key swaps its size instead of adding to it", () => {
    const lru = new ByteLru<string>(100);
    lru.set("a", "12345");
    lru.set("a", "12");
    expect(lru.bytes).toBe(4);
    expect(lru.get("a")).toBe("12");
  });

  it("does not store a value larger than the whole limit, and drops the old value of that key", () => {
    const lru = new ByteLru<string>(10);
    lru.set("keep", "123");
    lru.set("a", "12");
    lru.set("a", "1234567890");
    expect(lru.get("a")).toBeUndefined();
    expect(lru.get("keep")).toBe("123");
    expect(lru.bytes).toBe(6);
  });

  it("delete frees the bytes; deleting a missing key is a no-op", () => {
    const lru = new ByteLru<string>(100);
    lru.set("a", "1234");
    lru.delete("a");
    lru.delete("missing");
    expect(lru.bytes).toBe(0);
    expect(lru.get("a")).toBeUndefined();
  });

  it("deleteWhere removes every key the predicate matches and frees their bytes", () => {
    const lru = new ByteLru<string>(1000);
    lru.set("r1:v1:political", "aaaa");
    lru.set("r1:v1:rivers", "bb");
    lru.set("r2:v1:political", "cccccc");
    lru.deleteWhere((key) => key.startsWith("r1:"));
    expect(lru.get("r1:v1:political")).toBeUndefined();
    expect(lru.get("r1:v1:rivers")).toBeUndefined();
    expect(lru.get("r2:v1:political")).toBe("cccccc");
    expect(lru.bytes).toBe(12);
  });
});
