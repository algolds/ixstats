/** @jest-environment node */
import {
  checkInt4,
  MAX_INT4,
  modelWarning,
  PageRejected,
  parseMwTimestamp,
} from "~/lib/wiki-os/xml/import-validation";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";

describe("parseMwTimestamp", () => {
  it("accepts exactly the dump form", () => {
    expect(parseMwTimestamp("2026-01-02T03:04:05Z")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(parseMwTimestamp("2024-02-29T23:59:59Z")).toBe(Date.UTC(2024, 1, 29, 23, 59, 59));
  });

  it.each([
    "",
    "yesterday",
    "2026-01-02 03:04:05",
    "2026-01-02T03:04:05",
    "2026-01-02T03:04:05.000Z",
    "2026-01-02T03:04:05+00:00",
    "2026-01-02T03:04:05z",
    " 2026-01-02T03:04:05Z",
    "2026-01-02T03:04:05Z\n",
    "26-01-02T03:04:05Z",
    "20260102030405",
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-01-02T24:00:00Z",
    "2026-01-02T03:60:00Z",
    "0000-01-01T00:00:00Z",
  ])("rejects %j", (timestamp) => {
    expect(parseMwTimestamp(timestamp)).toBeNull();
  });
});

describe("checkInt4", () => {
  it("accepts absent values and whole numbers from 0 to 2147483647", () => {
    for (const value of [null, 0, 1, 456, MAX_INT4])
      expect(() => checkInt4("x", value)).not.toThrow();
  });

  it.each([-1, MAX_INT4 + 1, 99_999_999_999, 1.5, Number.NaN])(
    "rejects %p with a readable message",
    (value) => {
      expect(() => checkInt4("revision id", value)).toThrow(PageRejected);
      expect(() => checkInt4("revision id", value)).toThrow(
        `The revision id must be a whole number from 0 to 2147483647, not ${value}`
      );
    }
  );
});

describe("modelWarning", () => {
  const revision = (model: string): XmlRevision => ({
    id: 1,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    contributor: { deleted: true },
    minor: false,
    comment: null,
    commentDeleted: false,
    model,
    format: "text/x-wiki",
    text: "x",
    textDeleted: false,
  });

  it("is null when every revision has the model the title implies", () => {
    expect(modelWarning("Foo", [revision("wikitext")])).toBeNull();
    expect(modelWarning("Module:Foo", [revision("Scribunto")])).toBeNull();
    expect(modelWarning("MediaWiki:Common.css", [revision("css"), revision("css")])).toBeNull();
  });

  it("names the models that disagree, once each", () => {
    expect(modelWarning("Foo", [revision("css"), revision("wikitext"), revision("css")])).toBe(
      'Content model "css" differs from "wikitext", the model MediaWiki\'s defaults give this title'
    );
    expect(modelWarning("Module:Foo", [revision("wikitext")])).toMatch(
      /"wikitext" differs from "Scribunto"/
    );
  });
});
