/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { stashItemHref } from "~/lib/wiki-os/stash-content-type";

describe("stashItemHref", () => {
  it("opens an IxWiki page at its plain path", () => {
    expect(stashItemHref("Caphiria")).toBe("/wiki/Caphiria");
    expect(stashItemHref("Caphiria", "ixwiki")).toBe("/wiki/Caphiria");
    expect(stashItemHref("Caphiria", null)).toBe("/wiki/Caphiria");
  });

  it.each(["iiwiki", "althistory"] as const)("names the wiki of a %s page", (source) => {
    expect(stashItemHref("Caphiria", source)).toBe(`/wiki/Caphiria?source=${source}`);
  });
});
