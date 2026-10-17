/** @jest-environment node */
/** The `wikios>Label` name an unverified WikiOS author goes out to MediaWiki under, and reading one back. */
import { describe, it, expect } from "@jest/globals";
import { importName, labelOfImportName } from "~/lib/wiki-os/services/import-label";

describe("importName", () => {
  it("is the prefix and one trimmed line, or the community label for an empty author", () => {
    expect(importName("  Kir\n Republic ")).toBe("wikios>Kir Republic");
    expect(importName(null)).toBe("wikios>Community Contributor");
  });
});

describe("labelOfImportName", () => {
  it("is the label of a wikios> name, normalized as importLabel makes it", () => {
    expect(labelOfImportName("wikios>Kir_Republic")).toBe("Kir_Republic");
    expect(labelOfImportName("wikios>  Kir Republic ")).toBe("Kir Republic");
    expect(labelOfImportName(importName("Kir\tRepublic"))).toBe("Kir Republic");
  });

  it("is null for a MediaWiki name", () => {
    expect(labelOfImportName("Kir Republic")).toBeNull();
    expect(labelOfImportName("Wikios>Kir")).toBeNull();
  });
});
