import {
  parseMWTimestamp,
  parseMWDateObject,
  formatMWTimeAgo,
  formatMWDate,
} from "~/lib/wiki-os/adapters/mediawiki/timestamp";

describe("mediawiki-timestamp", () => {
  describe("parseMWTimestamp", () => {
    it("parses 14-digit MediaWiki format into ISO 8601 string", () => {
      const result = parseMWTimestamp("20260818163557");
      expect(result).toBe("2026-08-18T16:35:57Z");
    });

    it("parses ISO 8601 string seamlessly", () => {
      const result = parseMWTimestamp("2026-08-18T18:07:34Z");
      expect(result).toBe("2026-08-18T18:07:34.000Z");
    });

    it("parses Date object", () => {
      const d = new Date("2026-01-01T00:00:00Z");
      expect(parseMWTimestamp(d)).toBe("2026-01-01T00:00:00.000Z");
    });

    it("handles null, undefined and empty string", () => {
      expect(parseMWTimestamp(null)).toBeNull();
      expect(parseMWTimestamp(undefined)).toBeNull();
      expect(parseMWTimestamp("")).toBeNull();
    });

    it("handles invalid formats gracefully", () => {
      expect(parseMWTimestamp("invalid-date-string-xyz")).toBeNull();
    });
  });

  describe("parseMWDateObject", () => {
    it("returns valid Date for 14-digit string", () => {
      const d = parseMWDateObject("20260818163557");
      expect(d).toBeInstanceOf(Date);
      expect(d?.getUTCFullYear()).toBe(2026);
      expect(d?.getUTCMonth()).toBe(7); // August is index 7
      expect(d?.getUTCDate()).toBe(18);
      expect(d?.getUTCHours()).toBe(16);
      expect(d?.getUTCMinutes()).toBe(35);
      expect(d?.getUTCSeconds()).toBe(57);
    });

    it("returns valid Date for ISO string", () => {
      const d = parseMWDateObject("2026-08-18T18:07:34Z");
      expect(d).toBeInstanceOf(Date);
      expect(d?.getUTCHours()).toBe(18);
      expect(d?.getUTCMinutes()).toBe(7);
    });

    it("returns null for invalid inputs", () => {
      expect(parseMWDateObject(null)).toBeNull();
      expect(parseMWDateObject(undefined)).toBeNull();
      expect(parseMWDateObject("")).toBeNull();
    });
  });

  describe("formatMWTimeAgo", () => {
    it("formats relative time correctly", () => {
      const now = Date.now();
      const tenMinsAgo = new Date(now - 10 * 60 * 1000).toISOString();
      expect(formatMWTimeAgo(tenMinsAgo)).toBe("10m ago");

      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      expect(formatMWTimeAgo(twoHoursAgo)).toBe("2h ago");
    });

    it("returns empty string for invalid timestamp", () => {
      expect(formatMWTimeAgo(null)).toBe("");
      expect(formatMWTimeAgo("")).toBe("");
    });
  });
});
