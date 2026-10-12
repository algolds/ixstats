import { MAX_MAP_VERSION, parseMapVersion } from "~/lib/maps/map-version";

describe("parseMapVersion", () => {
  it.each([
    ["0", 0],
    ["7", 7],
    ["1791783284", 1791783284],
    [String(MAX_MAP_VERSION), MAX_MAP_VERSION],
  ])("reads %s", (segment, version) => expect(parseMapVersion(segment)).toBe(version));

  it.each([
    ["past a 32-bit integer", String(MAX_MAP_VERSION + 1)],
    ["eleven digits", "10000000000"],
    ["an enormous number", "99999999999999"],
    ["negative", "-1"],
    ["fractional", "1.5"],
    ["hex", "0x1"],
    ["exponent", "1e3"],
    ["a word", "latest"],
    ["empty", ""],
    ["padded", " 3"],
  ])("rejects %s", (_name, segment) => expect(parseMapVersion(segment)).toBeNull());
});
